"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDetermenisticRandom = exports.randomFromMathRandom = void 0;
const randomFromMathRandom = (n) => 
/* tslint:disable-next-line:strict-type-predicates */
n !== undefined ? Math.floor(Math.random() * n) : Math.random();
exports.randomFromMathRandom = randomFromMathRandom;
function createDetermenisticRandom(randomValues) {
    let randomId = -1;
    const random = (n) => {
        if (n === undefined) {
            throw new Error("todo this test");
        }
        randomId++;
        if (randomId >= randomValues.length) {
            throw new Error("Lots of randoms");
        }
        const randomValue = randomValues[randomId];
        if (randomValue >= n) {
            throw new Error(`Why stored random value is greater?`);
        }
        return randomValue;
    };
    return random;
}
exports.createDetermenisticRandom = createDetermenisticRandom;
//# sourceMappingURL=randomFunc.js.map