import { Chunk } from "./Chunk.js";
import { getHeight } from "./terrain.js";

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.radius = 8;

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

        // SQUARE chunk load (no circular mask)
        for (let dx = -this.radius; dx <= this.radius; dx++) {
            for (let dz = -this.radius; dz <= this.radius; dz++) {
                const ncx = cx + dx;
                const ncz = cz + dz;
                const key = `${ncx},${ncz}`;
                needed.add(key);

                if (!this.chunks.has(key)) {
                    this.chunks.set(key, new Chunk(ncx, ncz, this.scene));
                }
            }
        }

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
