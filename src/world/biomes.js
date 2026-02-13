// src/world/biomes.js
// FIXED biome map:
// - Removes "province bucket gating" that was trapping you in hot biomes.
// - Uses continuous climate fields (temp/moist/elev) to choose biome per cell.
// - Guarantees real desert/swamp/forest/mountains/glacier distribution.
// - Keeps Voronoi regions + thin blend band so biomes are distinct.

import { noise2D, hash2D } from "../util/hash.js";
import { Color3 } from "@babylonjs/core";

export const BiomeType = Object.freeze({
    CRYSTALLINE_PLAINS: "crystalline_plains",
    VOLCANIC_HIGHLANDS: "volcanic_highlands",
    ALIEN_FOREST: "alien_forest",
    FUNGAL_MARSH: "fungal_marsh",
    ANCIENT_RUINS: "ancient_ruins",
    GLACIAL_FIELDS: "glacial_fields",
    CRIMSON_DESERT: "crimson_desert",
    AZURE_PEAKS: "azure_peaks",
});

export const Biomes = Object.freeze({
    [BiomeType.CRIMSON_DESERT]: {
        id: BiomeType.CRIMSON_DESERT,
        name: "Crimson Desert",
        // Make desert read as "sand/oxide" not same as volcanic
        baseColor: new Color3(0.86, 0.42, 0.20),
        profile: "desert",
        roughness: 0.55,
        vertical: 0.55,
        wetness: 0.05,
        objectProbabilities: { monolith: 0.40, crystal: 0.20, plant: 0.40 },
    },
    [BiomeType.FUNGAL_MARSH]: {
        id: BiomeType.FUNGAL_MARSH,
        name: "Fungal Marsh",
        baseColor: new Color3(0.42, 0.35, 0.62),
        profile: "swamp",
        roughness: 0.45,
        vertical: 0.40,
        wetness: 0.95,
        objectProbabilities: { mushroom: 0.65, plant: 0.25, crystal: 0.10 },
    },
    [BiomeType.AZURE_PEAKS]: {
        id: BiomeType.AZURE_PEAKS,
        name: "Azure Peaks",
        baseColor: new Color3(0.18, 0.36, 0.86),
        profile: "mountains",
        roughness: 1.25,
        vertical: 1.55,
        wetness: 0.25,
        objectProbabilities: { spire: 0.50, crystal_cluster: 0.30, beacon: 0.20 },
    },
    [BiomeType.VOLCANIC_HIGHLANDS]: {
        id: BiomeType.VOLCANIC_HIGHLANDS,
        name: "Volcanic Highlands",
        // Dark basaltic, clearly NOT desert
        baseColor: new Color3(0.22, 0.20, 0.24),
        profile: "volcanic",
        roughness: 1.15,
        vertical: 1.35,
        wetness: 0.10,
        objectProbabilities: { spire: 0.55, ruin: 0.20, crystal: 0.25 },
    },
    [BiomeType.CRYSTALLINE_PLAINS]: {
        id: BiomeType.CRYSTALLINE_PLAINS,
        name: "Crystalline Plains",
        baseColor: new Color3(0.58, 0.70, 0.86),
        profile: "plains",
        roughness: 0.70,
        vertical: 0.75,
        wetness: 0.20,
        objectProbabilities: { crystal: 0.55, crystal_cluster: 0.30, spire: 0.15 },
    },
    [BiomeType.ALIEN_FOREST]: {
        id: BiomeType.ALIEN_FOREST,
        name: "Alien Forest",
        baseColor: new Color3(0.18, 0.58, 0.40),
        profile: "forest",
        roughness: 0.80,
        vertical: 0.85,
        wetness: 0.55,
        objectProbabilities: { alien_tree: 0.60, plant_cluster: 0.30, mushroom: 0.10 },
    },
    [BiomeType.GLACIAL_FIELDS]: {
        id: BiomeType.GLACIAL_FIELDS,
        name: "Glacial Fields",
        baseColor: new Color3(0.82, 0.92, 1.00),
        profile: "glacier",
        roughness: 0.65,
        vertical: 0.85,
        wetness: 0.35,
        objectProbabilities: { ice_formation: 0.70, crystal: 0.20, spire: 0.10 },
    },
    [BiomeType.ANCIENT_RUINS]: {
        id: BiomeType.ANCIENT_RUINS,
        name: "Ancient Ruins",
        baseColor: new Color3(0.62, 0.62, 0.52),
        profile: "ruins",
        roughness: 0.95,
        vertical: 0.95,
        wetness: 0.20,
        objectProbabilities: { ruin: 0.60, monolith: 0.30, ancient_structure: 0.10 },
    },
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth01 = (t) => t * t * (3 - 2 * t);

// Biome region size (world units). Chunk=16.
// 24 = ~1.5 chunks, 16 = ~1 chunk (more chaotic), 32 = ~2 chunks (larger patches).
export const BIOME_CELL = 24;

// Thin transition band => crisp biome borders
const TRANSITION_BAND = 0.18;

// Light warp so regions aren’t grid-like, but doesn’t smear them.
function warp(x, z) {
    const w1 = noise2D(x * 0.030, z * 0.030);
    const w2 = noise2D((x + 100) * 0.030, (z - 100) * 0.030);
    const s = 2.4;
    return { x: x + w1 * s, z: z - w2 * s };
}

function cellRand01(cx, cz, salt) {
    const h = hash2D(cx * 928371 + salt, cz * 1231337 - salt);
    return clamp01((h + 1) * 0.5);
}

function featurePoint(cx, cz) {
    const rx = cellRand01(cx, cz, 11);
    const rz = cellRand01(cx, cz, 23);
    return {
        x: (cx + 0.15 + rx * 0.70) * BIOME_CELL,
        z: (cz + 0.15 + rz * 0.70) * BIOME_CELL,
    };
}

// Continuous climate fields over CELL coordinates.
// IMPORTANT: frequencies chosen so climate varies every few cells (not hundreds).
function climateAt(cx, cz) {
    // Base signals
    const temp = clamp01((noise2D(cx * 0.22 + 19.2, cz * 0.22 - 33.1) + 1) * 0.5);
    const moist = clamp01((noise2D(cx * 0.20 - 101.7, cz * 0.20 + 88.4) + 1) * 0.5);
    const elev = clamp01((noise2D(cx * 0.18 + 11.0, cz * 0.18 + 7.0) + 1) * 0.5);

    // Low-frequency bias to form coherent patches without "continent lock"
    const biasT = ((noise2D(cx * 0.07 + 200, cz * 0.07 - 90) + 1) * 0.5 - 0.5) * 0.18;
    const biasM = ((noise2D(cx * 0.06 - 40, cz * 0.06 + 140) + 1) * 0.5 - 0.5) * 0.18;
    const biasE = ((noise2D(cx * 0.06 + 12, cz * 0.06 - 12) + 1) * 0.5 - 0.5) * 0.14;

    return {
        temp: clamp01(temp + biasT),
        moist: clamp01(moist + biasM),
        elev: clamp01(elev + biasE),
    };
}

function scoreNear(v, target, width) {
    const d = Math.abs(v - target);
    return clamp01(1 - d / Math.max(1e-6, width));
}

function pickTypeForCell(cx, cz) {
    const c = climateAt(cx, cz);
    const r = cellRand01(cx, cz, 91);
    const pocket = cellRand01(cx, cz, 777);

    // Rare overlays: ruins pockets anywhere (but not too frequent)
    if (pocket > 0.992) return BiomeType.ANCIENT_RUINS;

    // Build scores for major biomes
    // This guarantees we don’t get stuck in one family.
    const sDesert =
        Math.pow(scoreNear(c.temp, 0.85, 0.35), 1.4) *
        Math.pow(scoreNear(c.moist, 0.15, 0.30), 1.5) *
        Math.pow(scoreNear(c.elev, 0.45, 0.55), 0.9);

    const sSwamp =
        Math.pow(scoreNear(c.moist, 0.90, 0.35), 1.5) *
        Math.pow(scoreNear(c.elev, 0.25, 0.40), 1.2) *
        Math.pow(scoreNear(c.temp, 0.60, 0.55), 0.8);

    const sForest =
        Math.pow(scoreNear(c.moist, 0.70, 0.40), 1.2) *
        Math.pow(scoreNear(c.elev, 0.45, 0.55), 0.9) *
        Math.pow(scoreNear(c.temp, 0.55, 0.55), 0.9);

    const sMount =
        Math.pow(scoreNear(c.elev, 0.88, 0.30), 1.6) *
        Math.pow(scoreNear(c.temp, 0.55, 0.65), 0.8);

    const sGlacier =
        Math.pow(scoreNear(c.temp, 0.18, 0.30), 1.6) *
        Math.pow(scoreNear(c.elev, 0.60, 0.70), 0.8);

    // Volcanic: high + hot pockets, but rare-ish
    let sVolc =
        Math.pow(scoreNear(c.temp, 0.75, 0.40), 1.1) *
        Math.pow(scoreNear(c.elev, 0.75, 0.40), 1.2) *
        Math.pow(scoreNear(c.moist, 0.25, 0.45), 1.0);

    // Make volcanic not everywhere: gate with hash pocket
    sVolc *= pocket > 0.85 ? 1.0 : 0.35;

    // Plains fills the rest: moderate everything
    const sPlains =
        Math.pow(scoreNear(c.temp, 0.55, 0.60), 1.0) *
        Math.pow(scoreNear(c.moist, 0.40, 0.60), 1.0) *
        Math.pow(scoreNear(c.elev, 0.45, 0.70), 1.0);

    // Add tiny randomness so borders aren’t perfectly deterministic ties
    const jitter = (r - 0.5) * 0.04;

    const options = [
        { id: BiomeType.CRIMSON_DESERT, s: sDesert + jitter },
        { id: BiomeType.FUNGAL_MARSH, s: sSwamp + jitter * 0.6 },
        { id: BiomeType.ALIEN_FOREST, s: sForest + jitter * 0.6 },
        { id: BiomeType.AZURE_PEAKS, s: sMount + jitter * 0.5 },
        { id: BiomeType.GLACIAL_FIELDS, s: sGlacier + jitter * 0.5 },
        { id: BiomeType.VOLCANIC_HIGHLANDS, s: sVolc + jitter * 0.3 },
        { id: BiomeType.CRYSTALLINE_PLAINS, s: sPlains + jitter * 0.2 },
    ];

    options.sort((a, b) => b.s - a.s);
    const best = options[0];

    // Safety: if all scores are tiny, default to plains
    if (!best || best.s < 0.08) return BiomeType.CRYSTALLINE_PLAINS;
    return best.id;
}

function nearestTwoCells(x, z) {
    const w = warp(x, z);
    const gx = Math.floor(w.x / BIOME_CELL);
    const gz = Math.floor(w.z / BIOME_CELL);

    let bestA = null;
    let bestB = null;

    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const cx = gx + dx;
            const cz = gz + dz;
            const p = featurePoint(cx, cz);

            const dxp = w.x - p.x;
            const dzp = w.z - p.z;
            const d2 = dxp * dxp + dzp * dzp;

            const type = pickTypeForCell(cx, cz);
            const cand = { type, d2 };

            if (!bestA || d2 < bestA.d2) {
                bestB = bestA;
                bestA = cand;
            } else if (!bestB || d2 < bestB.d2) {
                bestB = cand;
            }
        }
    }

    if (!bestB) bestB = bestA;
    return [bestA, bestB];
}

