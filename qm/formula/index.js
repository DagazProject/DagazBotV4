"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculate = exports.parse = exports.MAX_NUMBER = void 0;
const scanner_1 = require("./scanner");
const parser_1 = require("./parser");
const calculator_1 = require("./calculator");
var consts_1 = require("./consts");
Object.defineProperty(exports, "MAX_NUMBER", { enumerable: true, get: function () { return consts_1.MAX_NUMBER; } });
function parse(str) {
    const strNoLineBreaks = str.replace(/\r|\n/g, " ");
    const scanner = (0, scanner_1.createScanner)(strNoLineBreaks);
    const ast = (0, parser_1.parseExpression)(scanner);
    // console.info(JSON.stringify(ast, null, 4));
    return ast;
}
exports.parse = parse;
function calculate(str, params = [], random) {
    try {
        const ast = parse(str);
        const value = (0, calculator_1.calculateAst)(ast, params, random);
        return Math.round(value);
    }
    catch (error) {
        console.error(error);
    }
}
exports.calculate = calculate;
//console.info(parse('2 +  2 * 2 +2+2'))
//console.info(parse('2 + 2 * 2 + 2'))
//console.info(parse("2 in 2 to 3"));
// console.info(parse("[-2]"));
//console.info(parse("[-3;-3;-3..-3]"));
//console.info(parse("3 + [1;3;6..9] - 3"));
//console.info(parse("[p11]-[5..30]*0,4"));
//console.info(parse('[p1] div1000000mod 10',[12346789]))
//console.info(parse('10 000'));
//# sourceMappingURL=index.js.map