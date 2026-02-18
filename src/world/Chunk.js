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
     * @param {import('@babylonjs/core').ShadowGenerator} [shadows]
     */
    constructor(cx, cz, scene, shadows = null) {
        this.cx = cx;
        this.cz = cz;
        this.scene = scene;
        this.shadows = shadows;

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

    /**
     * More granular corner-based fading for bilinear smoothness.
     * Overrides setFade if the shader/material supports it.
     * Currently just averages and uses standard setFade.
     */
    setFadeCorners(f00, f10, f01, f11) {
        const avg = (f00 + f10 + f01 + f11) * 0.25;
        this.setFade(avg);
    }

    _generate() {
        const xOffset = this.cx * Chunk.SIZE;
        const zOffset = this.cz * Chunk.SIZE;

        const GAP_SCALE = 0.92;

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
        surfMat.specularColor = new Color3(0.1, 0.1, 0.1);
        surfMat.specularPower = 32;
        surface.material = surfMat;

        if (this.shadows) {
            surface.receiveShadows = true;
            // Note: we can't easily add thin instances to shadows without shadowGenerator.addShadowMaker
            // but for now let's at least receive them.
        }

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

        // Enhanced "reflective" look
        waterMat.specularColor = new Color3(0.8, 0.8, 0.9);
        waterMat.specularPower = 128;

        waterMat.alpha = 0.65;
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
                new Vector3(lx + 0.5, y + 0.51, lz + 0.5)
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
                pushSurface(lx, h, lz, base, 1);

                // Fill vertical gaps (walls) to prevent "floating blocks" or holes
                const minN = Math.min(nE, nW, nN, nS);
                if (minN < h) {
                    for (let y = h - 1; y >= minN; y--) {
                        // Use a slightly darker color for sides/walls
                        const sideColor = new Color3(base.r * 0.85, base.g * 0.85, base.b * 0.85);
                        pushSurface(lx, y, lz, sideColor, 1);
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
                    
                    // Always render water at WATER_LEVEL
                    pushWater(lx, WATER_LEVEL, lz, wcc, 1);
                    
                    // Fill water volume down to terrain to avoid "floating water" look
                    for (let wy = WATER_LEVEL - 1; wy > h; wy--) {
                         pushWater(lx, wy, lz, wcc, 0.4); // slightly lower alpha for deep water voxels
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
