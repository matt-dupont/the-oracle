// src/world/Chunk.js
// PERF-focused chunk rendering:
// - Surface blocks only
// - Limited cliff skirts (bounded)
// - Water/ice overlays
// This keeps movement/loading smooth.

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

        const GAP_SCALE = 0.90;
        const SKIRT_DEPTH = 10;

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
        waterMat.specularColor = new Color3(0.12, 0.12, 0.15);
        waterMat.alpha = 0.72;
        waterMat.backFaceCulling = false;
        water.material = waterMat;

        const surfaceMatrices = [];
        const surfaceColors = [];
        const waterMatrices = [];
        const waterColors = [];

        const pushSurface = (lx, y, lz, c, a = 1) => {
            const m = Matrix.Compose(
                new Vector3(GAP_SCALE, GAP_SCALE, GAP_SCALE),
                Quaternion.Identity(),
                new Vector3(lx + 0.5, y + 0.5, lz + 0.5)
            );
            surfaceMatrices.push(...m.toArray());
            surfaceColors.push(c.r, c.g, c.b, a);
        };

        const pushWater = (lx, y, lz, c, a = 1) => {
            const m = Matrix.Compose(
                new Vector3(GAP_SCALE, GAP_SCALE, GAP_SCALE),
                Quaternion.Identity(),
                new Vector3(lx + 0.5, y + 0.54, lz + 0.5)
            );
            waterMatrices.push(...m.toArray());
            waterColors.push(c.r, c.g, c.b, a);
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

        // Height cache (+border)
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

                const base = getColorForHeight(h, wx, wz);

                // Slope shading adds depth without geometry cost
                const slope = Math.max(
                    Math.abs(h - nE),
                    Math.abs(h - nW),
                    Math.abs(h - nN),
                    Math.abs(h - nS)
                );
                const shadeFactor = 1.0 - Math.min(0.40, slope * 0.06);
                pushSurface(lx, h, lz, shade(base, shadeFactor), 1);

                // Cliff skirts (bounded)
                const fillSkirt = (neighborH, dx, dz) => {
                    const diff = h - neighborH;
                    if (diff <= 0) return;
                    const depth = Math.min(diff, SKIRT_DEPTH);
                    for (let i = 1; i <= depth; i++) {
                        const y = h - i;
                        const matId = getMaterialAt(wx, y, wz);
                        pushSurface(
                            lx + dx,
                            y,
                            lz + dz,
                            colorForMaterial(matId, base, i),
                            1
                        );
                    }
                };

                fillSkirt(nE, 1, 0);
                fillSkirt(nW, -1, 0);
                fillSkirt(nN, 0, 1);
                fillSkirt(nS, 0, -1);

                const biome = getBiomeAt(wx, wz);

                // Ice overlay
                const iceF = getIceFactor(wx, wz, h);
                if (iceF > 0.02) {
                    const wc = getWaterColor(wx, wz);
                    pushWater(lx, h, lz, shade(wc, 0.95 + iceF * 0.10), 0.28 + iceF * 0.55);
                }

                // Rivers overlay
                const riverF = getRiverFactor(wx, wz);
                if (iceF < 0.22 && riverF > 0.55) {
                    const wc = getWaterColor(wx, wz);

                    let riverColor = wc;
                    if (biome.id === "crystalline_plains") {
                        riverColor = new Color3(Math.min(1, wc.r * 0.5), Math.min(1, wc.g * 0.7), Math.min(1, wc.b * 1.5));
                    } else if (biome.id === "crimson_desert") {
                        riverColor = new Color3(Math.min(1, wc.r * 1.25), Math.min(1, wc.g * 0.6), Math.min(1, wc.b * 0.55));
                    } else if (biome.id === "fungal_marsh") {
                        riverColor = new Color3(Math.min(1, wc.r * 0.7), Math.min(1, wc.g * 0.5), Math.min(1, wc.b * 1.2));
                    }

                    pushWater(lx, h, lz, riverColor, 0.78);
                }

                // Ocean/lake plane
                if (h <= WATER_LEVEL) {
                    const wc = getWaterColor(wx, wz);
                    pushWater(lx, WATER_LEVEL, lz, wc, 0.72);
                }

                // Objects/POIs
                const blocks = getTreeAt(wx, wz, h);
                if (blocks && blocks.length) {
                    for (const b of blocks) {
                        const c = treeColors[b.type] ?? new Color3(1, 0, 1);
                        pushSurface(b.x - xOffset, b.y, b.z - zOffset, c, 1);
                    }
                }
            }
        }

        surface.thinInstanceSetBuffer("matrix", surfaceMatrices, 16, true);
        surface.thinInstanceSetBuffer("color", surfaceColors, 4, true);

        water.thinInstanceSetBuffer("matrix", waterMatrices, 16, true);
        water.thinInstanceSetBuffer("color", waterColors, 4, true);

        this.surfaceMesh = surface;
        this.waterMesh = water;
    }

    dispose() {
        if (this.surfaceMesh) this.surfaceMesh.dispose();
        if (this.waterMesh) this.waterMesh.dispose();
    }
}
