import {
    MeshBuilder,
    StandardMaterial,
    Color3,
    Matrix,
    Vector3,
    Quaternion,
} from "@babylonjs/core";

import {
    getHeight,
    getColorForHeight,
    getWaterColor,
    WATER_LEVEL,
    getRavineFactor,
} from "./terrain.js";

import { getTreeAt, getTreeColors } from "./objects.js";

export class Chunk {
    static SIZE = 16;

    constructor(cx, cz, scene) {
        this.cx = cx;
        this.cz = cz;
        this.scene = scene;

        this.surfaceMesh = null;
        this.waterMesh = null;

        this._generate();
    }

    _generate() {
        const xOffset = this.cx * Chunk.SIZE;
        const zOffset = this.cz * Chunk.SIZE;

        // Crisp, intentional gaps (your “clean grid” vibe)
        const GAP_SCALE = 0.885;

        // How far we fill cliff “skirts” (keeps perf + prevents “infinite walls”)
        const MAX_SIDE_FILL = 6;

        // ===== surface master =====
        const surface = MeshBuilder.CreateBox(
            `surface_${this.cx}_${this.cz}`,
            { size: 1 },
            this.scene
        );
        surface.isVisible = true;
        surface.alwaysSelectAsActiveMesh = true;
        surface.position.set(xOffset, 0, zOffset);

        const surfMat = new StandardMaterial(`surfMat_${this.cx}_${this.cz}`, this.scene);
        surfMat.disableLighting = false;        // keep cube shading + separation
        surfMat.useVertexColors = true;
        surfMat.emissiveColor = new Color3(0, 0, 0);
        surfMat.diffuseColor = new Color3(1, 1, 1); // 100% white base so vertex colors are pure
        surfMat.specularColor = new Color3(0, 0, 0);
        surface.material = surfMat;

        // ===== water master =====
        const water = MeshBuilder.CreateBox(
            `water_${this.cx}_${this.cz}`,
            { size: 1, height: 0.12 },
            this.scene
        );
        water.isVisible = true;
        water.alwaysSelectAsActiveMesh = true;
        water.position.set(xOffset, 0, zOffset);

        const waterMat = new StandardMaterial(`waterMat_${this.cx}_${this.cz}`, this.scene);
        waterMat.disableLighting = false;
        waterMat.useVertexColors = true;
        waterMat.emissiveColor = new Color3(0, 0, 0);
        waterMat.diffuseColor = new Color3(1, 1, 1);
        waterMat.specularColor = new Color3(0.10, 0.10, 0.12); // subtle “surface”
        waterMat.alpha = 0.82; // ✅ makes it read like water/ice
        waterMat.backFaceCulling = false;
        water.material = waterMat;

        // ===== height cache (+border) =====
        const H = Array.from({ length: Chunk.SIZE + 2 }, () => new Array(Chunk.SIZE + 2).fill(0));
        for (let lx = -1; lx <= Chunk.SIZE; lx++) {
            for (let lz = -1; lz <= Chunk.SIZE; lz++) {
                const wx = xOffset + lx;
                const wz = zOffset + lz;
                const h = getHeight(wx, wz);
                H[lx + 1][lz + 1] = Number.isFinite(h) ? h : 0;
            }
        }

        const q = Quaternion.Identity();
        const surfMatrices = [];
        const surfColors = [];
        const waterMatrices = [];
        const waterColors = [];

        const pushSurface = (lx, y, lz, c, a = 1.0) => {
            const m = Matrix.Compose(
                new Vector3(GAP_SCALE, GAP_SCALE, GAP_SCALE),
                q,
                new Vector3(lx, y, lz)
            );
            surfMatrices.push(...m.asArray());
            surfColors.push(c.r, c.g, c.b, a);
        };

        const pushWater = (lx, y, lz, c, a = 1.0) => {
            const m = Matrix.Compose(
                new Vector3(0.94, 1.0, 0.94),
                q,
                new Vector3(lx, y + 0.08, lz) // lift slightly so it doesn't z-fight
            );
            waterMatrices.push(...m.asArray());
            waterColors.push(c.r, c.g, c.b, a);
        };

        const shade = (c, s) => new Color3(c.r * s, c.g * s, c.b * s);

        const treeColors = getTreeColors();

        for (let lx = 0; lx < Chunk.SIZE; lx++) {
            for (let lz = 0; lz < Chunk.SIZE; lz++) {
                const wx = xOffset + lx;
                const wz = zOffset + lz;

                const h = H[lx + 1][lz + 1];

                const nE = H[lx + 2][lz + 1];
                const nW = H[lx + 0][lz + 1];
                const nN = H[lx + 1][lz + 2];
                const nS = H[lx + 1][lz + 0];

                const minN = Math.min(nE, nW, nN, nS);

                // AO based on higher neighbors (subtle)
                const occluding =
                    (nE > h ? 1 : 0) +
                    (nW > h ? 1 : 0) +
                    (nN > h ? 1 : 0) +
                    (nS > h ? 1 : 0);
                const ao = 1.0 - occluding * 0.055;

                // slope shading for depth
                const slope = Math.min(1.0, (h - minN) / 7.0);
                const slopeShade = 1.0 - slope * 0.12;

                // rim boost (reduced so it won’t look “minty”)
                const rim = Math.min(1.0, (h - (nE + nW + nN + nS) / 4) / 4.0);
                const rimBoost = 1.0 + Math.max(0, rim) * 0.035;

                const topShade = ao * slopeShade * rimBoost;

                // ✅ Top color is neutral regolith
                const topC = getColorForHeight(h, wx, wz);
                pushSurface(lx, h, lz, shade(topC, topShade));

                // ✅ Side fill uses *topC* (NOT getColorForHeight(y)), so no purple bands ever
                const drop = h - minN;
                if (drop > 1) {
                    const steps = Math.min(MAX_SIDE_FILL, drop - 1);
                    const sideC = shade(topC, 0.72);
                    for (let i = 1; i <= steps; i++) {
                        pushSurface(lx, h - i, lz, sideC);
                    }
                }

                // Water/ice: only place where low OR on ravine bed
                const rav = getRavineFactor(wx, wz);
                const wantsFlow = rav > 0.75 && h <= WATER_LEVEL + 2;

                if (h <= WATER_LEVEL || wantsFlow) {
                    const wc = getWaterColor(wx, wz);
                    // slightly brighter near ravine center so it reads like “flow”
                    const flowBoost = 1.0 + Math.max(0, (rav - 0.75)) * 0.10;
                    pushWater(lx, WATER_LEVEL, lz, shade(wc, flowBoost), 0.82);
                }

                // Objects (optional; keep minimal)
                if (h > WATER_LEVEL) {
                    const blocks = getTreeAt(wx, wz, h);
                    if (blocks && blocks.length) {
                        for (const b of blocks) {
                            const localX = b.x - xOffset;
                            const localZ = b.z - zOffset;
                            const c = treeColors[b.type] ?? new Color3(0.9, 0.9, 0.9);
                            pushSurface(localX, b.y, localZ, c);
                        }
                    }
                }
            }
        }

        const surfCount = surfMatrices.length / 16;
        if (surfCount > 0) {
            surface.thinInstanceSetBuffer("matrix", new Float32Array(surfMatrices), 16, false);
            surface.thinInstanceSetBuffer("instanceColor", new Float32Array(surfColors), 4, false);
            surface.thinInstanceRefreshBoundingInfo(true);
            this.surfaceMesh = surface;
        } else {
            surface.dispose();
        }

        const waterCount = waterMatrices.length / 16;
        if (waterCount > 0) {
            water.thinInstanceSetBuffer("matrix", new Float32Array(waterMatrices), 16, false);
            water.thinInstanceSetBuffer("instanceColor", new Float32Array(waterColors), 4, false);
            water.thinInstanceRefreshBoundingInfo(true);
            this.waterMesh = water;
        } else {
            water.dispose();
        }
    }

    dispose() {
        if (this.surfaceMesh) {
            if (this.surfaceMesh.material) this.surfaceMesh.material.dispose();
            this.surfaceMesh.dispose(false, true);
            this.surfaceMesh = null;
        }
        if (this.waterMesh) {
            if (this.waterMesh.material) this.waterMesh.material.dispose();
            this.waterMesh.dispose(false, true);
            this.waterMesh = null;
        }
    }
}
