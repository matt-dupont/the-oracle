// src/world/World.js
import { Chunk } from "./Chunk.js";
import { getHeight } from "./terrain.js";

function buildSpiralCoords(minCx, maxCx, minCz, maxCz) {
    // Spiral out from (0,0) so initial load is fast + visible immediately.
    const coords = [];
    const inBounds = (cx, cz) => cx >= minCx && cx <= maxCx && cz >= minCz && cz <= maxCz;

    // If bounds don’t include (0,0), still spiral around nearest center-ish point
    let cx = 0;
    let cz = 0;
    if (!inBounds(cx, cz)) {
        cx = Math.max(minCx, Math.min(maxCx, 0));
        cz = Math.max(minCz, Math.min(maxCz, 0));
    }

    const seen = new Set();
    const push = (x, z) => {
        const k = `${x},${z}`;
        if (!seen.has(k) && inBounds(x, z)) {
            seen.add(k);
            coords.push({ cx: x, cz: z });
        }
    };

    push(cx, cz);

    // Spiral steps
    let step = 1;
    while (coords.length < (maxCx - minCx + 1) * (maxCz - minCz + 1)) {
        // move right step, down step, increase, left step, up step, increase
        for (let i = 0; i < step; i++) { cx += 1; push(cx, cz); }
        for (let i = 0; i < step; i++) { cz += 1; push(cx, cz); }
        step++;

        for (let i = 0; i < step; i++) { cx -= 1; push(cx, cz); }
        for (let i = 0; i < step; i++) { cz -= 1; push(cx, cz); }
        step++;

        // safety if something weird happens
        if (step > 10000) break;
    }

    return coords;
}

export class World {
    /**
     * @param {import('@babylonjs/core').Scene} scene
     * @param {{ sizeChunks?: number, budgetBoot?: number, budgetSteady?: number }} [opts]
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.chunks = new Map();

        this.totalChunks = 0;
        this.createdChunks = 0;

        const sizeChunks = Math.max(9, Math.floor(opts.sizeChunks ?? 25));
        this.sizeChunks = sizeChunks % 2 === 0 ? sizeChunks + 1 : sizeChunks;

        const half = Math.floor(this.sizeChunks / 2);
        this.minCx = -half;
        this.maxCx = half;
        this.minCz = -half;
        this.maxCz = half;

        this.minWorldX = this.minCx * Chunk.SIZE;
        this.maxWorldX = (this.maxCx + 1) * Chunk.SIZE - 1;
        this.minWorldZ = this.minCz * Chunk.SIZE;
        this.maxWorldZ = (this.maxCz + 1) * Chunk.SIZE - 1;

        // Create in spiral order (massive difference vs row-by-row stutter)
        this._pendingCreates = buildSpiralCoords(this.minCx, this.maxCx, this.minCz, this.maxCz);
        this.totalChunks = this._pendingCreates.length;

        this._budgetBoot = Math.max(1, Math.floor(opts.budgetBoot ?? 48));
        this._budgetSteady = Math.max(1, Math.floor(opts.budgetSteady ?? 10));
        this._bootstrapSeconds = 1.8;

        this.bounds = {
            minWorldX: this.minWorldX,
            maxWorldX: this.maxWorldX,
            minWorldZ: this.minWorldZ,
            maxWorldZ: this.maxWorldZ,
        };

        // Vision cache
        this._visHash = "";
    }

    _key(cx, cz) {
        return `${cx},${cz}`;
    }

    update(dt = 0.016) {
        if (this._pendingCreates.length === 0) return;

        this._bootstrapSeconds = Math.max(0, this._bootstrapSeconds - dt);
        const budget = this._bootstrapSeconds > 0 ? this._budgetBoot : this._budgetSteady;

        for (let i = 0; i < budget && this._pendingCreates.length > 0; i++) {
            const next = this._pendingCreates.shift();
            if (!next) break;

            const key = this._key(next.cx, next.cz);
            if (this.chunks.has(key)) continue;

            const ch = new Chunk(next.cx, next.cz, this.scene);
            this.chunks.set(key, ch);
            this.createdChunks++;
        }
    }

    get progress() {
        if (this.totalChunks <= 0) return 1;
        return Math.max(0, Math.min(1, this.createdChunks / this.totalChunks));
    }

    get isReady() {
        return this._pendingCreates.length === 0;
    }

    clampWorldXZ(x, z, margin = 8) {
        const minX = this.minWorldX + margin;
        const maxX = this.maxWorldX - margin;
        const minZ = this.minWorldZ + margin;
        const maxZ = this.maxWorldZ - margin;
        return {
            x: Math.max(minX, Math.min(maxX, x)),
            z: Math.max(minZ, Math.min(maxZ, z)),
        };
    }

    getGroundY(worldX, worldZ) {
        return getHeight(worldX, worldZ);
    }

    applyVisionLights(lights, options = {}) {
        const innerMul = typeof options.innerMul === "number" ? options.innerMul : 0.70;
        const outerMul = typeof options.outerMul === "number" ? options.outerMul : 1.22;

        if (!lights || lights.length === 0) {
            for (const ch of this.chunks.values()) ch.setFade(0);
            return;
        }

        let h = `${innerMul.toFixed(2)}|${outerMul.toFixed(2)}|`;
        for (let i = 0; i < lights.length; i++) {
            const L = lights[i];
            h += `${(L.x | 0)},${(L.z | 0)},${(L.r | 0)};`;
        }
        if (h === this._visHash) return;
        this._visHash = h;

        for (const ch of this.chunks.values()) {
            const x0 = ch.cx * Chunk.SIZE;
            const z0 = ch.cz * Chunk.SIZE;
            const x1 = x0 + Chunk.SIZE;
            const z1 = z0 + Chunk.SIZE;

            let bestFade = 0;

            for (let i = 0; i < lights.length; i++) {
                const L = lights[i];

                const inner = Math.max(1, L.r * innerMul);
                const outer = Math.max(inner + 1, L.r * outerMul);

                const inner2 = inner * inner;
                const outer2 = outer * outer;

                const dx = (L.x < x0) ? (x0 - L.x) : (L.x > x1 ? (L.x - x1) : 0);
                const dz = (L.z < z0) ? (z0 - L.z) : (L.z > z1 ? (L.z - z1) : 0);
                const d2 = dx * dx + dz * dz;

                if (d2 <= inner2) {
                    bestFade = 1;
                    break;
                }

                if (d2 < outer2) {
                    const d = Math.sqrt(d2);
                    const t = (d - inner) / (outer - inner);
                    const s = t * t * (3 - 2 * t);
                    const fade = 1 - s;
                    if (fade > bestFade) bestFade = fade;
                }
            }

            ch.setFade(bestFade);
        }
    }
}
