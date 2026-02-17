// src/world/biomes.js
// JSON-driven biomes + compatibility for objects.js:
// - ensures biome.objectProbabilities always exists (objects.js requires it)

import { noise2D, hash2D } from "../util/hash.js";
import { Color3 } from "@babylonjs/core";
import worldConfig from "./worldConfig.json";

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth01 = (t) => t * t * (3 - 2 * t);

export const BIOME_CELL = worldConfig.biomeCell;
const TRANSITION_BAND = worldConfig.transitionBand;

function defaultObjectProbabilities(profile) {
    // objects.js expects these keys to exist:
    // ruin, spire, crystal, crystal_cluster, monolith
    // Values are *weights* used cumulatively in objects.js.
    // Keep them modest so POIs remain special.
    switch (profile) {
        case "desert":
            return { ruin: 0.10, spire: 0.20, crystal: 0.18, crystal_cluster: 0.22, monolith: 0.06 };
        case "swamp":
            return { ruin: 0.06, spire: 0.08, crystal: 0.12, crystal_cluster: 0.22, monolith: 0.03 };
        case "forest":
            return { ruin: 0.06, spire: 0.10, crystal: 0.16, crystal_cluster: 0.22, monolith: 0.03 };
        case "plains":
            return { ruin: 0.06, spire: 0.10, crystal: 0.16, crystal_cluster: 0.20, monolith: 0.03 };
        case "mountains":
            return { ruin: 0.08, spire: 0.22, crystal: 0.12, crystal_cluster: 0.16, monolith: 0.04 };
        case "volcanic":
            return { ruin: 0.07, spire: 0.24, crystal: 0.10, crystal_cluster: 0.14, monolith: 0.04 };
        case "glacier":
            return { ruin: 0.05, spire: 0.08, crystal: 0.12, crystal_cluster: 0.18, monolith: 0.03 };
        case "ruins":
            return { ruin: 0.28, spire: 0.12, crystal: 0.14, crystal_cluster: 0.18, monolith: 0.06 };
        default:
            return { ruin: 0.06, spire: 0.10, crystal: 0.14, crystal_cluster: 0.18, monolith: 0.03 };
    }
}

const BIOME_LIST = worldConfig.biomes.map((b) => {
    const objectProbabilities =
        b.objectProbabilities && typeof b.objectProbabilities === "object"
            ? {
                ruin: Number(b.objectProbabilities.ruin ?? 0),
                spire: Number(b.objectProbabilities.spire ?? 0),
                crystal: Number(b.objectProbabilities.crystal ?? 0),
                crystal_cluster: Number(b.objectProbabilities.crystal_cluster ?? 0),
                monolith: Number(b.objectProbabilities.monolith ?? 0),
            }
            : defaultObjectProbabilities(b.profile);

    return {
        ...b,
        baseColor: new Color3(b.baseColor[0], b.baseColor[1], b.baseColor[2]),
        waterColor: b.waterColor ? new Color3(b.waterColor[0], b.waterColor[1], b.waterColor[2]) : null,
        riverTint: b.riverTint ? { r: b.riverTint[0], g: b.riverTint[1], b: b.riverTint[2] } : null,
        objectProbabilities,
    };
});

export const Biomes = Object.freeze(
    BIOME_LIST.reduce((acc, b) => {
        acc[b.id] = b;
        return acc;
    }, /** @type {Record<string, any>} */ ({}))
);

export const BiomeType = Object.freeze(
    BIOME_LIST.reduce((acc, b) => {
        acc[b.id.toUpperCase()] = b.id;
        return acc;
    }, /** @type {Record<string, string>} */ ({}))
);

