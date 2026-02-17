// src/world/Chunk.js

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
    getIceFactor,
    getRiverFactor,
    getMaterialAt,
} from "./terrain.js";

import { getBiomeAt } from "./biomes.js";
import { getTreeAt, getTreeColors } from "./objects.js";

export class Chunk {
    static SIZE = 16;

    /**
     * @param {number} cx
     * @param {number} cz
     * @param {import('@babylonjs/core').Scene} scene
     * @param {{minWorldX:number,maxWorldX:number,minWorldZ:number,maxWorldZ:number}} [bounds]
     */
    constructor(cx, cz, scene, bounds) {
        this.cx = cx;
        this.cz = cz;
        this.scene = scene;
        this.bounds = bounds ?? null;

        this.surfaceMesh = null;
        this.waterMesh = null;

        this._fade = 1;

        this._generate();
    }

    /**
     * Hard show/hide (used by systems that don't need soft falloff).
     * @param {boolean} v
     */
    setVisible(v) {
        if (this.surfaceMesh) this.surfaceMesh.isVisible = v;
        if (this.waterMesh) this.waterMesh.isVisible = v;
    }

    /**
     * Soft fade 0..1 (Diablo-style darkness falloff).
     * NOTE: this uses mesh.visibility (alpha multiplier).
     * @param {number} f
     */
    setFade(f) {
        const ff = Math.max(0, Math.min(1, f));

        // avoid thrashing
        if (Math.abs(ff - this._fade) < 0.01) return;
        this._fade = ff;

        const shown = ff > 0.02;

        if (this.surfaceMesh) {
            this.surfaceMesh.isVisible = shown;
            this.surfaceMesh.visibility = ff;
        }
        if (this.waterMesh) {
            // water should fade a bit faster so it doesn't glow weirdly
            const wf = Math.max(0, Math.min(1, ff * 0.92));
            this.waterMesh.isVisible = wf > 0.02;
            this.waterMesh.visibility = wf;
        }
    }

