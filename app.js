"use strict";

const TelegramBot = require('node-telegram-bot-api');

const ds = require('./data-source');
const utils = require('./utils');

let job = async function(bot, service) {
    await utils.retry(bot, service);
    setTimeout(job, utils.getIntervalTimeout(), bot, service);
}

async function init() {
    const services = await ds.getServices();
    for (let i = 0; i < services.length; i++) {
         const service = services[i].id;
         const bot = new TelegramBot(services[i].token, { polling: {
             interval: 500,
             autoStart: true
         }});
         bot.on('document', async doc => {
            const username = doc.from.first_name ? doc.from.first_name : doc.from.username;
            const userId = doc.from.id;
            const chatId = doc.chat.id;
            if (utils.logLevel & 1) {
                console.log(doc);
            }
            await utils.uploadFile(bot, userId, service, doc, username, chatId);
          });
          bot.on('text', async msg => {
            const username = msg.from.first_name ? msg.from.first_name : msg.from.username;
            const userId = msg.from.id;
            const chatId = msg.chat.id;
            const user = await ds.updateAccount(service, userId, msg.from.username, chatId, msg.from.first_name, msg.from.last_name, msg.from.language_code);
            await utils.sendInfo(bot, user, msg.chat.id, services[i].id);
            let cmd = null;
            const r = msg.text.match(/^\/(\w+)\s*(\S+)?\s*(\S+)?\s*(\S+)?\s*(\S+)?\s*(\S+)?/);
            if (r) {
                cmd = r[1];
            }
            try {
                const developer = await ds.isDeveloper(user, service);
                if (developer) {
                    if ((cmd == 'calc') && r[2]) {
                        await utils.execCalc(bot, msg, service, r);
                        return;
                    }
                    if ((cmd == 'load') && r[2]) {
                        await utils.execLoad(bot, r[2], chatId, userId, service, username);
                        return;
                    }
                    if (cmd == 'write') {
                        await utils.execWrite(bot, chatId, service, userId);
                        return;
                    }
                    if (cmd == 'dump') {
                        await utils.execDump(bot, msg.chat.id, services[i].id, msg.from.id);
                        return;
                    }
                    if ((cmd == 'set') && r[2] && r[3]) {
                        await utils.execSet(userId, service, r[2], r[3]);
                        return;
                    }
                    if ((cmd == 'show') && r[2]) {
                        if (r[2] == 'jumps') await utils.showJumps(userId, service, r[3]);
                        if (r[2] == 'params') await utils.showParams(userId, service);
                        if (r[2] == 'loc') await utils.showLocation(userId, service);
                        if (r[2] == 'id') await utils.showLocationId(bot, msg, userId, service);
                        if (r[2] == 'parameters') await utils.showParameters(userId, service, r[3]);
                        return;
                    }
                    if ((cmd == 'log') && r[2]) {
                        utils.setLog(r[2]);
                        return;
                    }
                }
                if (cmd == 'score') {
                    await utils.execScore(bot, services[i].id, msg.chat.id, msg.from.id);
                    return;
                }
                if (cmd == 'retry') {
                    await utils.execRetry(bot, service, chatId, userId);
                    return;
                }
                if (cmd == 'save') {
                    await utils.execSave(bot, chatId, service, userId);
                    return;
                }
                await utils.setMenu(bot, user, service);
                if (await utils.execCommand(bot, user, service, cmd, r)) {
                    await utils.setMenu(bot, user, service);
                    return;
                }
                await utils.execInputWaiting(bot, user, service, msg, chatId);
                if (cmd === null) {
                    await utils.execMessage(bot, msg, user, service);
                }
            } catch (error) {
                console.error(error);
            }
         });
         bot.on('callback_query', async msg => {
            const userId = msg.from.id;
            const chatId = msg.message.chat.id;
            if (utils.logLevel & 1) {
                console.log(msg);
            }
            try {
                if (await utils.execMenuWaiting(bot, service, msg)) return;
                if (await utils.execJump(bot, chatId, userId, service, msg)) return;
            } catch (error) {
                console.error(error);
            }
        });
        await job(bot, services[i].id);
    }
}

init();