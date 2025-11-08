"use strict";

const db = require('./database.js');

async function getServices() {
    try {
      let r = [];
      const x = await db.query(
        `select id, token from service where enabled`);
      for (let i = 0; i < x.rows.length; i++) {
          r.push({
            id: +x.rows[i].id,
            token: x.rows[i].token
          });
      }
      return r;
    } catch (error) {
      console.error(error);
    }
}

async function updateAccount(serv, uid, name, chat, first, last, lang) {
  try {
    const x = await db.query(
      `select updateAccount($1, $2, $3, $4, $5, $6, $7) as id`, [serv, uid, name, chat, first, last, lang]);
    return x.rows[0].id;
  } catch (error) {
    console.error(error);
  }
}

async function isDeveloper(user, service) {
  try {
    const x = await db.query(`select is_developer from user_service where user_id = $1 and service_id = $2`, [user, service]);
    if (!x || x.rows.length == 0) return false;
    return x.rows[0].is_developer;
  } catch(error) {
    console.error(error);
  }
}

function Context(id, filename, username, loc, user_id, script_id) {
  return {
    id: id,
    filename: filename,
    username: username,
    loc: loc,
    user_id: user_id,
    script_id: script_id
  };
}

async function loadContext(uid, service) {
  try {
    const x = await db.query(`select id, filename, username, location_id, user_id, script_id from context_vw where user_id = $1 and service_id = $2`, [uid, service]);
    if (!x || x.rows.length == 0) return null;
    return Context(x.rows[0].id, x.rows[0].filename, x.rows[0].username, x.rows[0].location_id, x.rows[0].user_id, x.rows[0].script_id);
  } catch (error) {
    console.error(error);
  }
}

function ContextParam(ix, value, hidden) {
  return {
    ix: ix,
    value: value,
    hidden: hidden
  };
}

