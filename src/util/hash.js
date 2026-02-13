// Simple 2D hash function for noise-like effects
export function hash2D(x, z) {
    let n = x * 1619 + z * 31337;
    n = (n << 13) ^ n;
    return (1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

// Simple value noise
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
