"use strict";

const fs = require('fs');

const formula = require('./macro.js');
const parser = require('./qm/qmreader.js');
const ds = require('./data-source');

const MAX_SLOTS = 5;

let hash = [];
let ctxs = [];

function getValue(ctx, ix) {
    if (ctx.params[ix]) {
        return ctx.params[ix].value;
    } else {
        return null;
    }
}

async function setLoc(ctx, loc) {
    if (ctx.loc != loc) {
        ctx.loc = loc;
        if (ctx.id !== null) {
            await ds.saveQuestLoc(ctx.id, loc);
        }
    }
}

async function setValue(ctx, ix, value) {
    if ((ix < 0) || (ix >= ctx.params.length)) return;
    if (ctx.params[ix].max < value) value = ctx.params[ix].max;
    if (ctx.params[ix].min > value) value = ctx.params[ix].min;
    if (ctx.params[ix].value != value) {
        ctx.params[ix].value = value;
        if (ctx.id !== null) {
            await ds.saveQuestParamValue(ctx.id, ix, ctx.params[ix].value, ctx.params[ix].hidden);
        }
    }
}

async function setHidden(ctx, ix, hidden) {
    if ((ix < 0) || (ix >= ctx.params.length)) return;
    if (ctx.params[ix].hidden != hidden) {
        ctx.params[ix].hidden = hidden;
        if (ctx.id !== null) {
            await ds.saveQuestParamValue(ctx.id, ix, ctx.params[ix].value, ctx.params[ix].hidden);
        }
    }
}

function QmContext(name, loc, ix, username) {
    return {
        name: name,
        loc: loc,
        ix: ix,
        username: username,
        params: [],
        jumps: [],
        locs: [],
        message: null,
        id: null,
        script: null,
        user: null,
        money: 1000,
        penalty: null,
        messageId: null,
        fixed: '',
        old: '',
        date: new Date(),
        session: null,
        timeout: 0,
        indexParam: null,
        startParam: null,
        paramCount: 0
     }
}

function QmParam(name, min, max, value) {
    return {
        title: name,
        min: min,
        max: max,
        value: value,
        hidden: true
    };
}

function addContext(uid, service, ctx) {
    if (ctxs[uid] === undefined) {
        ctxs[uid] = [];
    }
    ctxs[uid][service] = ctx;
}

async function getContext(uid, service) {
    if ((ctxs[uid] === undefined) || (ctxs[uid][service] === undefined)) {
        const context = await ds.loadContext(uid, service);
        if (context === null) return null;
        const ctx = await load(context.filename, context.username);
        ctx.id     = context.id;
        ctx.loc    = context.loc;
        ctx.user   = context.user_id;
        ctx.script = context.script_id;
        const params = await ds.loadContextParams(ctx.id);
        for (let i = 0; i < params.length; i++) {
            ctx.params[params[i].ix].value  = params[i].value;
            ctx.params[params[i].ix].hidden = params[i].hidden;
        }
        addContext(uid, service, ctx);
    }
    return ctxs[uid][service];
}

async function getQm(ctx) {
    try {
        if ((ctx.ix >= hash.length) || (hash[ctx.ix].name != ctx.name)) {
            const x = await load(ctx.name, ctx.username);
            ctx.ix = x.ix;
        }
        hash[ctx.ix].date = new Date();
        return hash[ctx.ix].qm;
    } catch (error) {
        console.error(error);
    }
}

async function load(name, username) {
    try {
        let ix = null;
        const data = fs.readFileSync(__dirname + '/upload/' + name);
        for (let i = 0; i < hash.length; i++) {
             if (hash[i].name == name) {
                 hash[i].date = new Date();
                 const ctx = QmContext(hash[i].name, hash[i].loc, i, username);
                 const qm = parser.parse(data);
                 for (let i = 0; i < qm.params.length; i++) {
                    let v = 0;
                    if (qm.params[i].starting != '[') {
                       v = await formula.calc(qm.params[i].starting, []);
                    }
                    ctx.params.push(QmParam(qm.params[i].name, +qm.params[i].min, +qm.params[i].max, v));
                 }
                 return ctx;
             }
             if ((ix === null) || (hash[ix].date > hash[i].date)) {
                 ix = i;
             }
        }
        const qm = parser.parse(data);
        await ds.addStat(username, name, 1);
        let loc = null;
        for (let i = 0; i < qm.locations.length; i++) {
            if (qm.locations[i].isStarting) {
                loc = i;
                break;
            }
        }
        if (hash.length < MAX_SLOTS) {
            ix = hash.length;
            hash.push({
                name: name,
                loc: loc,
                qm: qm,
                date: new Date()
            });
        } else {
            hash[ix].name = name;
            hash[ix].loc = loc;
            hash[ix].qm = qm;
            hash[ix].date = new Date();
        }
        const ctx = new QmContext(name, loc, ix, username);
        for (let i = 0; i < qm.params.length; i++) {
            let v = 0;
            if (qm.params[i].starting != '[') {
               v = await formula.calc(qm.params[i].starting, []);
            }
            const p = QmParam(qm.params[i].name, +qm.params[i].min, +qm.params[i].max, v);
            ctx.params.push(p);
        }
        return ctx;
    } catch (error) {
       console.error(error);
    }
}

module.exports.load = load;
module.exports.getQm = getQm;
module.exports.addContext = addContext;
module.exports.getContext = getContext;
module.exports.getValue = getValue;
module.exports.setLoc = setLoc;
module.exports.setValue = setValue;
module.exports.setHidden = setHidden;
