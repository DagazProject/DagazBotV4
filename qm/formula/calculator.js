"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAst = void 0;
const consts_1 = require("./consts");
const assertNever_1 = require("../assertNever");
function numberMinMax(n) {
    return Math.min(Math.max(n, -consts_1.MAX_NUMBER), consts_1.MAX_NUMBER);
}
function floorCeil(val) {
    return val > 0 ? Math.floor(val) : Math.ceil(val);
}
function pickRandomForRanges(ranges, random) {
    const totalValuesAmount = ranges.reduce((totalItems, range) => {
        return totalItems + range.to - range.from + 1;
    }, 0);
    let rnd = random(totalValuesAmount);
    //console.info(
    //    `new ranges=[${ranges
    //        .map(x => `${x.from}..${x.to}`)
    //        .join("; ")}] rnd=${rnd} pickedRandom=${pickedRandom} totalValuesAmount=${totalValuesAmount}`
    //);
    for (const range of ranges) {
        const len = range.to - range.from + 1;
        // console.info(`Range=${range[0]}..${range[1]}, rnd=${rnd}, len=${len}`)
        if (rnd >= len) {
            rnd = rnd - len;
        }
        else {
            const result = rnd + range.from;
            // debug(0, `Range ${arg} returned random ${result}`);
            return result;
        }
    }
    throw new Error("Error in finding random value for " +
        JSON.stringify({
            ranges,
            rnd,
        }, null, 4));
}
function calculateAst(ast, params = [], random) {
    function transformToIntoRanges(node) {
        if (node.type !== "binary" || node.operator !== "to keyword") {
            throw new Error("Wrong usage");
        }
        const valToRanges = (val) => [
            {
                from: val,
                to: val,
            },
        ];
        const left = node.left;
        const right = node.right;
        const leftRanges = left.type === "range"
            ? calculateRange(left)
            : valToRanges(floorCeil(calculateAst(left, params, random)));
        const rightRanges = right.type === "range"
            ? calculateRange(right)
            : valToRanges(floorCeil(calculateAst(right, params, random)));
        const leftRangeMax = Math.max(...leftRanges.map((x) => x.to), 0);
        const rightRangeMax = Math.max(...rightRanges.map((x) => x.to), 0);
        const leftRangeMin = Math.min(...leftRanges.map((x) => x.from), consts_1.MAX_NUMBER);
        const rightRangeMin = Math.min(...rightRanges.map((x) => x.from), consts_1.MAX_NUMBER);
        const newRangeMax = Math.max(leftRangeMax, rightRangeMax);
        const newRangeMin = Math.min(leftRangeMin, rightRangeMin);
        const newRanges = [
            {
                from: newRangeMin,
                to: newRangeMax,
            },
        ];
        return newRanges;
    }
    function calculateRange(node) {
        if (node.type !== "range") {
            throw new Error("Wrong usage");
        }
        return node.ranges.map((range) => {
            const from = floorCeil(calculateAst(range.from, params, random));
            const to = range.to ? floorCeil(calculateAst(range.to, params, random)) : from;
            const reversed = from > to;
            return {
                from: reversed ? to : from,
                to: reversed ? from : to,
            };
        });
    }
    if (ast.type === "number") {
        return ast.value;
    }
    else if (ast.type === "parameter") {
        const paramValue = params[ast.parameterId];
        if (paramValue === undefined) {
            throw new Error(`Parameter p${ast.parameterId + 1} is not defined`);
        }
        return paramValue;
    }
    else if (ast.type === "binary") {
        if (ast.operator === "plus token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return numberMinMax(a + b);
        }
        else if (ast.operator === "minus token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return numberMinMax(a - b);
        }
        else if (ast.operator === "slash token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return numberMinMax(b !== 0 ? a / b : a > 0 ? consts_1.MAX_NUMBER : -consts_1.MAX_NUMBER);
        }
        else if (ast.operator === "div keyword") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            if (b !== 0) {
                const val = a / b;
                return numberMinMax(floorCeil(val));
            }
            else {
                return a > 0 ? consts_1.MAX_NUMBER : -consts_1.MAX_NUMBER;
            }
        }
        else if (ast.operator === "mod keyword") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return numberMinMax(b !== 0 ? a % b : a > 0 ? consts_1.MAX_NUMBER : -consts_1.MAX_NUMBER);
        }
        else if (ast.operator === "asterisk token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return numberMinMax(a * b);
        }
        else if (ast.operator === "to keyword") {
            const newRanges = transformToIntoRanges(ast);
            return pickRandomForRanges(newRanges, random);
        }
        else if (ast.operator === "in keyword") {
            const reversed = ast.left.type === "range" && ast.right.type !== "range";
            const left = reversed ? ast.right : ast.left;
            const right = reversed ? ast.left : ast.right;
            const leftVal = numberMinMax(calculateAst(left, params, random));
            const ranges = right.type === "range"
                ? calculateRange(right)
                : right.type === "binary" && right.operator === "to keyword"
                    ? transformToIntoRanges(right)
                    : undefined;
            if (ranges) {
                for (const range of ranges) {
                    if (leftVal >= range.from && leftVal <= range.to) {
                        return 1;
                    }
                }
                return 0;
            }
            else {
                const rightVal = numberMinMax(calculateAst(ast.right, params, random));
                return leftVal === rightVal ? 1 : 0;
            }
        }
        else if (ast.operator === "greater than eq token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a >= b ? 1 : 0;
        }
        else if (ast.operator === "greater than token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a > b ? 1 : 0;
        }
        else if (ast.operator === "less than eq token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a <= b ? 1 : 0;
        }
        else if (ast.operator === "less than token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a < b ? 1 : 0;
        }
        else if (ast.operator === "equals token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a === b ? 1 : 0;
        }
        else if (ast.operator === "not equals token") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a !== b ? 1 : 0;
        }
        else if (ast.operator === "and keyword") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a && b ? 1 : 0;
        }
        else if (ast.operator === "or keyword") {
            const a = calculateAst(ast.left, params, random);
            const b = calculateAst(ast.right, params, random);
            return a || b ? 1 : 0;
        }
        else {
            return (0, assertNever_1.assertNever)(ast.operator);
        }
    }
    else if (ast.type === "unary") {
        if (ast.operator === "minus token") {
            return -calculateAst(ast.expression, params, random);
        }
        else {
            return (0, assertNever_1.assertNever)(ast);
        }
    }
    else if (ast.type === "range") {
        return pickRandomForRanges(calculateRange(ast), random);
    }
    else {
        return (0, assertNever_1.assertNever)(ast);
    }
}
exports.calculateAst = calculateAst;
//# sourceMappingURL=calculator.js.map