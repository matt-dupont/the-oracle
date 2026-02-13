// src/util/hash.js
// Deterministic seeded hashing + value noise (JS-safe)
//
// IMPORTANT:
// The old "classic C hash" formula overflowed past 2^53 in JS floats,
// which destroyed low bits and made hash2D effectively CONSTANT.
// That broke ALL noise (terrain, biomes, objects).
//
// This version uses Math.imul (32-bit integer multiply) so hashing behaves
// like real 32-bit overflow math and stays stable & varied.

let _noiseSeed = 0;

// String -> 32-bit unsigned (FNV-1a)
function _seedFromString(str) {
    const s = String(str ?? "");
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

export function setNoiseSeed(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) {
        _noiseSeed = (seed >>> 0);
        return _noiseSeed;
    }
    _noiseSeed = _seedFromString(seed);
    return _noiseSeed;
}

export function getNoiseSeed() {
    return _noiseSeed >>> 0;
}

// 32-bit mix (murmur-ish finalizer) -> float in [-1, 1]
export function hash2D(x, z) {
    // Force 32-bit ints (noise2D passes ints, but other callers may pass floats)
    const xi = (x | 0);
    const zi = (z | 0);

    // Mix coords with seed using 32-bit-safe math
    // Large odd constants reduce patterns.
    let h = 0;
    h ^= Math.imul(xi, 374761393);
    h ^= Math.imul(zi, 668265263);
    h ^= Math.imul(_noiseSeed | 0, 1442695041);

    // Finalize avalanche
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    h = (h ^ (h >>> 16)) | 0;

    // Convert to [0,1] then [-1,1]
    const u = (h >>> 0) / 4294967295; // 2^32 - 1
    return u * 2.0 - 1.0;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

// Value noise (bilinear interp of hashed corners)
export function noise2D(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;

    const u = smoothstep(xf);
    const v = smoothstep(zf);

    const aa = hash2D(xi, zi);
    const ba = hash2D(xi + 1, zi);
    const ab = hash2D(xi, zi + 1);
    const bb = hash2D(xi + 1, zi + 1);

    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
}

// Fractal Brownian Motion helper
export function fbm(x, z, oct = 5, lac = 2.0, gain = 0.5) {
    let a = 1.0;
    let f = 1.0;
    let sum = 0.0;
    let norm = 0.0;

    for (let i = 0; i < oct; i++) {
        sum += noise2D(x * f, z * f) * a;
        norm += a;
        a *= gain;
        f *= lac;
    }

    return sum / Math.max(1e-6, norm);
}
