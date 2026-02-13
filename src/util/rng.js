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
}
