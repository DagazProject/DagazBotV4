"use strict";

const fs = require('fs');

const db = require('./database.js');
const formula = require('./macro.js');
const hash = require('./qmhash.js');
const ds = require('./data-source');
const writer = require('./qm/qmsave.js');
const loader = require('./qm/qmload.js');
const qmm = require('./qm/qmwriter.js');
const parser = require('./qm/qmreader.js');

const RESULT_FIELD  = 'result_code';

const JOB_INTERVAL  = 60000;
const MX_JOBCOUNTER = 10;

let minJobInterval  = JOB_INTERVAL;
let jobInterval     = JOB_INTERVAL;
let jobCounter      = 0;
let retryQueue      = [];
let isProcessing    = [];
let timeslots       = [];
let sessions        = [];
let shedCommands    = null;
let logLevel        = 0;

function SchedCommand(service, command, timeout) {
    return {
        service: service,
        command: command,
        timeout: timeout,
        timestamp: new Date()
    };
}

function TimeSlot(service, userId, chatId, timestamp, data) {
    return {
        service: service,
        userId: userId,
        chatId: chatId,
        timestamp: timestamp,
        data: data
    };
}

function setLog(v) {
    logLevel = v;
}

function getIntervalTimeout() {
    if (jobCounter > MX_JOBCOUNTER) {
        jobInterval = minJobInterval;
    }
    jobCounter++;
    return jobInterval;
}

function setIntervalTimeout(timeout) {
    if (timeout < 1000) return;
    if (timeout < jobInterval) {
        jobInterval = timeout;
    }
    jobCounter = 0;
}

async function send(bot, service, chat, msg, options, callback, data) {
    if (retryQueue[service] === undefined) {
        retryQueue[service] = [];
    }
    try {
        const ix = retryQueue[service].length;
        retryQueue[service].push({
            chat:     chat,
            msg:      msg,
            options:  options,
            callback: callback,
            data:     data
        });
        const m = await bot.sendMessage(chat, msg, options);
        if (callback !== undefined) {
            await callback(data, m);
        }
        if (ix == 0) {
            retryQueue[service] = [];
        } else {
            retryQueue[service][ix] = null;
        }
        return m;
    } catch (error) {
        console.error(error);
    }
}

async function scheduleCommands(bot, service) {
    if (shedCommands === null) {
        shedCommands = [];
        const commands = await ds.getScheduledComands(service);
        for (let i = 0; i < commands.length; i++) {
            const timeout = commands[i].timeout;
            if ((timeout > 1000) && (timeout < minJobInterval)) {
                minJobInterval = timeout;
            }
            shedCommands.push(SchedCommand(service, commands[i].cmd, timeout));
        }
    }
    let f = false;
    for (let i = 0; i < shedCommands.length; i++) {
        const dt = new Date();
        if (dt.getTime() - shedCommands[i].timestamp >= shedCommands[i].timeout) {
            const ctx = await ds.addCommand(null, service, shedCommands[i].command);
            await ds.startCommand(ctx);
            shedCommands[i].timestamp = new Date();
            f = true;
        }
    }
    if (f) {
        await execCommands(bot, service);
    }
}

async function retry(bot, service) {
    if (retryQueue[service] === undefined) {
        retryQueue[service] = [];
    }
    if (isProcessing[service]) return false;
    isProcessing[service] = true;
    try {
        let n = 0;
        for (let i = 0; i < retryQueue[service].length; i++) {
            if (retryQueue[service][i]) {
                const callback = retryQueue[service][i].callback;
                const data = retryQueue[service][i].data;
                const m = await bot.sendMessage(retryQueue[service][i].chat, retryQueue[service][i].msg, retryQueue[service][i].options);
                if (callback !== undefined) {
                    await callback(data, m);
                }
                retryQueue[service][i] = null;
                n++;
            }
        }
        retryQueue[service] = [];
        if (n > 0) {
            console.log('RETRIED: ' + n);
        }
        const d = new Date();
        for (let i = 0; i < timeslots.length; i++) {
            if (timeslots[i] === null) continue;
            if (timeslots[i].timestamp.getTime() >= d.getTime()) continue;
            if (timeslots[i].service != service) continue;
            const userId = timeslots[i].userId;
            const chatId = timeslots[i].chatId;
            const data   = timeslots[i].data;
            await autoJump(bot, service, userId, chatId, data);
            timeslots[i] = null;
        }
    } catch (error) {
        console.error(error);
    }
    isProcessing[service] = false;
    scheduleCommands(bot, service);
}

