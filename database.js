"use strict";

const { Pool } = require("pg");

const config = {
    host: '127.0.0.1',
    user: 'user',     
    password: 'pass',
    database: 'dagaz-quest',
    port: 5432
};

let connection = null;

async function connect() {
    if (connection === null) {
        connection = new Pool(config);
        try {
            await connection.connect();
        } catch (error) {
            console.error(error);
            connection = null;
        }
    }
    return connection;
}

async function query(sql, params) {
    let r = null;
    try {
        const c = await connect();
        r = await c.query(sql, params);
    } catch (error) {
        console.error(error);
    }
    return r;
}

module.exports.connect = connect;
module.exports.query = query;