function warp(x, z) {
    const cfg = worldConfig.climate;
    const w1 = noise2D(x * cfg.warpFreq, z * cfg.warpFreq);
    const w2 = noise2D((x + 100) * cfg.warpFreq, (z - 100) * cfg.warpFreq);
    return { x: x + w1 * cfg.warpStrength, z: z - w2 * cfg.warpStrength };
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

function climateAt(cx, cz) {
    const cfg = worldConfig.climate;

    const temp = clamp01((noise2D(cx * cfg.tempFreq + 19.2, cz * cfg.tempFreq - 33.1) + 1) * 0.5);
    const moist = clamp01((noise2D(cx * cfg.moistFreq - 101.7, cz * cfg.moistFreq + 88.4) + 1) * 0.5);
    const elev = clamp01((noise2D(cx * cfg.elevFreq + 11.0, cz * cfg.elevFreq + 7.0) + 1) * 0.5);

    const biasT = ((noise2D(cx * cfg.biasTempFreq + 200, cz * cfg.biasTempFreq - 90) + 1) * 0.5 - 0.5) * cfg.biasTempAmp;
    const biasM = ((noise2D(cx * cfg.biasMoistFreq - 40, cz * cfg.biasMoistFreq + 140) + 1) * 0.5 - 0.5) * cfg.biasMoistAmp;
    const biasE = ((noise2D(cx * cfg.biasElevFreq + 12, cz * cfg.biasElevFreq - 12) + 1) * 0.5 - 0.5) * cfg.biasElevAmp;

    return {
        temp: clamp01(temp + biasT),
        moist: clamp01(moist + biasM),
        elev: clamp01(elev + biasE),
    };
}

function scoreNear(v, center, width, pow) {
    const d = Math.abs(v - center);
    const s = clamp01(1 - d / Math.max(1e-6, width));
    return Math.pow(s, Math.max(0.0001, pow));
}

function biomeScore(biome, c, rPocket) {
    const pref = biome.climatePref ?? {};
    let s = 1.0;

    if (pref.temp) s *= scoreNear(c.temp, pref.temp.center, pref.temp.width, pref.temp.pow ?? 1);
    if (pref.moist) s *= scoreNear(c.moist, pref.moist.center, pref.moist.width, pref.moist.pow ?? 1);
    if (pref.elev) s *= scoreNear(c.elev, pref.elev.center, pref.elev.width, pref.elev.pow ?? 1);

    if (biome.rarityGate) {
        const thr = biome.rarityGate.threshold ?? 0.85;
        const mult = biome.rarityGate.belowMultiplier ?? 0.35;
        s *= rPocket > thr ? 1.0 : mult;
    }

    return s;
}

function pickTypeForCell(cx, cz) {
    const c = climateAt(cx, cz);
    const r = cellRand01(cx, cz, 91);
    const pocket = cellRand01(cx, cz, 777);

    const overlay = worldConfig.ruinsOverlay;
    if (overlay?.enabled && pocket > overlay.threshold && Biomes[overlay.biomeId]) {
        return overlay.biomeId;
    }

    let bestId = BIOME_LIST[0]?.id ?? "crystalline_plains";
    let bestScore = -1;

    const jitter = (r - 0.5) * 0.04;

    for (const b of BIOME_LIST) {
        if (overlay?.enabled && b.id === overlay.biomeId) continue;
        const s = biomeScore(b, c, pocket) + jitter;
        if (s > bestScore) {
            bestScore = s;
            bestId = b.id;
        }
    }

    if (bestScore < 0.08) return "crystalline_plains";
    return bestId;
}

function nearestTwoCells(x, z) {
    const w = warp(x, z);
    const gx = Math.floor(w.x / BIOME_CELL);
    const gz = Math.floor(w.z / BIOME_CELL);

    /** @type {{type:string,d2:number}|null} */
    let bestA = null;
    /** @type {{type:string,d2:number}|null} */
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
    const biomeA = Biomes[a.type] ?? Biomes["crystalline_plains"];
    const biomeB = Biomes[b.type] ?? Biomes["crystalline_plains"];

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

        rough += (it.biome.roughness ?? 1) * it.w;
        vert += (it.biome.vertical ?? 1) * it.w;
        wet += (it.biome.wetness ?? 0) * it.w;
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
    const n = (((noise2D(x * 0.08 + 12.3, z * 0.08 - 9.7) + 1) * 0.5) - 0.5) * 0.10;

    if (biome.waterColor) {
        return new Color3(
            clamp01(biome.waterColor.r + n),
            clamp01(biome.waterColor.g + n),
            clamp01(biome.waterColor.b + n)
        );
    }

    const base = biome.baseColor;
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
