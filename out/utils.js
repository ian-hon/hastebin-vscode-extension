"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHex = toHex;
exports.fromHex = fromHex;
function toHex(i) {
    return i.toString(16);
}
function fromHex(h) {
    return parseInt(h.replace('-', ''), 16);
}
//# sourceMappingURL=utils.js.map