export function getBiomeWeights(x, z) {
    const [a, b] = nearestTwoCells(x, z);
    const biomeA = Biomes[a.type];
    const biomeB = Biomes[b.type];

    if (biomeA.id === biomeB.id) return [{ biome: biomeA, w: 1 }];

    const d0 = Math.sqrt(a.d2);
    const d1 = Math.sqrt(b.d2);

    const edge = clamp01((d1 - d0) / (BIOME_CELL * 0.55));
    const t = smooth01(clamp01((edge - TRANSITION_BAND) / (1.0 - TRANSITION_BAND)));

    const wA = clamp01(0.06 + 0.94 * t);
    const wB = 1.0 - wA;

    return [
        { biome: biomeA, w: wA },
        { biome: biomeB, w: wB },
    ];
}

export function getBiomeMixAt(x, z) {
    const weights = getBiomeWeights(x, z);

    if (weights.length === 1) {
        const b = weights[0].biome;
        return {
            dominant: b,
            weights,
            baseColor: b.baseColor.clone(),
            roughness: b.roughness,
            vertical: b.vertical,
            wetness: b.wetness,
        };
    }

    let r = 0, g = 0, b = 0;
    let rough = 0, vert = 0, wet = 0;
    let dom = weights[0];

    for (const it of weights) {
        if (it.w > dom.w) dom = it;

        r += it.biome.baseColor.r * it.w;
        g += it.biome.baseColor.g * it.w;
        b += it.biome.baseColor.b * it.w;

        rough += it.biome.roughness * it.w;
        vert += it.biome.vertical * it.w;
        wet += it.biome.wetness * it.w;
    }

    return {
        dominant: dom.biome,
        weights,
        baseColor: new Color3(clamp01(r), clamp01(g), clamp01(b)),
        roughness: rough,
        vertical: vert,
        wetness: wet,
    };
}

