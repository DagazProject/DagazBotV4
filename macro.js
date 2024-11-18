"use strict";

const formula = require('./qm/formula/index.js');
const random = require('./qm/randomFunc.js');

async function calc(f, p) {
    return formula.calculate(f, p, random.randomFromMathRandom);
}

module.exports.calc = calc;
