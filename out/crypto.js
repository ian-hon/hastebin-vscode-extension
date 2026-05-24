"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALGO_NAME = void 0;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = require("crypto");
exports.ALGO_NAME = 'aes-gcm-pbkdf2';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
// refer to this:
// https://github.com/mdn/dom-examples/blob/main/web-crypto/encrypt-decrypt/aes-gcm.js
// this function is deterministic
// with the same passphrase and salt, itll always return the same key
async function deriveKey(passphrase, salt) {
    const encoder = new TextEncoder();
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
    // https://github.com/easychen/CookieCloud/blob/8398089c08ec341d6f318debdae8d315fd21b678/README.md?plain=1#L473
    // much simpler example: https://github.com/raullenchai/vnsh/blob/c7212544f347e962ff157dc71c806e3858195d4a/docs/api.md?plain=1#L360
    const passphraseKey = await crypto_1.webcrypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits', 'deriveKey'] // not sure what these do
    );
    // https://github.com/webtorrent/wormhole-crypto/blob/6c8c0ce7b39bdc4b406871d8898c8b439c992c8d/lib/ece.js#L237
    return crypto_1.webcrypto.subtle.deriveKey({
        // NOTE: IDK WHY AES-GCM DOES NOT WORK
        // will return error: Operation not supported
        // name: 'AES-GCM',
        // HKDF needs some additional arguments
        // name: 'HKDF',
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
    }, passphraseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// this as reference
// https://github.com/rohit9-code/HTM/blob/d44abd40eefab4943f4c7a41c024d9f0456ccf22/HTM1.txt#L244
async function encrypt(plaintext, passphrase) {
    // 1. get salt & iv
    // https://stackoverflow.com/a/45756927/13684100
    // salt always uses crypto.getRandomValues https://github.com/webtorrent/wormhole-crypto/blob/6c8c0ce7b39bdc4b406871d8898c8b439c992c8d/lib/ece.js#L205
    const salt = crypto_1.webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto_1.webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
    // 1.5 derive the key using salt + iv combo
    const key = await deriveKey(passphrase, salt);
    // 2. actuall encrypt it
    const data = (new TextEncoder()).encode(plaintext);
    // console.log(data);
    const ciphertext = await crypto_1.webcrypto.subtle.encrypt(
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-cbc_2
    { name: 'AES-GCM', iv }, key, data);
    // 3. construct payload
    // we need to include our salt and iv as well inside the ciphertext
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    // encode to base64 (Node.js way)
    return Buffer.from(combined).toString('base64');
}
async function decrypt(ciphertext, passphrase) {
    try {
        // decode first (Node.js way)
        const combined = Buffer.from(ciphertext, 'base64');
        // then extract the salt + iv + data
        // TODO: consider backwards compatibility for varying salt and iv lengths
        const salt = combined.slice(0, SALT_LENGTH);
        const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const data = combined.slice(SALT_LENGTH + IV_LENGTH); // everything else onwards
        // console.log(salt, iv, data);
        const key = await deriveKey(passphrase, salt);
        // decrypt using the same key
        const decrypted = await crypto_1.webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return (new TextDecoder()).decode(decrypted);
    }
    catch {
        throw new Error('decryption failed - invalid password');
    }
}
//# sourceMappingURL=crypto.js.map