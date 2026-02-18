// src/world/noise.js
// Small, fast, deterministic value-noise + FBM helpers.
// IMPORTANT: These named exports must exist because biomes/terrain import them.

export function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

function fract(x) {
    return x - Math.floor(x);
}

function hash2(x, z) {
    // deterministic pseudo-random in [0..1)
    return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

// 0..1 value noise (bilinear interpolated grid noise)
export function noise01(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;

    const a = hash2(xi, zi);
    const b = hash2(xi + 1, zi);
    const c = hash2(xi, zi + 1);
    const d = hash2(xi + 1, zi + 1);

    const u = smoothstep(xf);
    const v = smoothstep(zf);

    const ab = lerp(a, b, u);
    const cd = lerp(c, d, u);
    return lerp(ab, cd, v);
}

// FBM in 0..1
export function fbm01(x, z, octaves = 5, lacunarity = 2.0, gain = 0.5) {
    let amp = 0.5;
    let freq = 1.0;
    let sum = 0.0;
    let norm = 0.0;

    for (let i = 0; i < octaves; i++) {
        sum += noise01(x * freq, z * freq) * amp;
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0.0;
}

// Ridged FBM in 0..1
export function ridged01(x, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 0.5;
    let freq = 1.0;
    let sum = 0.0;
    let norm = 0.0;

    for (let i = 0; i < octaves; i++) {
        const n = noise01(x * freq, z * freq);
        const r = 1.0 - Math.abs(n * 2.0 - 1.0); // ridge
        sum += r * amp;
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0.0;
}

// Simple domain warp (returns warped coords)
export function warp2(x, z, strength = 30, freq = 0.002) {
    const wx = (noise01(x * freq + 19.7, z * freq - 3.1) - 0.5) * 2.0;
    const wz = (noise01(x * freq - 7.2, z * freq + 41.8) - 0.5) * 2.0;
    return { x: x + wx * strength, z: z + wz * strength };
}