async function loadContextParams(ctx) {
  try {
    let r = [];
    const x = await db.query(`select a.ix, a.value, a.hidden from param_value a where a.context_id = $1 order by a.ix`, [ctx]);
    for (let i = 0; i < x.rows.length; i++) {
       r.push(ContextParam(+x.rows[i].ix, +x.rows[i].value, x.rows[i].hidden));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function saveQuestLoc(ctx, loc) {
  try {
    await db.query(`select saveQuestLocation($1, $2)`, [ctx, loc]);
  } catch (error) {
    console.error(error);
  }
}

async function saveQuestParamValue(ctx, ix, value, hidden) {
  try {
    await db.query(`select saveQuestParamValue($1, $2, $3, $4)`, [ctx, ix, value, hidden]);
  } catch (error) {
    console.error(error);
  }
}

function Fixup(id, num, value) {
  return {
    id: id,
    num: num,
    value: value
  };
}

async function getFixups(script, ctx) {
  try {
    let r = [];
    const x = await db.query(`select a.user_id, a.service_id from user_context a where a.id = $1`, [ctx]);
    if (!x || x.rows.length == 0) return r;
    const y = await db.query(`
       select b.id, a.param_num - 1 as ix, coalesce(c.value, b.def_value) as value
       from   global_fixup a
       inner  join global_param b on (b.id = a.param_id and b.service_id = $1)
       left   join global_value c on (c.param_id = b.id and c.user_id = $2 and c.script_id is null)
       where  a.script_id = $3`, [x.rows[0].service_id, x.rows[0].user_id, script]);
    for (let i = 0; i < y.rows.length; i++) {
       r.push(Fixup(+y.rows[i].id, +y.rows[i].ix, +y.rows[i].value));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function setGlobalValue(user, param, type, script, value, limit) {
  try {
    await db.query(`select setGlobalValue($1, $2, $3, $4, $5, $6)`, [user, param, type, script, value, limit]);
  } catch (error) {
    console.error(error);
  }
}

async function winQuest(user, script) {
  try {
    await db.query(`select winQuest($1, $2)`, [user, script]);
  } catch (error) {
    console.error(error);
  }
}

async function failQuest(user, script) {
  try {
    await db.query(`select failQuest($1, $2)`, [user, script]);
  } catch (error) {
    console.error(error);
  }
}

async function deathQuest(user, script) {
  try {
    await db.query(`select deathQuest($1, $2)`, [user, script]);
  } catch (error) {
    console.error(error);
  }
}

async function closeContext(id) {
  try {
    await db.query(`select closeContext($1)`, [id]);
  } catch (error) {
    console.error(error);
  }
}

function Waiting(ctx, param, hide) {
  return {
    ctx: ctx,
    param: param,
    hide: hide
  };
}

async function getWaiting(user, service, action) {
  try {
    const x = await db.query(`select id from users where user_id = $1`, [user]);
    if (!x || x.rows.length == 0) return null;
    let y = await db.query(`select ctx, param_id, hide_id, user_id, service_id from context_action_vw where user_id = $1 and service_id = $2`, [x.rows[0].id, service]);
    if (!y || y.rows.length == 0) {
      y = await db.query(`select ctx, param_id, hide_id from waiting_vw where user_id = $1 and service_id = $2 and action_id = $3`, [x.rows[0].id, service, action]);
    }
    if (!y || y.rows.length == 0) return null;
    return Waiting(+y.rows[0].ctx, +y.rows[0].param_id, +y.rows[0].hide_id);
  } catch (error) {
    console.error(error);
  }
}

async function setWaitingParam(ctx, value) {
  try {
    await db.query(`select setWaitingParam($1, $2)`, [ctx, value]);
  } catch (error) {
    console.error(error);
  }
}

async function setNextAction(ctx) {
  try {
    await db.query(`select * from setNextAction($1)`, [ctx]);
  } catch (error) {
    console.error(error);
  }
}

async function chooseItem(ctx, action) {
  try {
    await db.query(`select chooseItem($1, $2)`, [ctx, action]);
  } catch (error) {
    console.error(error);
  }
}

function Command(id, name, description, visible) {
  return {
    id: id,
    name: name,
    description: description,
    visible: visible
  };
}

async function getCommands(user, service) {
  try {
    let r = [];
    const x = await db.query(`select is_developer, lang from user_service_vw where user_id = $1 and service_id = $2`, [user, service]);
    if (!x || x.rows.length == 0) return r;
    const y = await db.query(`
       select a.id, a.name, coalesce(b.value, c.value) as description, a.is_visible
       from   command a
       left   join localized_string b on (b.command_id = a.id and b.lang = $1)
       inner  join localized_string c on (c.command_id = a.id and c.lang = 'en')
       where  coalesce(a.service_id, $2) = $3
       order  by a.order_num`, [x.rows[0].lang, service, service]);
    for (let i = 0; i < y.rows.length; i++) {
       r.push(Command(+y.rows[i].id, y.rows[i].name, y.rows[i].description, y.rows[i].is_visible));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function SpParam(id, name, value, rn) {
  return {
    id: id,
    name: name,
    value: value,
    rn: rn
  };
}

async function getCommandParams(command) {
  try {
    let r = [];
    const x = await db.query(`select id, name, default_value, order_num, rn from command_param_vw where command_id = $1 order by order_num`, [command]);
    for (let i = 0; i < x.rows.length; i++) {
       r.push(SpParam(+x.rows[i].id, x.rows[i].name, x.rows[i].default_value, +x.rows[i].rn));
    }
    return r;
  }  catch(error) {
    console.error(error);
  }
}

async function addCommand(user, service, command) {
  try {
    const x = await db.query(`select addCommand($1, $2, $3) as id`, [user, service, command]);
    return x.rows[0].id;
  } catch (error) {
    console.error(error);
  }
}

async function setParamValue(ctx, param, value) {
  try {
    await db.query(`select setParamValue($1, $2, $3)`, [ctx, param, value]);
  } catch (error) {
    console.error(error);
  }
}

async function startCommand(ctx) {
  try {
    await db.query(`select startCommand($1)`, [ctx]);
  } catch (error) {
    console.error(error);
  }
}

async function setFirstAction(ctx, action) {
  try {
    await db.query(`select * from setFirstAction($1, $2)`, [ctx, action]);
  } catch (error) {
    console.error(error);
  }
}

async function replacePatterns(ctx, value) {
  let r = value.match(/{(\S+)}/);
  while (r) {
    const name = r[1];
    const x = await db.query(
      `select c.default_value as value, c.id from param_type c where c.name = $1`, [name]);
    if (!x && x.rows.length == 0) continue;
    const y = await db.query(
      `select coalesce(b.value, $1) as value
       from   user_context a
       left   join param_value b on (b.context_id = a.id and b.param_id = $2)
       where  a.id = $3`, [x.rows[0].value, x.rows[0].id, ctx]);
    let v = '';
    if (y && y.rows.length > 0) v = y.rows[0].value;
    value = value.replace('{' + name + '}', v);
    r = value.match(/{(\S+)}/);
  }
  return value;
}

function Caption(value, chat, lang, width, param) {
  return {
    value: value,
    chat: chat,
    lang: lang,
    width: width,
    param: param
  };
}

async function getCaption(ctx) {
  try {
    const x = await db.query(`select value, chat_id, param_id, lang, width from caption_vw where id = $1`, [ctx]);
       if (!x || x.rows.length == 0) return null;
       let value = await replacePatterns(ctx, x.rows[0].value);
       return Caption(value, +x.rows[0].chat_id, x.rows[0].lang, +x.rows[0].width, +x.rows[0].param_id);
  } catch (error) {
    console.error(error);
  }
}

async function waitValue(ctx, msg, hide) {
  try {
    await db.query(`select waitValue($1, $2, $3)`, [ctx, msg, hide]);
  } catch (error) {
    console.error(error);
  }
}

async function getParamValue(ctx, param) {
  try {
    const x = await db.query(`
       select a.value from param_value a where a.context_id = $1 and a.param_id = $2`, [ctx, param]);
    if (!x || x.rows.length == 0) return null;
    return x.rows[0].value;
  } catch (error) {
    console.error(error);
  }
}

function MenuItem(id, value) {
  return {
    id: id,
    value: value
  }
}

async function getMenuItems(ctx, menu, lang) {
  try {
    let r = [];
    const x = await db.query(`
       select a.id, c.value, a.order_num
       from   action a
       inner  join localized_string c on (c.action_id = a.id and c.lang = $1)
       where  a.parent_id = $2
       order  by a.order_num`, [lang, menu]);
    for (let i = 0; i < x.rows.length; i++) {
       let value = await replacePatterns(ctx, x.rows[i].value);
       r.push(MenuItem(+x.rows[i].id, value));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function Request(user, service, value, type) {
  return {
    user: user,
    service: service,
    value: value,
    type: type
  };
}

async function getRequest(ctx) {
  try {
    const x = await db.query(`select user_id, service_id, request, request_type from request_vw where id = $1`, [ctx]);
    if (!x || x.rows.length == 0) return null;
    return Request(+x.rows[0].user_id, +x.rows[0].service_id, x.rows[0].request, x.rows[0].request_type);
  } catch (error) {
    console.error(error);
  }
}

function SpParam(id, name, value, rn) {
  return {
    id: id,
    name: name,
    value: value,
    rn: rn
  };
}

/*async function getSpParams(ctx, user, service) {
  try {
    let r = [];
    const x = await db.query(`select id, name, value, order_num, rn from sp_param_vw where ctx_id = $1 order by order_num`, [ctx]);
    for (let i = 0; i < x.rows.length; i++) {
       let value = x.rows[i].value;
       if (x.rows[i].name == 'pUser') {
           value = user;
       }
       if (x.rows[i].name == 'pService') {
           value = service;
       }
       r.push(SpParam(+x.rows[i].id, x.rows[i].name, value, +x.rows[i].rn));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}*/

async function getSpParams(ctx, user, service) {
  try {
    let r = [];
    const x = await db.query(`
       select d.id, c.name, coalesce(coalesce(e.value, d.default_value), c.default_value) as value, c.order_num,
              row_number() over (order by c.order_num) as rn
       from   user_context a
       inner  join action b on (b.command_id = a.command_id and b.id = a.location_id)
       inner  join request_param c on (action_id = b.id)
       left   join param_type d on (d.id = c.param_id)
       left   join param_value e on (e.param_id = d.id and e.context_id = a.id)
       where  a.id = $1
       order  by c.order_num`, [ctx]);
    for (let i = 0; i < x.rows.length; i++) {
       let value = x.rows[i].value;
       if (x.rows[i].name == 'pUser') {
           value = user;
       }
       if (x.rows[i].name == 'pService') {
           value = service;
       }
       r.push(SpParam(+x.rows[i].id, x.rows[i].name, value, +x.rows[i].rn));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function SpResult(name, param) {
  return {
    name: name,
    param: param
  };
}

async function getSpResults(ctx) {
  try {
    let r = [];
    const x = await db.query(`select name, param_id from sp_result_vw where id = $1`, [ctx]);
    for (let i = 0; i < x.rows.length; i++) {
       r.push(SpResult(x.rows[i].name, +x.rows[i].param_id));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function setResultAction(ctx, result) {
  try {
    await db.query(`select setResultAction($1, $2)`, [ctx, result]);
  } catch (error) {
    console.error(error);
  }
}

function Script(id, filename, bonus, penalty) {
  return {
    id: id,
    filename: filename,
    bonus: bonus,
    penalty: penalty
  };
}

async function getScript(id) {
  try {
    const x = await db.query(`select a.id, a.filename, a.win_bonus, a.death_penalty from script a where a.id = $1`, [id]);
    if (!x || x.rows.length == 0) return null;
    return Script(+x.rows[0].id, x.rows[0].filename, +x.rows[0].win_bonus, +x.rows[0].death_penalty);
  } catch (error) {
    console.error(error);
  }
}

function User(id, uid, name, chat) {
  return {
    id: id,
    uid: uid,
    name: name,
    chat: chat
  };
}

async function getUserByUid(uid) {
  try {
    const x = await db.query(`
       select b.id, b.user_id, coalesce(b.firstname, b.username) as name, b.chat_id from users b where b.user_id = $1`, [uid]);
    if (!x || x.rows.length == 0) return null;
    return User(+x.rows[0].id, +x.rows[0].user_id, x.rows[0].name, +x.rows[0].chat_id);
  } catch (error) {
    console.error(error);
  }
}

async function getUserByCtx(ctx) {
  try {
    const x = await db.query(`select id, user_id, name, chat_id from user_ctx_vw where ctx_id = $1`, [ctx]);
    if (!x || x.rows.length == 0) return null;
    return User(+x.rows[0].id, +x.rows[0].user_id, x.rows[0].name, +x.rows[0].chat_id);
  } catch (error) {
    console.error(error);
  }
}

async function createQuestContext(script, ctx, loc) {
  try {
     const x = await db.query(`select createQuestContext($1, $2, $3) as id`, [ctx, script, loc]);
     if (!x || x.rows.length == 0) return null;
     return x.rows[0].id;
  } catch (error) {
    console.error(error);
  }
}

async function getParamWaiting(user, service) {
  try {
    const x = await db.query(`
       select x.ctx, x.param, x.hide
       from ( select a.id as ctx, a.is_waiting, b.param_id as param, a.hide_id as hide,
                     row_number() over (order by a.priority desc) as rn
              from   user_context a
              inner  join action b on (b.command_id = a.command_id and b.id = a.location_id)
              where  a.user_id = $1 and a.service_id = $2
              and    a.closed is null ) x
       where  x.rn = 1 and x.is_waiting`, [user, service]);
    if (!x || x.rows.length == 0) return null;
    return Waiting(+x.rows[0].ctx, +x.rows[0].param, +x.rows[0].hide);
  } catch (error) {
    console.error(error);
  }
}

function Message(id, chat_id) {
  return {
    id: id,
    chat_id: chat_id
  };
}

async function inBlackList(chatId) {
  try {
    const x = await db.query(`
      select count(*) cnt from black_list a where a.chat_id = $1`, [chatId]);
    if (!x || x.rows.length == 0) return false;
    return x.rows[0].cnt > 0;
  } catch (error) {
    console.error(error);
  }
}

async function getParentMessage(id) {
  try {
    const x = await db.query(`select message_id, chat_id from message_vw where id = $1`, [id]);
    if (!x || x.rows.length == 0) return null;
    return Message(x.rows[0].message_id, x.rows[0].chat_id);
  } catch (error) {
    console.error(error);
  }
}

async function saveMessage(id, user, service, lang, data, reply) {
  try {
    const x = await db.query(`select saveMessage($1, $2, $3, $4, $5, $6) as id`, [id, user, service, lang, data, reply]);
    return x.rows[0].id;
  } catch (error) {
    console.error(error);
  }
}

async function isAdmin(id) {
  try {
    const x = await db.query(`select is_admin from users where id = $1`, [id]);
    if (!x || x.rows.length == 0) return false;
    return x.rows[0].is_admin;
  } catch (error) {
    console.error(error);
  }
}

async function getChatsByLang(serv, lang) {
  try {
    let r = [];
    const x = await db.query(`
       select a.chat_id from users a inner join user_service b on (b.user_id = a.id and b.service_id = $1) where a.lang = $2`, [serv, lang]);
    for (let i = 0; i < x.rows.length; i++) {
        r.push(x.rows[i].chat_id);
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function saveClientMessage(parent, id) {
  try {
    await db.query(`insert into client_message(parent_id, message_id) values ($1, $2)`, [parent, id]);
  } catch (error) {
    console.error(error);
  }
}

async function getAdminChats() {
  try {
    let r = [];
    const x = await db.query(`
       select a.chat_id from users a where a.is_admin`);
    for (let i = 0; i < x.rows.length; i++) {
       r.push(x.rows[i].chat_id);
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function ScheduledComand(cmd, timeout) {
  return {
    cmd, cmd,
    timeout: timeout
  };
}

async function getScheduledComands(service) {
  try {
    let r = [];
    const x = await db.query(`select command_id, timeout from scheduled_vw where service_id = $1`, [service]);
    for (let i = 0; i < x.rows.length; i++) {
       r.push(ScheduledComand(x.rows[i].command_id, x.rows[i].timeout));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function Action(ctx, action, type, param, service) {
  return {
    ctx: ctx,
    action: action,
    type: type,
    param: param,
    service: service
  };
}

async function getActions(service) {
  try {
    let r = [];
    const x = await db.query(`select x->>'id' as id, x->>'action_id' as action_id, x->>'type_id' as type_id, x->>'param_id' as param_id, x->>'service_id' as service_id from getActions($1) as x`, [service]);
    for (let i = 0; i < x.rows.length; i++) {
      r.push(Action(+x.rows[i].id, +x.rows[i].action_id, +x.rows[i].type_id, +x.rows[i].param_id, +x.rows[i].service_id));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function Info(id, text) {
  return {
    id: id,
    text: text
  };
}

async function getInfoMessages(user, service) {
  try {
    let r = [];
    const x = await db.query(`
      select a.created, b.lang
      from   user_service a
      inner  join users b on (b.id = a.user_id)
      where  a.user_id = $1 and a.service_id = $2`, [user, service]);
    if (!x || x.rows.length == 0) return r;
    const y = await db.query(`
       select a.id, case
                 when $1 = 'ru' then a.ru
                 else a.en
              end as value
       from   info a
       left   join user_info b on (b.info_id = a.id and b.user_id = $2)
       where  a.service_id = $3 and b.id is null and (a.is_mandatory or a.created > $4)
       and    a.start_from < now() and coalesce(a.end_to, now()) >= now()
       order  by a.created`, [x.rows[0].lang, user, service, x.rows[0].created]);
    for (let i = 0; i < y.rows.length; i++) {
       r.push(Info(y.rows[i].id, y.rows[i].value));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function acceptInfo(user, info) {
  try {
    await db.query(`insert into user_info(user_id, info_id) values ($1, $2)`, [user, info]);
  } catch (error) {
    console.error(error);
  }
}

async function addStat(user, script, stat) {
  try {
    await db.query(`insert into stat(username, script, type_id) values ($1, $2, $3)`, [user, script, stat]);
  } catch (error) {
    console.error(error);
  }
}

async function getQuestText(script, type) {
  try {
    const x = await db.query(`
      select a.value from quest_text a where a.script_id = $1 and a.type_id = $2`, [script, type]);
   if (!x || x.rows.length == 0) return null;
   return x.rows[0].value;
  } catch (error) {
    console.error(error);
  }
}

function UserContext(id, hide) {
  return {
    id: id,
    hide: hide
  };
}

async function getQuestContexts(service, user) {
  try {
    let r = [];
    const x = await db.query(`
      select a.id, a.hide_id from user_context a where a.service_id = $1 and a.user_id = $2 and not a.script_id is null`, [service, user]);
    for (let i = 0; i < x.rows.length; i++) {
        r.push(UserContext(+x.rows[i].id, x.rows[i].hide_id));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

function Score(name, win, lose, death, launch) {
  return {
    name: name,
    win: win,
    lose: lose,
    death: death,
    launch: launch
  };
}

async function getScore(uid) {
  try {
    let r = [];
    const x = await db.query(`select id, lang from users where user_id = $1`, [uid]);
    if (!x || x.rows.length == 0) return r;
    let y = await db.query(`
      select coalesce(y.name, z.name) as name,
             x.win, x.lose, x.death, x.launch
      from ( select a.commonname,
             sum(case
               when b.param_id = 2 then b.value
               else 0
             end) win,
             sum(case
               when b.param_id = 5 then b.value
               else 0
             end) lose,
             sum(case
               when b.param_id = 4 then b.value
               else 0
             end) death,
             sum(case
               when b.param_id = 1 then b.value
               else 0
             end) launch
      from   script a
      inner  join global_value b on (b.script_id = a.id)
      where  b.user_id = $1
      group  by a.commonname ) x
      left   join script y on (y.commonname = x.commonname and y.lang = $2)
      left   join script z on (z.commonname = x.commonname and z.lang = 'en')
      order  by x.launch desc`, [x.rows[0].id, x.rows[0].lang]);
    for (let i = 0; i < y.rows.length; i++) {
        r.push(Score(y.rows[i].name, +y.rows[i].win, +y.rows[i].lose, +y.rows[i].death, +y.rows[i].launch));
    }
    y = await db.query(`
      select sum(case
         when b.param_id = 2 then b.value
         else 0
       end) win,
       sum(case
         when b.param_id = 5 then b.value
         else 0
       end) lose,
       sum(case
         when b.param_id = 4 then b.value
         else 0
       end) death,
       sum(case
         when b.param_id = 1 then b.value
         else 0
       end) launch
      from   global_value b
      where  b.user_id = $1 and b.script_id is null`, [x.rows[0].id]);
    for (let i = 0; i < y.rows.length; i++) {
        r.push(Score('', +y.rows[i].win, +y.rows[i].lose, +y.rows[i].death, +y.rows[i].launch));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function getCredits(uid) {
  try {
    const x = await db.query(`select value from credits_vw where user_id = $1`, [uid]);
    if (!x || x.rows.length == 0) return null;
    return x.rows[0].value;
  } catch (error) {
    console.error(error);
  }
}

function SessInfo(id, userNum, indexParam, startParam, paramCount) {
  return {
    id: id,
    userNum: userNum,
    indexParam: indexParam,
    startParam: startParam,
    paramCount: paramCount
  };
}

async function joinToSession(ctx) {
  try {
    const x = await db.query(`select x->>'id' as id, x->>'user_num' as user_num, x->>'index_param' as index_param, x->>'start_param' as start_param, x->>'param_count' as param_count from joinToSession($1) as x`, [ctx]);
    if (!x || x.rows.length == 0) return null;
    return SessInfo(x.rows[0].id, x.rows[0].user_num, x.rows[0].index_param, x.rows[0].start_param, x.rows[0].param_count);
  } catch (error) {
    console.error(error);
  }
}

function WaitInfo(slotNum, leftUsers) {
  return {
    slotNum: slotNum,
    leftUsers: leftUsers
  };
}

async function addSessionParams(ctx, params) {
  try {
    const x = await db.query(`select x->>'slot' as slot, x->>'left_users' as left_users from addSessionParams($1, $2) as x`, [ctx, params]);
    if (!x || x.rows.length == 0) return null;
    return WaitInfo(x.rows[0].slot, x.rows[0].left_users);
  } catch (error) {
    console.error(error);
  }
}

async function uploadImage(user, service, name, filename) {
  try {
    const x = await db.query(`select uploadImage($1, $2, $3, $4) as id`, [user, service, name, filename]);
    if (!x || x.rows.length == 0) return null;
    return x.rows[0].id;
  } catch (error) {
    console.error(error);
  }
}

async function uploadScript(user, service, name, filename, money) {
  try {
    const x = await db.query(`select uploadScript($1, $2, $3, $4, $5) as id`, [user, service, name, filename, money]);
    if (!x || x.rows.length == 0) return null;
    return x.rows[0].id;
  } catch (error) {
    console.error(error);
  }
}

async function questText(script, type, text) {
  try {
    db.query(`select questText($1, $2, $3) as id`, [script, type, text]);
  } catch (error) {
    console.error(error);
  }
}

async function getImageFileName(uid, name) {
  try {
    const x = await db.query(`
      select b.filename, b.version
      from   users a
      inner  join image b on (b.user_id = a.id)
      where  a.user_id = $1 and name = $2
      order  by b.version desc`, [uid, name]);
    if (!x || x.rows.length == 0) return name;
    return x.rows[0].filename;
  } catch (error) {
    console.error(error);
  }
}

function SessUser(num, name) {
  return {
    num: num,
    name: name
  };
}

async function getSessionUsers(sess) {
  try {
    let r = [];
    const x = await db.query(`select user_num, name from session_vw where id = $1 order by user_num`, [sess]);
    for (let i = 0; i < x.rows.length; i++) {
      r.push(SessUser(x.rows[i].user_num, x.rows[i].name));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function isCompletedSession(sess) {
  try {
    const x = await db.query(`select id from completed_session_vw where id = $1`, [sess]);
      if (!x || x.rows.length == 0) return false;
      return true;
  } catch (error) {
    console.error(error);
  }
}

function SessParam(num, ix, value) {
  return {
    num: num,
    ix: ix,
    value: value
  };
}

async function getSessionParams(sess, slot) {
  try {
    let r = [];
    const x = await db.query(`select b.user_num, a.param_index, a.param_value from session_param_vw where session_id = $1 and slot_index = $2`, [sess, slot]);
    for (let i = 0; i < x.rows.length; i++) {
      r.push(SessParam(x.rows[i].user_num, x.rows[i].param_index, x.rows[i].param_value));
    }
    return r;
  } catch (error) {
    console.error(error);
  }
}

async function getUserLang(uid) {
  try {
    const x = await db.query(`select a.lang from users a where a.user_id = $1`, [uid]);
    if (!x || x.rows.length == 0) return 'en';
    return x.rows[0].lang;
  } catch (error) {
    console.error(error);
  }
}

async function decorateMessage(user, text) {
  try {
    let r = '';
    const x = await db.query(`
      select coalesce(a.username, a.firstname) as username from users a where a.id = $1`, [user]);
    if (x && x.rows.length > 0) {
        r = x.rows[0].username;
    }
    const y = await db.query(`select loc from decorate_vw where user_id = $1`, [user]);
    if (y && y.rows.length > 0) {
          r = r + '[' + y.rows[0].loc + ']';
    }
    if (r != '') {
        r = r + ': ';
    }
    return r + text;
  } catch (error) {
    console.error(error);
  }
}

module.exports.getServices = getServices;
module.exports.updateAccount = updateAccount;
module.exports.isDeveloper = isDeveloper;
module.exports.loadContext = loadContext;
module.exports.loadContextParams = loadContextParams;
module.exports.saveQuestLoc = saveQuestLoc;
module.exports.saveQuestParamValue = saveQuestParamValue;
module.exports.getFixups = getFixups;
module.exports.setGlobalValue = setGlobalValue;
module.exports.winQuest = winQuest;
module.exports.failQuest = failQuest;
module.exports.deathQuest = deathQuest;
module.exports.closeContext = closeContext;
module.exports.getWaiting = getWaiting;
module.exports.setWaitingParam = setWaitingParam;
module.exports.setNextAction = setNextAction;
module.exports.chooseItem = chooseItem;
module.exports.getCommands = getCommands;
module.exports.getCommandParams = getCommandParams;
module.exports.addCommand = addCommand;
module.exports.setParamValue = setParamValue;
module.exports.startCommand = startCommand;
module.exports.setFirstAction = setFirstAction;
module.exports.getCaption = getCaption;
module.exports.waitValue = waitValue;
module.exports.getParamValue = getParamValue;
module.exports.getMenuItems = getMenuItems;
module.exports.getRequest = getRequest;
module.exports.getSpParams = getSpParams;
module.exports.getSpResults = getSpResults;
module.exports.setResultAction = setResultAction;
module.exports.getScript = getScript;
module.exports.getUserByUid = getUserByUid;
module.exports.getUserByCtx = getUserByCtx;
module.exports.createQuestContext = createQuestContext;
module.exports.getParamWaiting = getParamWaiting;
module.exports.getParentMessage = getParentMessage;
module.exports.saveMessage = saveMessage;
module.exports.isAdmin = isAdmin;
module.exports.getChatsByLang = getChatsByLang;
module.exports.saveClientMessage = saveClientMessage;
module.exports.getAdminChats = getAdminChats;
module.exports.getScheduledComands = getScheduledComands;
module.exports.getActions = getActions;
module.exports.getInfoMessages = getInfoMessages;
module.exports.acceptInfo = acceptInfo;
module.exports.getQuestText = getQuestText;
module.exports.getQuestContexts = getQuestContexts;
module.exports.getScore = getScore;
module.exports.getCredits = getCredits;
module.exports.joinToSession = joinToSession;
module.exports.addSessionParams = addSessionParams;
module.exports.uploadImage = uploadImage;
module.exports.uploadScript = uploadScript;
module.exports.questText = questText;
module.exports.getImageFileName = getImageFileName;
module.exports.getSessionUsers = getSessionUsers;
module.exports.isCompletedSession = isCompletedSession;
module.exports.getSessionParams = getSessionParams;
module.exports.getUserLang = getUserLang;
module.exports.decorateMessage = decorateMessage;
module.exports.inBlackList = inBlackList;
module.exports.addStat = addStat;
