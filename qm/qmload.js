"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restore = exports.Reader = void 0;
class Reader {
    constructor(data) {
        this.data = data;
        this.i = 0;
    }
    int32() {
        const result = this.data.readInt32LE(this.i);
        this.i += 4;
        return result;
    }
    readString(canBeUndefined = false) {
        const ifString = this.int32();
        if (ifString) {
            const strLen = this.int32();
            const str = this.data.slice(this.i, this.i + strLen * 2).toString("utf16le");
            this.i += strLen * 2;
            return str;
        }
        else {
            return canBeUndefined ? undefined : "";
        }
    }
    byte() {
        return this.data[this.i++];
    }
}
exports.Reader = Reader;
function parseParam(r) {
    const title = r.readString();
    const min = r.int32();
    const max = r.int32();
    const value = r.int32();
    const hidden = r.int32();
    return {
        title: title,
        min: min,
        max: max,
        value: value,
        hidden: (hidden > 0) ? true : false
    };
}
function parseSave(r) {
    const name = r.readString();
    const loc = r.int32();
    const cnt = r.int32();
    const params = [];
    for (let i = 0; i < cnt; i++) {
        params.push(parseParam(r));
    }
    return {
        name: name,
        loc: loc,
        params: params
    };
}
function restore(data) {
    const r = new Reader(data);
    return parseSave(r);
}
exports.restore = restore;
//# sourceMappingURL=qmload.js.map