    _generate() {
        const xOffset = this.cx * Chunk.SIZE;
        const zOffset = this.cz * Chunk.SIZE;

        const GAP_SCALE = 0.90;

        const BEDROCK_Y = -92;
        const CLIFF_WALL_MAX = 14;
        const WALL_SLOPE_THRESHOLD = 2;
        const EDGE_WALL_MAX = 64;

        const surface = MeshBuilder.CreateBox(
            `surface_${this.cx}_${this.cz}`,
            { size: 1 },
            this.scene
        );
        surface.isVisible = true;
        surface.alwaysSelectAsActiveMesh = true;
        surface.position.set(xOffset, 0, zOffset);

        const surfMat = new StandardMaterial(`surfMat_${this.cx}_${this.cz}`, this.scene);
        surfMat.disableLighting = false;
        surfMat.useVertexColors = true;
        surfMat.emissiveColor = new Color3(0, 0, 0);
        surfMat.diffuseColor = new Color3(1, 1, 1);
        surfMat.specularColor = new Color3(0, 0, 0);
        surface.material = surfMat;

        const water = MeshBuilder.CreateBox(
            `water_${this.cx}_${this.cz}`,
            { size: 1 },
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

        // Slightly more "reflective" look without heavy reflection probes
        waterMat.specularColor = new Color3(0.30, 0.30, 0.36);
        waterMat.specularPower = 96;

        waterMat.alpha = 0.70;
        waterMat.backFaceCulling = false;
        water.material = waterMat;

        /** @type {number[]} */
        const surfaceMatrices = [];
        /** @type {number[]} */
        const surfaceColors = [];
        /** @type {number[]} */
        const waterMatrices = [];
        /** @type {number[]} */
        const waterColors = [];

        const pushSurface = (lx, y, lz, c, a = 1) => {
            // Defensive: ensure c is always a valid Color3-like object
            const cc =
                (c && typeof c.r === "number" && typeof c.g === "number" && typeof c.b === "number")
                    ? c
                    : new Color3(0.8, 0.8, 0.8);

            const m = Matrix.Compose(
                new Vector3(GAP_SCALE, GAP_SCALE, GAP_SCALE),
                Quaternion.Identity(),
                new Vector3(lx + 0.5, y + 0.5, lz + 0.5)
            );
            surfaceMatrices.push(...m.toArray());
            surfaceColors.push(cc.r, cc.g, cc.b, a);
        };

        const pushWater = (lx, y, lz, c, a = 1) => {
            const cc =
                (c && typeof c.r === "number" && typeof c.g === "number" && typeof c.b === "number")
                    ? c
                    : new Color3(0.2, 0.3, 0.35);

            const m = Matrix.Compose(
                new Vector3(GAP_SCALE, GAP_SCALE, GAP_SCALE),
                Quaternion.Identity(),
                new Vector3(lx + 0.5, y + 0.54, lz + 0.5)
            );
            waterMatrices.push(...m.toArray());
            waterColors.push(cc.r, cc.g, cc.b, a);
        };

        const shade = (c, f) =>
            new Color3(
                Math.max(0, Math.min(1, c.r * f)),
                Math.max(0, Math.min(1, c.g * f)),
                Math.max(0, Math.min(1, c.b * f))
            );

        const colorForMaterial = (matId, surfaceBase, depth) => {
            const d = Math.min(1, depth / 10);
            switch (matId) {
                case "bedrock": return shade(new Color3(0.10, 0.12, 0.14), 1.0 - d * 0.08);
                case "metal": return shade(new Color3(0.46, 0.50, 0.58), 0.90 - d * 0.08);
                case "ice": return shade(new Color3(0.60, 0.74, 0.92), 0.96 - d * 0.06);
                case "impact_glass": return shade(new Color3(0.32, 0.34, 0.40), 0.86 - d * 0.08);
                case "basalt": return shade(new Color3(0.18, 0.20, 0.24), 0.92 - d * 0.10);
                case "anorthosite": return shade(new Color3(0.44, 0.46, 0.50), 0.94 - d * 0.10);
                case "regolith":
                default:
                    return shade(surfaceBase, 0.72 - d * 0.14);
            }
        };

        const H = Array.from({ length: Chunk.SIZE + 2 }, () =>
            new Array(Chunk.SIZE + 2).fill(0)
        );
        for (let lx = -1; lx <= Chunk.SIZE; lx++) {
            for (let lz = -1; lz <= Chunk.SIZE; lz++) {
                const wx = xOffset + lx;
                const wz = zOffset + lz;
                H[lx + 1][lz + 1] = getHeight(wx, wz);
            }
        }

        // ✅ Bulletproof tree color palette (prevents "cannot read .r")
        const treeColorsRaw = getTreeColors();
        const treeColors =
            (treeColorsRaw && typeof treeColorsRaw === "object") ? treeColorsRaw : Object.create(null);

        const resolveColor3 = (val, fallback) => {
            if (val && typeof val.r === "number" && typeof val.g === "number" && typeof val.b === "number") {
                // already Color3-like
                return val;
            }
            if (val && typeof val === "object" && "r" in val && "g" in val && "b" in val) {
                // plain object {r,g,b}
                const r = Number(val.r);
                const g = Number(val.g);
                const b = Number(val.b);
                if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return new Color3(r, g, b);
            }
            return fallback;
        };

        const defaultObjColor = new Color3(0.8, 0.8, 0.8);
        const ruinFallback = resolveColor3(treeColors.ruin, defaultObjColor);

        for (let lx = 0; lx < Chunk.SIZE; lx++) {
            for (let lz = 0; lz < Chunk.SIZE; lz++) {
                const wx = xOffset + lx;
                const wz = zOffset + lz;

                const h = H[lx + 1][lz + 1];

                const nE = H[lx + 2][lz + 1];
                const nW = H[lx + 0][lz + 1];
                const nN = H[lx + 1][lz + 2];
                const nS = H[lx + 1][lz + 0];

                const base = getColorForHeight(h, wx, wz);

                const slope = Math.max(
                    Math.abs(h - nE),
                    Math.abs(h - nW),
                    Math.abs(h - nN),
                    Math.abs(h - nS)
                );
                const shadeFactor = 1.0 - Math.min(0.40, slope * 0.06);

                pushSurface(lx, h, lz, shade(base, shadeFactor), 1);
                pushSurface(lx, BEDROCK_Y, lz, new Color3(0.10, 0.12, 0.14), 1);

                if (slope >= WALL_SLOPE_THRESHOLD) {
                    const minN = Math.min(nE, nW, nN, nS);
                    const diff = h - minN;

                    if (diff > 1) {
                        const depth = Math.min(diff - 1, CLIFF_WALL_MAX);
                        let depthIndex = 1;

                        const bottomY = Math.max(BEDROCK_Y + 1, h - depth);

                        for (let y = h - 1; y >= bottomY; y--) {
                            const matId = getMaterialAt(wx, y, wz);
                            pushSurface(lx, y, lz, colorForMaterial(matId, base, depthIndex), 1);
                            depthIndex++;
                        }
                    }
                }

                if (this.bounds) {
                    const isEdgeColumn =
                        wx === this.bounds.minWorldX ||
                        wx === this.bounds.maxWorldX ||
                        wz === this.bounds.minWorldZ ||
                        wz === this.bounds.maxWorldZ;

                    if (isEdgeColumn) {
                        const depth = Math.min(EDGE_WALL_MAX, h - (BEDROCK_Y + 1));
                        let depthIndex = 1;
                        for (let y = h - 1; y >= Math.max(BEDROCK_Y + 1, h - depth); y--) {
                            const matId = getMaterialAt(wx, y, wz);
                            pushSurface(lx, y, lz, colorForMaterial(matId, base, depthIndex), 1);
                            depthIndex++;
                        }
                    }
                }

                const biome = getBiomeAt(wx, wz);

                // Water
                if (h < WATER_LEVEL) {
                    const wc = getWaterColor(wx, wz);
                    const wf = 0.80;

                    // biome.waterTint can be missing in some biomes; guard it
                    const tint = (biome && biome.waterTint)
                        ? biome.waterTint
                        : new Color3(0.10, 0.18, 0.22);

                    const wcc = new Color3(
                        wc.r * wf + tint.r * (1 - wf),
                        wc.g * wf + tint.g * (1 - wf),
                        wc.b * wf + tint.b * (1 - wf)
                    );
                    pushWater(lx, WATER_LEVEL, lz, wcc, 1);
                }

                // Ice (thin top sheet)
                const ice = getIceFactor(wx, wz);
                if (ice > 0.48 && h <= WATER_LEVEL + 1) {
                    const ic = new Color3(0.62, 0.78, 0.95);
                    const a = Math.min(0.82, 0.32 + ice * 0.55);
                    pushSurface(lx, WATER_LEVEL + 1, lz, ic, a);
                }

                // River banks (slight darkening)
                const rf = getRiverFactor(wx, wz);
                if (rf > 0.55 && h >= WATER_LEVEL - 1) {
                    const bank = shade(base, 0.82);
                    pushSurface(lx, h, lz, bank, 1);
                }

                // Objects (ruins/trees/spires etc)
                const blocks = getTreeAt(wx, wz, h);
                if (Array.isArray(blocks) && blocks.length) {
                    for (const b of blocks) {
                        if (!b) continue;

                        const type = (typeof b.type === "string" && b.type.length) ? b.type : "ruin";

                        // Resolve to a guaranteed Color3
                        const raw = treeColors[type];
                        const c = resolveColor3(raw, ruinFallback);

                        // b.x/y/z are ABSOLUTE (world) blocks in your codebase
                        // Convert to chunk-local coordinates
                        const lx2 = (Number.isFinite(b.x) ? b.x : wx) - xOffset;
                        const lz2 = (Number.isFinite(b.z) ? b.z : wz) - zOffset;
                        const y2 = Number.isFinite(b.y) ? b.y : (h + 1);

                        pushSurface(lx2, y2, lz2, c, 1);
                    }
                }
            }
        }

        surface.thinInstanceSetBuffer("matrix", new Float32Array(surfaceMatrices), 16, true);
        surface.thinInstanceSetBuffer("color", new Float32Array(surfaceColors), 4, true);

        water.thinInstanceSetBuffer("matrix", new Float32Array(waterMatrices), 16, true);
        water.thinInstanceSetBuffer("color", new Float32Array(waterColors), 4, true);

        // Freeze for perf (safe because we rely on alwaysSelectAsActiveMesh)
        surface.freezeWorldMatrix();
        water.freezeWorldMatrix();
        surfMat.freeze();
        waterMat.freeze();

        this.surfaceMesh = surface;
        this.waterMesh = water;
    }
}
