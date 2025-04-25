const base62chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Zet A-Z naar base-26 getal
function toBigIntBase26(s) {
    let result = 0n;
    for (const c of s) {
        const val = BigInt(c.charCodeAt(0) - 65); // 'A' = 0
        result = result * 26n + val;
    }
    return result;
}

// Zet een getal om naar base62 string
function toBase62(n) {
    if (n === 0n) return '0';
    let s = '';
    while (n > 0n) {
        s = base62chars[(n % 62n) as any] + s;
        n = n / 62n;
    }
    return s;
}

// Decode base62 → base26 string van letters
function fromBase62(s) {
    let n = 0n;
    for (const c of s) {
        const i = BigInt(base62chars.indexOf(c));
        n = n * 62n + i;
    }
    return n;
}

// Decode base26 getal naar string van A-Z
function fromBigIntBase26(n, length) {
    let s = '';
    for (let i = 0; i < length; i++) {
        const charCode = Number(n % 26n) + 65;
        s = String.fromCharCode(charCode) + s;
        n = n / 26n;
    }
    return s;
}

// Helpers
export function encodeAZString(str) {
    const num = toBigIntBase26(str);
    return toBase62(num);
}

export function decodeAZString(encoded, length) {
    const num = fromBase62(encoded);
    return fromBigIntBase26(num, length);
}
