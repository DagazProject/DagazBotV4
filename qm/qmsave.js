"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCtx = exports.Writer = void 0;
class Writer {
    constructor(chunkSize = 1024 * 1024) {
        this.chunkSize = chunkSize;
        this.buf = Buffer.alloc(this.chunkSize);
        this.pos = 0;
    }
    ensure(len) {
        if (this.pos + len > this.buf.length) {
            this.buf = Buffer.concat([this.buf, Buffer.alloc(this.chunkSize)]);
        }
    }
    export() {
        return this.buf.slice(0, this.pos);
    }
    int32(i) {
        this.ensure(4);
        this.buf.writeInt32LE(i, this.pos);
        this.pos += 4;
    }
    writeString(str) {
        if (str === null || str === undefined) {
            this.int32(0);
        }
        else {
            this.int32(1);
            const stringBuffer = Buffer.from(str, "utf16le");
            if (stringBuffer.length % 2 !== 0) {
                throw new Error(`Internal error, utf16le is not even`);
            }
            const length = stringBuffer.length / 2;
            this.int32(length);
            this.ensure(stringBuffer.length);
            stringBuffer.copy(this.buf, this.pos);
            this.pos += stringBuffer.length;
        }
    }
    byte(b) {
        this.ensure(1);
        this.buf[this.pos] = b;
        this.pos += 1;
    }
}
exports.Writer = Writer;
function saveCtx(ctx) {
    const w = new Writer();
    w.writeString(ctx.name);
    w.int32(ctx.loc);
    w.int32(ctx.params.length);
    for (let i = 0; i < ctx.params.length; i++) {
        w.writeString(ctx.params[i].title);
        w.int32(ctx.params[i].min);
        w.int32(ctx.params[i].max);
        w.int32(ctx.params[i].value);
        w.int32(ctx.params[i].hidden ? 1 : 0);
    }
    return w.export();
}
exports.saveCtx = saveCtx;
//# sourceMappingURL=qmsave.js.map