async function execCommands(bot, service) {
    let inProcessing = true;
    while (inProcessing) {
        inProcessing = false;
        const actions = await ds.getActions(service);
        for (let i = 0; i < actions.length; i++) {
            let caption; let items;
            switch (actions[i].type) {
                case 1:
                    // Folder
                    await ds.setFirstAction(actions[i].ctx, actions[i].action);
                    inProcessing = true;
                    break;
                case 2:
                    // Input string
                    caption = await ds.getCaption(actions[i].ctx);
                    await send(bot,service, caption.chat, caption.value, undefined, async function(data, m) {
                          await ds.waitValue(data.ctx, m.message_id, data.hide);
                          if (logLevel & 2) {
                              console.log(m);
                          }
                    }, {
                          ctx:  actions[i].ctx,
                          hide: false
                    });
                    break;
                case 3:
                    // Output string
                    caption = await ds.getCaption(actions[i].ctx);
                    await send(bot, service, caption.chat, caption.value, undefined, undefined, undefined);
                    await ds.setNextAction(actions[i].ctx);
                    inProcessing = true;
                    break;
                case 4:
                    // Virtual Menu
                    caption = await ds.getCaption(actions[i].ctx);
                    let v = await ds.getParamValue(actions[i].ctx, caption.param);
                    if (v !== null) {
                        const list = v.split(/,/);
                        if (list.length > 1) {
                            let menu = []; let row = [];
                            for (let j = 0; j < list.length; j++) {
                                 if (row.length >= caption.width) {
                                     menu.push(row);
                                     row = [];
                                 }
                                 const r = list[j].split(/:/);
                                 row.push({
                                     text: r[1],
                                     callback_data: r[0]
                                 });
                            }
                            if (row.length > 0) {
                                 menu.push(row);
                            }
                            await send(bot, service, caption.chat, caption.value, {
                                     reply_markup: {
                                     inline_keyboard: menu
                                 }
                            }, async function (data, m) {
                                 await ds.waitValue(data.ctx, m.message_id, data.hide);
                                 if (logLevel & 2) {
                                     console.log(m);
                                 }
                            }, {
                                 ctx:  actions[i].ctx,
                                 hide: true
                            });
                        } else if (list.length == 1) {
                                await ds.setParamValue(actions[i].ctx, caption.param, v);
                                await ds.setNextAction(actions[i].ctx);
                                inProcessing = true;
                            }
                        }
                        break;
                    case 5:
                        // Menu
                        caption = await ds.getCaption(actions[i].ctx);
                        items = await ds.getMenuItems(actions[i].ctx, actions[i].action, caption.lang);
                        if (items.length > 0) {
                            let menu = []; let row = [];
                            for (let j = 0; j < items.length; j++) {
                                 if (row.length >= caption.width) {
                                     menu.push(row);
                                     row = [];
                                 }
                                 row.push({
                                     text: items[j].value,
                                     callback_data: items[j].id
                                 });
                            }
                            if (row.length > 0) {
                                menu.push(row);
                            }
                            await send(bot, service, caption.chat, caption.value, {
                                    reply_markup: {
                                    inline_keyboard: menu
                                  }
                            }, async function (data, m) {
                                  await ds.waitValue(data.ctx, m.message_id, data.hide);
                                  if (logLevel & 2) {
                                      console.log(m);
                                  }
                            }, {
                                  ctx:  actions[i].ctx,
                                  hide: true
                            });
                        }
                        break;
                    case 6:
                        // Stored Procedure
                        const sp = await ds.getRequest(actions[i].ctx);
                        if (sp !== null) {
                            const p = await ds.getSpParams(actions[i].ctx, sp.user, sp.service);
                            let sql = 'select ' + sp.value + '(';
                            let params = [];
                            for (let j = 0; j < p.length; j++) {
                                if (params.length > 0) {
                                    sql = sql + ',';
                                }
                                sql = sql + '$' + p[j].rn;
                                params.push(p[j].value);
                            }
                            sql = sql + ') as value';
                            const z = await db.query(sql, params);
                            if (z && z.rows.length > 0) {
                                const results = await ds.getSpResults(actions[i].ctx);
                                let r = null;
                                for (let k = 0; k < results.length; k++) {
                                     const v = z.rows[0].value[results[k].name];
                                     if (results[k].name == RESULT_FIELD) {
                                        r = v;
                                     } else if (results[k].param) {
                                        await ds.setParamValue(actions[i].ctx, results[k].param, v);
                                     }
                                }
                                if (r !== null) {
                                     await ds.setResultAction(actions[i].ctx, r);
                                } else {
                                     await ds.setNextAction(actions[i].ctx);
                                }
                            }
                            inProcessing = true;
                        }
                        break;
                    case 7:
                        // HTTP Request
                        const rq = await ds.getRequest(actions[i].ctx);
                        if (rq !== null) {
                            const p = await ds.getSpParams(actions[i].ctx, rq.user, rq.service);
                            let body = {};
                            for (let j = 0; j < p.length; j++) {
                                body[p[j].name] = p[j].value;
                            }
                            if (rq.type == 'POST') {
                                axios.post(rq.value, body).then(async function (response) {
                                    const results = await ds.getSpResults(actions[i].ctx);
                                    let r = null;
                                    for (let k = 0; k < results.length; k++) {
                                         if (results[k].name == RESULT_FIELD) {
                                             r = response.status;
                                         } else {
                                             if (response.data[results[k].name]) {
                                                 const v = response.data[results[k].name];
                                                 if (results[k].param) {
                                                     await ds.setParamValue(actions[i].ctx, results[k].param, v);
                                                 }
                                             }
                                         }
                                    }
                                    if (r !== null) {
                                         await ds.setResultAction(actions[i].ctx, r);
                                    } else {
                                         await ds.setNextAction(actions[i].ctx);
                                    }
                                }).catch(async function (error) {
                                    console.error(error);
                                    await ds.setNextAction(actions[i].ctx);
                                });
                                inProcessing = true;
                            }
                        }
                        break;
                    case 8:
                        // Text Quest
                        const script = await ds.getParamValue(actions[i].ctx, actions[i].param);
                        if (script) {
                            const file = await ds.getScript(script);
                            if (file) {
                                const user = await ds.getUserByCtx(actions[i].ctx);
                                const ctx  = await hash.load(file.filename, user.name);
                                if (ctx) {
                                    ctx.user = user.id;
                                    ctx.script = script;
                                    ctx.money = file.bonus;
                                    ctx.penalty = file.penalty;
                                    await closeQuestContexts(bot, service, user.id, user.chat);
                                    ctx.id = await ds.createQuestContext(script, actions[i].ctx, ctx.loc);
                                    hash.addContext(user.uid, actions[i].service, ctx);
                                    const qm = await hash.getQm(ctx);
                                    const fixups = await ds.getFixups(script, actions[i].ctx);
                                    for (let i = 0; i < fixups.length; i++) {
                                         let v = fixups[i].value;
                                         if (qm.params[fixups[i].num].isMoney) {
                                             const limit = await getMoneyLimit(qm);
                                             if (v > limit) {
                                                 v = limit;
                                             }
                                             await ds.setGlobalValue(ctx.user, fixups[i].id, 3, ctx.script, fixups[i].value, null);
                                         }
                                         await hash.setValue(ctx, fixups[i].num, v);
                                    }
                                    let text = await ds.getQuestText(+script, 1);
                                    if (text) {
                                        text = await prepareText(text, qm, ctx);
                                        await send(bot, service, user.chat, text, {
                                            parse_mode: "HTML"
                                        }, undefined, undefined);
                                    }
                                    ctx.message = await questMenu(bot, service, qm, ctx.loc, user.uid, user.chat, ctx);
                                }
                            }
                        }
                        await ds.setNextAction(actions[i].ctx);
                        inProcessing = true;
                        break;
            }
        }
    }
}

async function closeQuestContexts(bot, service, user, chatId) {
    const ctxs = await ds.getQuestContexts(service, user);
    for (let i = 0; i < ctxs.length; i++) {
        if (ctxs[i].hide) {
            try {
                await bot.deleteMessage(chatId, ctxs[i].hide);
            } catch (error) {
                console.error(error);
            }
        }
        await ds.closeContext(ctxs[i].id);
    }
}

