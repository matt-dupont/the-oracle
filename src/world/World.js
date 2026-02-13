import { Chunk } from "./Chunk.js";
import { getHeight } from "./terrain.js";

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();

        // tighter streaming radius so you see points-of-interest faster
        this.radius = 6;

        this._lastCx = null;
        this._lastCz = null;
    }

    update(cameraTargetPos) {
        const cx = Math.floor(cameraTargetPos.x / Chunk.SIZE);
        const cz = Math.floor(cameraTargetPos.z / Chunk.SIZE);

        if (cx === this._lastCx && cz === this._lastCz) return;
        this._lastCx = cx;
        this._lastCz = cz;

        const needed = new Set();

        for (let dz = -this.radius; dz <= this.radius; dz++) {
            for (let dx = -this.radius; dx <= this.radius; dx++) {
                const nx = cx + dx;
                const nz = cz + dz;
                const key = `${nx},${nz}`;
                needed.add(key);

                if (!this.chunks.has(key)) {
                    const ch = new Chunk(nx, nz, this.scene);
                    this.chunks.set(key, ch);
                }
            }
        }

        // Dispose chunks not needed
        for (const [key, chunk] of this.chunks.entries()) {
            if (!needed.has(key)) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }
    }

    getGroundY(worldX, worldZ) {
        return getHeight(worldX, worldZ);
    }
}
