// src/util/rng.js
// Simple seeded random number generator (Linear Congruential Generator)
export class RNG {
    constructor(seed = 12345) {
        this.seed = seed;
    }

    // Returns a pseudo-random float between 0 and 1
    next() {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    // Returns a random float between min and max
    nextRange(min, max) {
        return min + this.next() * (max - min);
    }

    // Back-compat convenience (some code used rng.range)
    range(min, max) {
        return this.nextRange(min, max);
    }

    // Random integer in [min, max] inclusive
    int(min, max) {
        const lo = Math.ceil(min);
        const hi = Math.floor(max);
        return Math.floor(this.nextRange(lo, hi + 1));
    }

    // Pick a random element from an array
    choice(arr) {
        if (!arr || arr.length === 0) return undefined;
        return arr[this.int(0, arr.length - 1)];
    }
}