function checkExists(name) {
    try {
        fs.accessSync(name, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

async function sendImg(bot, uid, chat, name) {
    try {
        const filename = await ds.getImageFileName(uid, name);
        if (!checkExists(__dirname + '/upload/' + filename)) return;
        await bot.sendPhoto(chat, __dirname + '/upload/' + filename);
    } catch (error) {
        console.error(error);
    }
}

async function execCalc(bot, msg, service, r) {
    let params = [];
    let cmd = r[2];
    for (let i = 3; i < r.length; i++) {
        if (r[i] === undefined) break;
        cmd = cmd + ' ' + r[i];
    }
    const ctx = await hash.getContext(msg.from.id, service);
    if (ctx) {
        for (let i = 0; i < ctx.params.length; i++) {
            params.push(ctx.params[i].value);
        }
    }
    const x = await formula.calc(cmd, params);
    await send(bot, service, msg.chat.id, x, undefined, undefined, undefined);
}

async function execLoad(bot, name, chatId, id, service, username) {
    const ctx = await hash.load(name, username);
    if (ctx) {
        hash.addContext(id, service, ctx);
        const qm = await hash.getQm(ctx);
        ctx.message = await questMenu(bot, service, qm, ctx.loc, id, chatId, ctx);
    }
}

async function calculateParams(text, params, qm) {
    let r = text.match(/\[d(\d+)\]/);
    while (r) { 
        const ix = r[1];
        let x = '';
        if (ix <= params.length) {
            const v = +params[ix - 1].value;
            for (let j = 0; j < qm.params[ix - 1].showingInfo.length; j++) {
                if (v < qm.params[ix - 1].showingInfo[j].from) continue;
                if (v > qm.params[ix - 1].showingInfo[j].to) continue;
                x = qm.params[ix - 1].showingInfo[j].str.replace(/<>/g, v);
                break;
            }
        }
        text = text.replace(r[0], x);
        r = text.match(/\[d(\d+)\]/);
    }
    r = text.match(/{([^}]+)}/);
    let p = null;
    while (r) {
        const f = r[1];
        if (p === null) {
            p = [];
            for (let i = 0; i < params.length; i++) {
                p.push(params[i].value);
            }
        }
        const x = await formula.calc(f, p);
        text = text.replace(r[0], x);
        r = text.match(/{([^}]+)}/);
    }
    r = text.match(/\[p(\d+)\]/);
    while (r) {
        const ix = r[1];
        if (ix <= params.length) {
            text = text.replace(r[0], params[ix - 1].value);
        } else {
            text = text.replace(r[0], '');
        }
        r = text.match(/\[p(\d+)\]/);
    }
    return text;
}

function repeat(s, n) {
    let r = '';
    for (let i = 0; i < n; i++) {
        r = r + s;
    }
    return r;
}

function fixText(text) {
    let s = text.replace(/<clr>/g, '<b>');
    s = s.replace(/<clrEnd>/g, '</b>');
    s = s.replace(/<br>/g, '\n');
    s = s.replace(/<\/format>/g, '');
    let r = s.match(/<format=left,(\d+)>/);
    while (r) {
        const ix = r.index;
        let len = 0; let esc = false;
        for (let i = ix - 1; i >= 0; i--) {
            if (s[i] == '>') {
                esc = true;
                continue;
            }
            if (s[i] == '<') {
                esc = false;
                continue;
            }
            if (s[i] == '\n') break;
            if (esc) continue;
            len++;
        }
        s = s.replace('<format=left,' + r[1] + '>', '' + repeat(' ', r[1] - len));
        r = s.match(/<format=left,(\d+)>/);
    }
    s = s.replace(/<format>/g, '');
    s = s.replace(/<\/format>/g, '');
    s = s.replace(/<fix>/g, '<code>');
    return s.replace(/<\/fix>/g, '</code>');
}

function noTag(text) {
    let s = text.replace(/<clr>/g, '');
    s = s.replace(/<clrEnd>/g, '');
    s = s.replace(/<b>/g, '');
    s = s.replace(/<\/b>/g, '');
    s = s.replace(/<fix>/g, '');
    return s.replace(/<\/fix>/g, '');
}

async function replaceStrings(text, qm, ctx, noRanger) {
    text = text.replace(/<ToStar>/g, '<b>' + qm.strings.ToStar + '</b>');
    text = text.replace(/<Parsec>/g, '<b>' + qm.strings.Parsec + '</b>');
    text = text.replace(/<Artefact>/g, '<b>' + qm.strings.Artefact + '</b>');
    text = text.replace(/<ToPlanet>/g, '<b>' + qm.strings.ToPlanet + '</b>');
    text = text.replace(/<FromPlanet>/g, '<b>' + qm.strings.FromPlanet + '</b>');
    text = text.replace(/<FromStar>/g, '<b>' + qm.strings.FromStar + '</b>');
    if (!noRanger) {
        const date = ctx.date.toISOString();
        const r = date.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (r) {
            text = text.replace(/<Date>/g, '<b>' + r[3] + '-' + r[2] + '-' + r[1] + '</b>');
            text = text.replace(/<CurDate>/g, '<b>' + r[3] + '-' + r[2] + '-' + r[1] + '</b>');
            text = text.replace(/<Day>/g, '<b>' + r[3] + '-' + r[2] + '-' + r[1] + '</b>');
        }
        text = text.replace(/<Ranger>/g, '<b>' + ctx.username + '</b>');
        let users = null;
        if (ctx.session) {
            users = await ds.getSessionUsers(ctx.session);
        }
        if (users) {
            for (let i = 0; i < users.length; i++) {
                text = text.replace(new RegExp('<' + users[i].num + '>', 'g'), '<b>' + users[i].name + '</b>');
            }
        }
        text = text.replace(/<1>/g, '<b>' + ctx.username + '</b>');
        text = text.replace(/<2>/g, '<b>Bot</b>');
        text = text.replace(/<3>/g, '<b>Bot</b>');
        text = text.replace(/<4>/g, '<b>Bot</b>');
        text = text.replace(/<5>/g, '<b>Bot</b>');
        text = text.replace(/<Money>/g, '<b>' + ctx.money + '</b>');
    } else {
        text = text.replace(/<Money>/g, '<b>' + qm.strings.Money + '</b>');
    }
    return text;
}

async function prepareText(text, qm, ctx) {
    if (text) {
        text = await replaceStrings(text, qm, ctx, false);
        text = await calculateParams(text, ctx.params, qm);
    } else {
        text = '...';
    }
    return text;
}

async function checkCritValue(bot, service, chatId, qm, ctx, ix, value) {
    if (qm.params[ix].critValueString) {
        const r = qm.params[ix].critValueString.match(/^Сообщение/);
        if (r) return 0;
        if ((qm.params[ix].critType == 0) && (ctx.params[ix].max == value)) {
            const text = fixText(await prepareText(qm.params[ix].critValueString, qm, ctx));
            await send(bot, service, chatId, text, {
                parse_mode: "HTML"
            }, undefined, undefined);
            return qm.params[ix].type;
        }
        if ((qm.params[ix].critType == 1) && (ctx.params[ix].min == value)) {
            const text = fixText(await prepareText(qm.params[ix].critValueString, qm, ctx));
            await send(bot, service, chatId, text, {
                parse_mode: "HTML"
            }, undefined, undefined);
            return qm.params[ix].type;
        }
    }
    return 0;
}

async function paramChanges(bot, service, chatId, qm, changes, ctx) {
    let p = [];
    for (let i = 0; i < ctx.params.length; i++) {
        p.push(ctx.params[i].value);
    }
    for (let i = 0; i < changes.length ; i++) {
        if (i >= ctx.params.length) break;
        if (changes[i].showingType) {
            if (changes[i].showingType == 1) {
                await hash.setHidden(ctx, i, false);
            }
            if (changes[i].showingType == 2) {
                await hash.setHidden(ctx, i, true);
            }
        }
        if (changes[i].isChangeFormula && changes[i].changingFormula) {
            const old = ctx.params[i].value;
            await hash.setValue(ctx, i, await formula.calc(changes[i].changingFormula, p));
            if (old != ctx.params[i].value) {
                const t = await checkCritValue(bot, service, chatId, qm, ctx, i, ctx.params[i].value);
                if (t > 0) return t;
            }
            continue;
        }
        if (changes[i].isChangeValue) {
            const old = ctx.params[i].value;
            await hash.setValue(ctx, i, +changes[i].change);
            if (old != ctx.params[i].value) {
                const t = await checkCritValue(bot, service, chatId, qm, ctx, i, ctx.params[i].value); 
                if (t > 0) return t;
            }
            continue;
        }
        if (changes[i].isChangePercentage && (ctx.params[i].value != 0)) {
            const old = ctx.params[i].value;
            await hash.setValue(ctx, i, ctx.params[i].value + ((+ctx.params[i].value * +changes[i].change) / 100) | 0);
            if (old != ctx.params[i].value) {
                const t = await checkCritValue(bot, service, chatId, qm, ctx, i, ctx.params[i].value); 
                if (t > 0) return t;
            }
            continue;
        }
        if (changes[i].change != 0) {
            const old = ctx.params[i].value;
            await hash.setValue(ctx, i, (+ctx.params[i].value) + (+changes[i].change));
            if (old != ctx.params[i].value) {
                const t = await checkCritValue(bot, service, chatId, qm, ctx, i, ctx.params[i].value);
                if (t > 0) return t;
            }
            continue;
        }
    }
    return 0;
}

async function jumpRestricted(jump, ctx) {
    for (let i = 0; i < ctx.params.length; i++) {
        if (jump.paramsConditions[i].mustFrom > ctx.params[i].value) return true;
        if (jump.paramsConditions[i].mustTo < ctx.params[i].value) return true;
        if (jump.paramsConditions[i].mustEqualValues.length > 0) {
            const f = (jump.paramsConditions[i].mustEqualValues.indexOf(+ctx.params[i].value) < 0);
            if (jump.paramsConditions[i].mustEqualValuesEqual && f) return true;
            if (!jump.paramsConditions[i].mustEqualValuesEqual && !f) return true;
        }        
        if (jump.paramsConditions[i].mustModValues.length > 0) {
            let f = true;
            for (let j = 0; j < jump.paramsConditions[i].mustModValues.length; j++) {
                if ((ctx.params[i].value % jump.paramsConditions[i].mustModValues[j]) == 0) f = false;
            }
            if (jump.paramsConditions[i].mustModValuesMod && f) return true;
            if (!jump.paramsConditions[i].mustModValuesMod && !f) return true;
        }
    }
    if (jump.formulaToPass) {
        let p = [];
        for (let i = 0; i < ctx.params.length; i++) {
            p.push(ctx.params[i].value);
        }
        const r = await formula.calc(jump.formulaToPass, p);
        if (!r) return true;
    }
    if (jump.jumpingCountLimit > 0) {
        const c = ctx.jumps[jump.id];
        if (c) {
            if (c >= jump.jumpingCountLimit) return true;
        }
    }
    return false;
}

function addJump(jumps, qm, ix, text) {
    if (text != '...') {
        for (let i = 0; i < jumps.length; i++) {
            if (jumps[i].text == text) {
                if (qm.jumps[ix].priority > jumps[i].priority) {
                    jumps[i].ids = [];
                }
                jumps[i].ids.push(qm.jumps[ix].id);
                return;
            }
        }
    }
    jumps.push({
        text: text,
        ids: [qm.jumps[ix].id],
        order: qm.jumps[ix].showingOrder,
        priority: qm.jumps[ix].priority
    });
}

async function selectId(ids) {
    if (ids.length == 1) return ids[0];
    if (ids.length > 1) {
        const ix = await formula.calc('[0..' + (ids.length - 1) + ']', []);
        return (ix < ids.length) ? ids[ix] : ids [0];
    }
}

function getParamBlock(ctx) {
    let r = '';
    for (let i = 0; i < ctx.paramCount; i++) {
        if (r != '') r = r + ',';
        r = r + ctx.params[ctx.startParam + i - 1].value;
    }
    return '[' + r + ']';
}

async function getMenu(bot, service, userId, chatId, qm, loc, ctx, menu) {
    let jumps = []; let mx = null; let mn = null;
    let isEmpty = true; let priority = null;
    for (let i = 0; i < qm.jumps.length; i++) {
         if (qm.jumps[i].fromLocationId == qm.locations[loc].id) {
             if (await jumpRestricted(qm.jumps[i], ctx)) continue;
             let t = await prepareText(qm.jumps[i].text ? qm.jumps[i].text : '...', qm, ctx);
             let r = t.match(/^!session\s*(\d*)/);
             if (r) {
                if (ctx.id) {
                    const info = await ds.joinToSession(ctx.id);
                    if (info) {
                        await hash.setValue(ctx, info.indexParam - 1, +info.userNum);
                        ctx.session    = +info.id;
                        ctx.indexParam = +info.indexParam;
                        ctx.startParam = +info.startParam;
                        ctx.paramCount = +info.paramCount;
                        if (r[1]) {
                            ctx.timeout = +r[1];
                        }
                    }
                }
                t = '...';
             }
             r = t.match(/^!wait\s*(\d*)/);
             if (r) {
                 if (ctx.session) {
                     if (await ds.isCompletedSession(ctx.session)) {
                         const params = getParamBlock(ctx);
                         const info = await ds.addSessionParams(ctx.id, params);
                         if (info.leftUsers > 0) {
                             if (!sessions[ctx.session]) {
                                 sessions[ctx.session] = [];
                             }
                             sessions[ctx.session].push(TimeSlot(service, userId, chatId, new Date(), qm.jumps[i].id));
                             return;
                         }
                         const p = await ds.getSessionParams(ctx.session, info.slotNum);
                         for (let k = 0; k < p.length; k++) {
                            const ix = +ctx.startParam + (ctx.paramCount * p[k].num) + (p[k].ix - 1);
                            await hash.setValue(ctx, ix - 1, p[k].value);
                         }
                         if (sessions[ctx.session]) {
                             for (let j = 0; j < sessions[ctx.session].length; j++) {
                                 const t = sessions[ctx.session][j];
                                 const userId = t.userId;
                                 const chatId = t.chatId;
                                 const data   = t.data;
                                 const c = await hash.getContext(userId, t.service);
                                 if (c) {
                                     for (let k = 0; k < p.length; k++) {
                                        const ix = +c.startParam + (c.paramCount * p[k].num) + (p[k].ix - 1);
                                        await hash.setValue(c, ix - 1, p[k].value);
                                     }
                                     await autoJump(bot, service, userId, chatId, data);
                                 }
                             }
                             delete sessions[ctx.session];
                         }
                     } else {
                         await hash.setValue(ctx, ctx.indexParam - 1, 0);
                     }
                 }
                 t = '...';
             }
             addJump(jumps, qm, i, noTag(t));
             if ((mn === null) || (mn > qm.jumps[i].showingOrder)) mn = qm.jumps[i].showingOrder;
             if ((mx === null) || (mx < qm.jumps[i].showingOrder)) mx = qm.jumps[i].showingOrder;
             if (t != '...') {
                isEmpty = false;
                continue;
             }
             if ((priority === null) || (priority < qm.jumps[i].priority)) {
                priority = qm.jumps[i].priority;
             }
        }
    }
    if ((mn !== null) && (mx !== null)) {
        let list = [];
        for (let r = mn; r <= mx; r++) {
            for (let j = 0; j < jumps.length; j++) {
                 if ((priority !== null) && (jumps[j].text == '...')) {
                      if (jumps[j].priority < priority) continue;
                 }
                 if (jumps[j].order == r) {
                    const r = jumps[j].text.match(/^!auto\s*(\d+)/);
                    if (r) {
                       const t = +r[1];
                       let d = new Date();
                       d.setSeconds(d.getSeconds() + t);
                       setIntervalTimeout(t * 1000);
                       for (let k = 0; k < timeslots.length; k++) {
                           if (timeslots[k] === null) {
                               timeslots[k] = TimeSlot(service, userId, chatId, d, jumps[j].ids[0]);
                               d = null;
                               break;
                           }
                       }
                       if (d !== null) {
                           timeslots.push(TimeSlot(service, userId, chatId, d, jumps[j].ids[0]));
                       }
                       continue;
                    }
                    list.push(jumps[j]);
                }
            }
        }
        let width = 1;
        if (qm.locations[loc].media[0] && qm.locations[loc].media[0].img) {
            const r = qm.locations[loc].media[0].img.match(/^(\d+)$/);
            if (r) width = +r[1];
        }
        let m = [];
        for (let j = 0; j < list.length; j++) {
            if (m.length >= width) {
                menu.push(m);
                m = [];
            }
            m.push({
                text: list[j].text,
                callback_data: await selectId(list[j].ids)
            });
        }
        if (m.length > 0) {
            menu.push(m);
        }
    }
    return isEmpty;
}

async function getText(bot, uid, chat, qm, loc, ctx) {
    let ix = 0;
    if (qm.locations[loc].isTextByFormula && qm.locations[loc].textSelectFormula) {
        let p = [];
        for (let i = 0; i < ctx.params.length; i++) {
            p.push(ctx.params[i].value);
        }
        ix = await formula.calc(qm.locations[loc].textSelectFormula, p) - 1;
    } else {
        if (qm.locations[loc].texts.length == 0) return '...';
        if (qm.locations[loc].texts.length > 1) {
            if (ctx.locs[loc]) {
                ctx.locs[loc]++;
                if (ctx.locs[loc] >= qm.locations[loc].texts.length) {
                    ctx.locs[loc] = 0;
                }
            } else {
                ctx.locs[loc] = 0;
            }
            ix = ctx.locs[loc];
        }
    }
    if (qm.locations[loc].media[ix] && qm.locations[loc].media[ix].img) {
        await sendImg(bot, uid, chat, qm.locations[loc].media[ix].img);
    }
    return qm.locations[loc].texts[ix];
}

async function getParamBox(qm, ctx) {
    let r = '';
    for (let i = 0; i < ctx.params.length; i++) {
        const v = ctx.params[i].value;
        if (ctx.params[i].hidden) continue;
        if (!qm.params[i].showWhenZero) {
            if (v == 0) continue;
        }
        for (let j = 0; j < qm.params[i].showingInfo.length; j++) {
            if (v < qm.params[i].showingInfo[j].from) continue;
            if (v > qm.params[i].showingInfo[j].to) continue;
            const t = qm.params[i].showingInfo[j].str.replace(/<>/g, v);
            if (!qm.params[i].showWhenZero) {
                if (t == '') continue;
            }
            r = r + t;
            const s = r.replace('<nobr>', '');
            if (s == r) {
                r = r + "\n";
            } else {
                r = s;
            }
            break;
        }
    }
    if (r != '') {
        r = await prepareText(r, qm, ctx);
        const s = fixText(r);
        if (s != r) {
            r = s + '\n';
        } else {
            r = "<i>" + r + "</i>\n";
        }
    }
    return r;
}

async function getMoneyLimit(qm) {
    for (let i = 0; i < qm.params.length; i++) {
        if (qm.params[i].isMoney) {
            if (qm.params[i].starting != '[') {
                return await formula.calc(qm.params[i].starting, []);
            } else {
                return qm.params[i].max;
            }
        }
    }
    return null;
}

async function endQuest(bot, service, chatId, ctx, qm, crit) {
    if (ctx.id) {
       const fixups = await ds.getFixups(ctx.script, ctx.id);
       for (let i = 0; i < fixups.length; i++) {
            const value = hash.getValue(ctx, fixups[i].num);
            let limit = null;
            if (qm.params[fixups[i].num].isMoney) {
                limit = await getMoneyLimit(qm);
            }
            if (value !== null) {
                await ds.setGlobalValue(ctx.user, fixups[i].id, 3, ctx.script, value, limit);
            }
       }
       if (qm.locations[ctx.loc].isSuccess || (crit == 2)) {
            if (ctx.script) {
                let text = await ds.getQuestText(+ctx.script, 2);
                if (text) {
                    text = await prepareText(text, qm, ctx);
                    await send(bot, service, chatId, text, {
                       parse_mode: "HTML"
                    }, undefined, undefined);
                }
            }
            await ds.winQuest(ctx.user, ctx.script);
       }
       if (qm.locations[ctx.loc].isFaily || (crit == 1)) {
           await ds.failQuest(ctx.user, ctx.script);
       }
       if (qm.locations[ctx.loc].isFailyDeadly || (crit == 3)) {
           await ds.deathQuest(ctx.user, ctx.script);
       }
       await ds.closeContext(ctx.id);
    }
}

async function questMenu(bot, service, qm, loc, userId, chatId, ctx) {
    let isCritical = await paramChanges(bot, service, chatId, qm, qm.locations[loc].paramsChanges, ctx);
    if (qm.locations[loc].dayPassed) {
        ctx.date.setDate(ctx.date.getDate() + 1);
    }
    let menu = [];
    let isEmpty = await getMenu(bot, service, userId, chatId, qm, loc, ctx, menu);
    let text = await getText(bot, userId, chatId, qm, loc, ctx);
    text = await prepareText(text, qm, ctx);
    const prefix = await getParamBox(qm, ctx);
    if ((text == '...') && (prefix != '')) {
        ctx.fixed = prefix;
    } else {
        ctx.fixed = prefix + fixText(text);
    }
    ctx.old = fixText(text);
    while (isEmpty && (menu.length > 0)) {
        if (text != '...') {
            await send(bot, service, chatId, ctx.fixed, {
                parse_mode: "HTML"
            }, undefined, undefined);
        }
        let ix = 0;
        if (menu.length > 1) {
            ix = await formula.calc('[0..' + (menu.length - 1) + ']', []);
            if (ix >= menu.length) ix = 0;
        }
        let to = null;
        for (let i = 0; i < qm.jumps.length; i++) {
            if (qm.jumps[i].id != menu[ix][0].callback_data) continue;
            to = qm.jumps[i].toLocationId;
            const t = await paramChanges(bot, service, chatId, qm, qm.jumps[i].paramsChanges, ctx); 
            if (t > 0) isCritical = t;
            if (qm.jumps[i].description) {
                const text = await prepareText(qm.jumps[i].description, qm, ctx);
                await send(bot, service, chatId, fixText(text), {
                    parse_mode: "HTML"
                }, undefined, undefined);
            }
            if (qm.jumps[i].img) {
                await sendImg(bot, userId, chatId, qm.jumps[i].img);
            }
            break;
        }
        menu = []; loc = null;
        if (to === null) break;
        for (let i = 0; i < qm.locations.length; i++) {
            if (qm.locations[i].id != to) continue;
            loc = i;
            break;
        }
        if (loc === null) break;
        const t = await paramChanges(bot, service, chatId, qm, qm.locations[loc].paramsChanges, ctx); 
        if (t > 0) isCritical = t;
        if (qm.locations[loc].dayPassed) {
            ctx.date.setDate(ctx.date.getDate() + 1);
        }
        isEmpty = await getMenu(bot, service, userId, chatId, qm, loc, ctx, menu);
        text = await getText(bot, userId, chatId, qm, loc, ctx);
        text = await prepareText(text, qm, ctx);
        const prefix = await getParamBox(qm, ctx);
        if ((text == '...') && (prefix != '')) {
            ctx.fixed = prefix;
        } else {
            ctx.fixed = prefix + fixText(text);
        }
        ctx.old = fixText(text);
        if (menu.length == 0) break;
    }
    if (loc !== null) {
        await hash.setLoc(ctx, loc);
    }
    if (logLevel & 4) {
        console.log(text);
    }
    let r = null;
    if (isCritical > 0) {
        await endQuest(bot, service, chatId, ctx, qm, isCritical);
        return r;
    } 
    if (menu.length > 0) {
        const msg = await send(bot, service, chatId, ctx.fixed, {
            reply_markup: {
              inline_keyboard: menu
            },
            parse_mode: "HTML"
        }, async function (data, m) {
            data.ctx.message = m.message_id;
            if (logLevel & 2) {
                console.log(m);
            }
        }, {
            ctx: ctx
        });
        if (msg && msg.message_id) {
            r = msg.message_id;
        }
    } else {
        await send(bot, service, chatId, ctx.fixed, {
            parse_mode: "HTML"
        }, undefined, undefined);
    }
    const location = qm.locations[loc];
    if (location.isSuccess || location.isFaily || location.isFailyDeadly) {
        await endQuest(bot, service, chatId, ctx, qm, 0);
    }
    return r;
}

async function commonJump(bot, service, id, chatId, ctx, qm, itemId) {
    if (!qm.locations[ctx.loc].isStarting && !qm.locations[ctx.loc].isEmpty && (ctx.old != '...')) {
        await send(bot, service, chatId, ctx.old, {
            parse_mode: "HTML"
        }, undefined, undefined);
    }
    let to = null;
    for (let i = 0; i < qm.jumps.length; i++) {
        if (qm.jumps[i].id == itemId) {
            to = qm.jumps[i].toLocationId;
            if (qm.jumps[i].dayPassed) {
                ctx.date.setDate(ctx.date.getDate() + 1);
            }
            const isCritical = await paramChanges(bot, service, chatId, qm, qm.jumps[i].paramsChanges, ctx);
            if (isCritical > 0) {
                await endQuest(bot, service, chatId, ctx, qm, isCritical);
                return false;
            }
            if (qm.jumps[i].jumpingCountLimit > 0) {
                const c = ctx.jumps[qm.jumps[i].id];
                if (c) {
                    ctx.jumps[qm.jumps[i].id]++;
                } else {
                    ctx.jumps[qm.jumps[i].id] = 1;
                }
            }
            if (qm.jumps[i].description) {
                const text = await prepareText(qm.jumps[i].description, qm, ctx);
                await send(bot, service, chatId, fixText(text), {
                    parse_mode: "HTML"
                }, undefined, undefined);
            }
            if (qm.jumps[i].img) {
                await sendImg(bot, id, chatId, qm.jumps[i].img);
            }
        }
    }
    if (to !== null) {
        for (let i = 0; i < qm.locations.length; i++) {
            if (qm.locations[i].id == to) {
                await hash.setLoc(ctx, i);
                ctx.message = await questMenu(bot, service, qm, i, id, chatId, ctx);
                return true;
            }
        }
    }
}

async function autoJump(bot, service, id, chatId, itemId) {
    const ctx = await hash.getContext(id, service);
    if (ctx !== null) {
        if (ctx.message) {
            try {
                await bot.deleteMessage(chatId, ctx.message);
            } catch (error) {
                console.error(error);
            }
        }
        ctx.message = null;
        const qm = await hash.getQm(ctx);
        if (qm) {
            await commonJump(bot, service, id, chatId, ctx, qm, itemId);
        }
    }
}

function getJumpText(qm, id) {
    for (let i = 0; i < qm.jumps.length; i++) {
        if (qm.jumps[i].id == id) return qm.jumps[i].text;
    }
    return '';
}

async function execJump(bot, chatId, userId, service, msg) {
    for (let i = 0; i < timeslots.length; i++) {
        if (timeslots[i] === null) continue;
        if (timeslots[i].userId  != userId) continue;
        timeslots[i] = null;
    }
    const ctx = await hash.getContext(userId, service);
    if (ctx !== null) {
        try {
            if (ctx.message) {
                await bot.deleteMessage(chatId, ctx.message);
            } else if (msg.message) {
                bot.deleteMessage(chatId, msg.message.message_id);
                ctx.old = '...';
            }
        } catch (error) {
            console.error(error);
        }
        ctx.message = null;
        const qm = await hash.getQm(ctx);
        if (qm) {
            let id = +msg.data;
            if (id > 0) {
                const text = await prepareText(getJumpText(qm, msg.data), qm, ctx);
                if (text.length > 50) {
                    let menu = [];
                    const lang = await ds.getUserLang(userId);
                    if (lang == 'ru') {
                        menu.push([{
                            text: 'Да',
                            callback_data: -id
                        }, {
                            text: 'Нет',
                            callback_data: 0
                        }]);
                    } else {
                        menu.push([{
                            text: 'Yes',
                            callback_data: -id
                        }, {
                            text: 'No',
                            callback_data: 0
                        }]);
                    }
                    await send(bot, service, chatId, fixText(text), {
                        reply_markup: {
                          inline_keyboard: menu
                        },
                        parse_mode: "HTML"
                    }, async function (data, m) {
                        data.ctx.message = m.message_id;
                    }, {
                        ctx: ctx
                    });
                    return;
                }
            } else {
                id = -id;
            }
            if (id == 0) {
                await execRetry(bot, service, chatId, userId);
                return;
            }
            await commonJump(bot, service, userId, chatId, ctx, qm, id);
        }
    }
    return false;
}

async function execMenuWaiting(bot, service, msg) {
    const waiting = await ds.getWaiting(msg.from.id, service, msg.data);
    if (waiting !== null) {
        if (waiting.hide !== null) {
            try {
                await bot.deleteMessage(msg.message.chat.id, waiting.hide);
            } catch (error) {
                console.error(error);
            }
        }
        if (waiting.param) {
            await ds.setWaitingParam(waiting.ctx, msg.data);
            await ds.setNextAction(waiting.ctx);
        } else {
            await ds.chooseItem(waiting.ctx, msg.data);
        }
        await execCommands(bot, service);
        return true;
    }
    return false;
}

async function execRetry(bot, service, chatId, id) {
    const ctx = await hash.getContext(id, service);
    if (ctx) {
        const qm = await hash.getQm(ctx);
        ctx.message = await questMenu(bot, service, qm, ctx.loc, id, chatId, ctx);
    }
}

async function execDump(bot, chatId, service, id) {
    try {
        const ctx = await hash.getContext(id, service);
        if (ctx) {
            const qm  = await hash.getQm(ctx);
            qm.locations = qm.locations.sort(function (a, b) {
                return a.id - b.id;
            });
            qm.jumps = qm.jumps.sort(function (a, b) {
                return a.id - b.id;
            });
            const s = JSON.stringify(qm, undefined, 2);
            fs.writeFileSync(__dirname + '/../upload/quest.json', s);
            bot.sendDocument(chatId, __dirname + '/../upload/quest.json');
        }
    } catch (error) {
        console.error(error);
    }
}

async function execWrite(bot, chatId, service, id) {
    try {
        const ctx = await hash.getContext(id, service);
        if (ctx) {
            const qm  = await hash.getQm(ctx);
            const buf = qmm.writeQmm(qm);
            fs.writeFileSync(__dirname + '/upload/quest.qmm', buf);
            bot.sendDocument(chatId, __dirname + '/upload/quest.qmm');
        }
    } catch (error) {
        console.error(error);
    }
}

async function execSave(bot, chatId, service, id) {
    try {
        const ctx = await hash.getContext(id, service);
        if (ctx) {
            const qm = await hash.getQm(ctx);
            const buf = writer.saveCtx(ctx, qm);
            const d = new Date();
            const r = ctx.name.match(/^([^.]+)\./);
            if (r) {
                const name = r[1] + '_' + d.getHours() + '_' + d.getMinutes() + '_' + d.getSeconds();
                fs.writeFileSync(__dirname + '/upload/' + name + '.qms', buf);
                await bot.sendDocument(chatId, __dirname + '/upload/' + name + '.qms');
                fs.unlinkSync(__dirname + '/upload/' + name + '.qms');
            }
        }
    } catch (error) {
        console.error(error);
    }
}

async function uploadFile(bot, uid, service, doc, username, chatId) {
    if (doc.document.file_name.match(/\.qms?$/i)) {
        const name = await bot.downloadFile(doc.document.file_id, __dirname + '/upload/');
        const r = name.match(/([^.\/\\]+)(\.qms?)$/i);
        if (r) {
            const data = fs.readFileSync(__dirname + '/upload/' + r[1] + r[2]);
            try {
                const save = loader.restore(data);
                const ctx = await hash.load(save.name, username);
                if (ctx) {
                    const user = await ds.getUserByUid(uid);
                    await closeQuestContexts(bot, service, user.id, doc.chat.id);
                    for (let i = 0; i < save.params.length; i++) {
                        ctx.params[i].value  = save.params[i].value;
                        ctx.params[i].hidden = save.params[i].hidden;
                    }
                    const qm = await hash.getQm(ctx);
                    for (let i = 0; i < qm.locations.length; i++) {
                        if (qm.locations[i].id == save.loc) {
                            ctx.loc = i;
                            break;
                        }
                    }
                    hash.addContext(uid, service, ctx);
                    ctx.message = await questMenu(bot, service, qm, ctx.loc, uid, chatId, ctx);
                }
            } catch (error) {
                console.error(error);
            }
        }
        fs.unlinkSync(name);
    }
    if (doc.document.file_name.match(/\.qmm?$/i)) {
        const name = await bot.downloadFile(doc.document.file_id, __dirname + '/upload/');
        const r = name.match(/([^.\/\\]+)(\.qmm?)$/i);
        if (r) {
            const data = fs.readFileSync(__dirname + '/upload/' + r[1] + r[2]);
            try {
                const qm = parser.parse(data);
                let moneyParam = null;
                for (let i = 0; i < qm.params.length; i++) {
                     if (qm.params[i].isMoney) {
                         moneyParam = i;
                         break;
                     }
                }
                const id = await ds.uploadScript(uid, service, r[1], r[1] + r[2], moneyParam);
                if (qm.taskText) {
                    const text = await replaceStrings(qm.taskText, qm, undefined, true);
                    await ds.questText(id, 1, text);
                }
                if (qm.successText) {
                    const text = await replaceStrings(qm.successText, qm, undefined, true);
                    await ds.questText(id, 1, text);
                }
                await send(bot, service, doc.chat.id, 'Сценарий [' + r[1] + r[2] + '] загружен', undefined, undefined, undefined);
            } catch (error) {
                console.error(error);
                fs.unlinkSync(name);
            }
        } else {
            fs.unlinkSync(name);
        }
    }
    if (doc.document.file_name.match(/\.(png|gif)$/i)) {
        const name = await bot.downloadFile(doc.document.file_id, __dirname + '/upload/');
        const r = name.match(/([^\/\\]+)$/);
        if (r) {
            await ds.uploadImage(uid, service, doc.document.file_name, r[1]);
            await send(bot, service, doc.chat.id, 'Рисунок [' + r[1] + '] загружен', undefined, undefined, undefined);
        } else {
            fs.unlinkSync(name);
        }
    }
}

async function setMenu(bot, user, service) {
    const commands = await ds.getCommands(user, service);
    let menu = [];
    for (let i = 0; i < commands.length; i++) {
        if (commands[i].visible) {
            menu.push({
                command: commands[i].name,
                description: commands[i].description
            });
        }
    }
    if (menu.length > 0) {
        try {
            bot.setMyCommands(menu);
        } catch (error) {
            console.error(error);
        }
    }
}

async function execCommand(bot, user, service, cmd, r) {
    const commands = await ds.getCommands(user, service);
    let c = null;
    for (let i = 0; i < commands.length; i++) {
        if (commands[i].name == cmd) {
            c = commands[i].id;
        }
    }
    if (c !== null) {
        const params = await ds.getCommandParams(c);
        const ctx = await ds.addCommand(user, service, c);
        for (let j = 0; j < params.length; j++) {
            let v = params[j].value;
            if (r[params[j].rn + 1]) {
                v = r[params[j].rn + 1];
            }
            if (j == params.length - 1) {
                for (let i = params[j].rn + 2; i < r.length; i++) {
                    if (r[i] === undefined) break;
                    v = v + ' ' + r[i];
                }
            }
            if (v) {
                await ds.setParamValue(ctx, params[j].id, v);
            }
        }
        await ds.startCommand(ctx);
        await execCommands(bot, service);
        return true;
    }
    return false;
}

async function execInputWaiting(bot, user, service, msg, chatId) {
    const waiting = await ds.getParamWaiting(user, service);
    if (waiting !== null) {
        if (waiting.hide !== null) {
            try {
                await bot.deleteMessage(chatId, waiting.hide);
            } catch (error) {
                console.error(error);
            }
        }
        await ds.setWaitingParam(waiting.ctx, msg.text);
        await ds.setNextAction(waiting.ctx);
        return;
    }
}

async function execMessage(bot, msg, user, service) {
    const isBlack = await ds.inBlackList(msg.chat.id);
    if (isBlack) return;
    let reply_msg = null;
    if (msg.reply_to_message) {
        reply_msg = await ds.getParentMessage(msg.reply_to_message.message_id);
    }
    const parent_id = await ds.saveMessage(msg.message_id, user, service, msg.from.language_code, msg.text, (reply_msg === null) ? null : reply_msg.id);
    if (reply_msg !== null) {
        await send(bot, service, reply_msg.chat_id, msg.text, { reply_to_message_id: reply_msg.id }, async function (data, m) {
            await ds.saveClientMessage(data.parent, m.message_id);
            if (logLevel & 2) {
                console.log(m);
            }
        }, {
            parent: parent_id
        });
        return;
    }
    const text = await ds.decorateMessage(user, msg.text);
    const admin = await ds.isAdmin(user);
    if (admin) {
        const ids = await ds.getChatsByLang(service, msg.from.language_code);
        for (let j = 0; j < ids.length; j++) {
            await send(bot, service, ids[j], msg.text, undefined, async function (data, m) {
                await ds.saveClientMessage(data.parent, m.message_id);
                if (logLevel & 2) {
                    console.log(m);
                }
            }, {
                parent: parent_id
            });
        }
    } else {
        const ids = await ds.getAdminChats();
        for (let j = 0; j < ids.length; j++) {
             await send(bot, service, ids[j], text, undefined, async function (data, m) {
                await ds.saveClientMessage(data.parent, m.message_id);
                if (logLevel & 2) {
                    console.log(m);
                }
            }, {
                parent: parent_id
            });
        }
    }
}

async function showJumps(id, service, order) {
    const ctx = await hash.getContext(id, service);
    if (ctx !== null) {
        const qm = await hash.getQm(ctx);
        if (qm) {
            for (let i = 0; i < qm.jumps.length; i++) {
                if (qm.jumps[i].fromLocationId != qm.locations[ctx.loc].id) continue;
                if (order) {
                    if (qm.jumps[i].showingOrder != order) continue;
                }
                console.log(qm.jumps[i]);
            }
        }
    }
}

async function showParams(id, service) {
    const ctx = await hash.getContext(id, service);
    if (ctx !== null) {
        for (let i = 0; i < ctx.params.length; i++) {
            console.log(ctx.params[i]);
        }
    }
}

async function showParameters(id, service, ix) {
    const ctx = await hash.getContext(id, service);
    if (ctx !== null) {
        const qm = await hash.getQm(ctx);
        if (qm) {
            if (ix === undefined) {
                console.log(qm.params);
            } else {
                console.log(qm.params[ix]);
            }
        }
    }
}

async function showLocation(id, service) {
    const ctx = await hash.getContext(id, service);
    if (ctx !== null) {
        const qm = await hash.getQm(ctx);
        if (qm) {
            console.log(qm.locations[ctx.loc]);
        }
    }
}

async function showLocationId(bot, msg, id, service) {
    const ctx = await hash.getContext(id, service);
    if (ctx !== null) {
        const qm = await hash.getQm(ctx);
        if (qm) {
            await send(bot, service, msg.chat.id, 'Location ID: ' + qm.locations[ctx.loc].id, undefined, undefined, undefined);
        }
    }
}

async function execSet(id, service, name, value) {
    const ctx = await hash.getContext(id, service);
    if (ctx) {
        if (name == 'Money') {
            ctx.money = value;
            return;
        }
        if (name == 'Ranger') {
            ctx.username = value;
            return;
        }
        for (let i = 0; i < ctx.params.length; i++) {
            if (name == 'p' + (i + 1)) {
                if (ctx.params[i].min > value) return;
                if (ctx.params[i].max < value) return;
                ctx.params[i].value = +value;
                return;
            }
        }
    }
}

async function sendInfo(bot, user, chatId, service) {
    const info = await ds.getInfoMessages(user, service);
    for (let i = 0; i < info.length; i++) {
        await send(bot, service, chatId, fixText(info[i].text), {
            parse_mode: "HTML"
        }, async function (data) {
            await ds.acceptInfo(data.user, data.info);
        }, {
            info: info[i].id,
            user: user
        });

    }
}

async function execScore(bot, service, chatId, uid) {
    const score = await ds.getScore(uid);
    let s = '<fix><format=left,20>win</format><format=left,25>lose</format><format=left,30>death</format><format=left,36>all</format><br>';
    for (let i = 0; i < score.length; i++) {
        if (score[i].name) {
            s = s + score[i].name;
        } else {
            s = s + 'Итого:';
        }
        s = s + '<format=left,20>' + score[i].win + '</format>';
        s = s + '<format=left,25>' + score[i].lose + '</format>';
        s = s + '<format=left,30>' + score[i].death + '</format>';
        s = s + '<format=left,36>' + score[i].launch + '</format>';
        s = s + '<br>';
    }
    const credits = await ds.getCredits(uid);
    if (credits !== null) {
        s = s + '<br>Credits: ' + credits;
    }
    s = s + '</fix>';
    await send(bot, service, chatId, fixText(s), {
        parse_mode: "HTML"
    }, undefined, undefined);
}

module.exports.logLevel = logLevel;
module.exports.execCalc = execCalc;
module.exports.execLoad = execLoad;
module.exports.execJump = execJump;
module.exports.execMenuWaiting = execMenuWaiting;
module.exports.execRetry = execRetry;
module.exports.execWrite = execWrite;
module.exports.execSave = execSave;
module.exports.uploadFile = uploadFile;
module.exports.setMenu = setMenu;
module.exports.execCommand = execCommand;
module.exports.execInputWaiting = execInputWaiting;
module.exports.execMessage = execMessage;
module.exports.getIntervalTimeout = getIntervalTimeout;
module.exports.setLog = setLog;
module.exports.retry = retry;
module.exports.showLocationId = showLocationId;
module.exports.showLocation = showLocation;
module.exports.showParameters = showParameters;
module.exports.showParams = showParams;
module.exports.showJumps = showJumps;
module.exports.execSet = execSet;
module.exports.sendInfo = sendInfo;
module.exports.execScore = execScore;
module.exports.execDump = execDump;