export function getBiomeAt(x, z) {
    return getBiomeMixAt(x, z).dominant;
}

export function getBiomeBlendFactor(x, z, biome1, biome2) {
    const weights = getBiomeWeights(x, z);
    if (weights.length === 1) return weights[0].biome.id === biome1.id ? 1 : 0;

    let w1 = 0;
    for (const it of weights) if (it.biome.id === biome1.id) w1 = it.w;
    return clamp01(w1);
}

// Color helpers
export function getBiomeColor(biome, height, x, z) {
    const base = biome.baseColor;

    const h01 = clamp01((height + 32) / 96);
    const tex = (((noise2D(x * 0.20, z * 0.20) + 1) * 0.5) - 0.5) * 0.16;
    const lift = 0.78 + h01 * 0.32 + tex;

    return new Color3(
        clamp01(base.r * lift),
        clamp01(base.g * lift),
        clamp01(base.b * lift)
    );
}

export function getBiomeWaterColor(biome, x, z) {
    const base = biome.baseColor;
    const n = (((noise2D(x * 0.08 + 12.3, z * 0.08 - 9.7) + 1) * 0.5) - 0.5) * 0.10;

    // Push swamp water darker/greener, glacier brighter
    if (biome.id === BiomeType.FUNGAL_MARSH) {
        return new Color3(
            clamp01(0.10 + n),
            clamp01(0.22 + n),
            clamp01(0.18 + n)
        );
    }
    if (biome.id === BiomeType.GLACIAL_FIELDS) {
        return new Color3(
            clamp01(0.35 + n),
            clamp01(0.55 + n),
            clamp01(0.72 + n)
        );
    }

    return new Color3(
        clamp01(base.r * 0.55 + 0.25 + n),
        clamp01(base.g * 0.65 + 0.22 + n),
        clamp01(base.b * 0.82 + 0.14 + n)
    );
}

export function getBiomeMixedColor(height, x, z) {
    const mix = getBiomeMixAt(x, z);
    if (mix.weights.length === 1) return getBiomeColor(mix.dominant, height, x, z);

    let r = 0, g = 0, b = 0;
    for (const it of mix.weights) {
        const c = getBiomeColor(it.biome, height, x, z);
        r += c.r * it.w;
        g += c.g * it.w;
        b += c.b * it.w;
    }
    return new Color3(clamp01(r), clamp01(g), clamp01(b));
}

export function getBiomeMixedWaterColor(x, z) {
    const mix = getBiomeMixAt(x, z);
    if (mix.weights.length === 1) return getBiomeWaterColor(mix.dominant, x, z);

    let r = 0, g = 0, b = 0;
    for (const it of mix.weights) {
        const c = getBiomeWaterColor(it.biome, x, z);
        r += c.r * it.w;
        g += c.g * it.w;
        b += c.b * it.w;
    }
    return new Color3(clamp01(r), clamp01(g), clamp01(b));
}
