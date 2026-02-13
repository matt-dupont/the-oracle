// src/world/terrain.js
// Same profile-based terrain, but tuned to make biome differences visually unmistakable.

import { noise2D, hash2D } from "../util/hash.js";
import { Color3 } from "@babylonjs/core";
import { MaterialId } from "./materials.js";
import { getBiomeAt, getBiomeMixAt, getBiomeMixedColor, getBiomeMixedWaterColor } from "./biomes.js";

export const WATER_LEVEL = -12;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (v) => v - Math.floor(v);

function n(x, z) {
    const v = noise2D(x, z);
    return Number.isFinite(v) ? v : 0;
}

function fbm(x, z, oct = 3, lac = 2.0, gain = 0.55) {
    let a = 1.0, f = 1.0, sum = 0.0, norm = 0.0;
    for (let i = 0; i < oct; i++) {
        sum += n(x * f, z * f) * a;
        norm += a;
        a *= gain;
        f *= lac;
    }
    return sum / Math.max(1e-6, norm);
}

function ridged(x, z, oct = 3, lac = 2.0, gain = 0.55) {
    let a = 1.0, f = 1.0, sum = 0.0, norm = 0.0;
    for (let i = 0; i < oct; i++) {
        const v = 1.0 - Math.abs(n(x * f, z * f));
        sum += Math.pow(v, 1.8) * a;
        norm += a;
        a *= gain;
        f *= lac;
    }
    return clamp01(sum / Math.max(1e-6, norm));
}

function rand01(ix, iz) {
    const h = Math.abs(hash2D(ix, iz));
    return fract(h * 43758.5453123);
}

// ---- Rivers / Ravines ----
export function getRiverFactor(x, z) {
    const warp = fbm(x * 0.010, z * 0.010, 2, 2.0, 0.55);
    const wx = x + warp * 18;
    const wz = z - warp * 14;

    const field = fbm(wx * 0.020 + 100, wz * 0.020 - 50, 2, 2.0, 0.55);
    const d = Math.abs(field);
    const river = clamp01(1.0 - (d / 0.16));
    return river * river;
}

export function getRavineFactor(x, z) {
    const warp = fbm(x * 0.012 + 17.7, z * 0.012 - 9.3, 2, 2.0, 0.55);
    const wx = x + warp * 12;
    const wz = z - warp * 9;

    const f = fbm(wx * 0.040, wz * 0.040, 2, 2.0, 0.55);
    const d = Math.abs(f);
    const rav = clamp01(1.0 - (d / 0.10));
    return rav * rav;
}

function riverCarve(x, z) {
    const f = getRiverFactor(x, z);
    if (f <= 0) return 0;
    return -(f * 10.0 + f * fbm(x * 0.08, z * 0.08, 2, 2.0, 0.55) * 2.0);
}

function ravineCarve(x, z) {
    const f = getRavineFactor(x, z);
    if (f <= 0) return 0;
    return -(f * 9.0 + f * fbm(x * 0.14, z * 0.14, 2, 2.0, 0.55) * 1.2);
}

// ---- Ice factor ----
export function getIceFactor(x, z, h) {
    const lat = clamp01(Math.abs(z) / 750);
    const cold = clamp01(lat * 0.70 + (fbm(x * 0.006 + 10, z * 0.006 - 5, 3, 2.0, 0.55) + 1) * 0.5 * 0.35);
    const elev = clamp01((h - 12) / 50);
    return clamp01(cold * (0.45 + 0.55 * elev));
}

// ---- Profiles ----
function profileBase(x, z) {
    const macro = fbm(x * 0.004, z * 0.004, 3, 2.0, 0.55);
    return macro * 20.0 + 6.0;
}

function heightDesert(x, z) {
    const base = profileBase(x, z) * 0.55;

    const dir = fbm(x * 0.002, z * 0.002, 2, 2.0, 0.55) * Math.PI;
    const v = Math.cos(dir) * x + Math.sin(dir) * z;

    const dunes = Math.sin(v * 0.20) * 4.5 + Math.sin(v * 0.55) * 1.6;
    const ripples = fbm(x * 0.09, z * 0.09, 2, 2.0, 0.55) * 1.2;

    const wash = getRiverFactor(x * 0.9, z * 0.9);
    const washCarve = -(wash * 5.5);

    const mesaMask = clamp01(((fbm(x * 0.002 + 90, z * 0.002 - 40, 2, 2.0, 0.55) + 1) * 0.5 - 0.80) / 0.20);
    const mesa = mesaMask > 0 ? mesaMask * 10.0 : 0;

    return base + dunes + ripples + washCarve + mesa;
}

function heightSwamp(x, z) {
    // Make swamp clearly lower than surroundings
    const base = profileBase(x, z) * 0.30 - 14.0;

    const basin = (fbm(x * 0.006, z * 0.006, 3, 2.0, 0.55) + 1) * 0.5;
    const basinCarve = -(basin * 9.0);

    const puddle = fbm(x * 0.11 + 33, z * 0.11 - 44, 2, 2.0, 0.55) * 3.2;

    const channel = getRiverFactor(x * 1.1, z * 1.1);
    const channelCarve = -(channel * 8.0);

    return base + basinCarve + puddle + channelCarve;
}

function heightMountains(x, z) {
    // Taller, sharper mountains so it’s unmistakable
    const base = profileBase(x, z) * 0.80 + 18.0;

    const backbone = ridged(x * 0.010, z * 0.010, 3, 2.0, 0.55);
    const ranges = ridged(x * 0.020 + 77, z * 0.020 - 55, 3, 2.0, 0.55);

    const big = (backbone - 0.5) * 78.0;
    const med = (ranges - 0.5) * 42.0;

    const crag = (ridged(x * 0.080 - 12, z * 0.080 + 77, 2, 2.0, 0.55) - 0.5) * 12.0;

    return base + big + med + crag;
}

function heightVolcanic(x, z) {
    const base = profileBase(x, z) * 0.72 + 12.0;

    const broken = fbm(x * 0.012, z * 0.012, 3, 2.0, 0.55) * 16.0;
    const rid = (ridged(x * 0.030, z * 0.030, 2, 2.0, 0.55) - 0.5) * 26.0;

    const calMask = clamp01(((fbm(x * 0.005 + 91, z * 0.005 - 18, 2, 2.0, 0.55) + 1) * 0.5 - 0.78) / 0.22);
    const caldera = calMask > 0 ? -(calMask * 18.0) : 0;

    return base + broken + rid + caldera;
}

function heightPlains(x, z) {
    const base = profileBase(x, z) * 0.60;
    const roll = fbm(x * 0.010, z * 0.010, 3, 2.0, 0.55) * 10.0;
    const micro = fbm(x * 0.090 + 21, z * 0.090 - 13, 2, 2.0, 0.55) * 2.8;
    return base + roll + micro;
}

function heightForest(x, z) {
    const base = heightPlains(x, z) * 0.95;
    const hum = fbm(x * 0.060, z * 0.060, 2, 2.0, 0.55) * 3.2;
    const creek = getRiverFactor(x * 1.05, z * 1.05) * -3.5;
    return base + hum + creek;
}

function heightGlacier(x, z) {
    const base = profileBase(x, z) * 0.72 + 8.0;
    const drift = fbm(x * 0.008, z * 0.008, 3, 2.0, 0.55) * 8.0;
    const crev = (ridged(x * 0.050, z * 0.050, 2, 2.0, 0.55) - 0.5) * 6.0;
    return base + drift + crev;
}

function heightRuins(x, z) {
    const base = heightPlains(x, z) * 1.05;
    const steps = Math.round(fbm(x * 0.020, z * 0.020, 2, 2.0, 0.55) * 6.0) * 1.5;
    return base + steps;
}

function heightForProfile(profile, x, z) {
    switch (profile) {
        case "desert": return heightDesert(x, z);
        case "swamp": return heightSwamp(x, z);
        case "mountains": return heightMountains(x, z);
        case "volcanic": return heightVolcanic(x, z);
        case "plains": return heightPlains(x, z);
        case "forest": return heightForest(x, z);
        case "glacier": return heightGlacier(x, z);
        case "ruins": return heightRuins(x, z);
        default: return heightPlains(x, z);
    }
}

function getHeightRaw(x, z) {
    const mix = getBiomeMixAt(x, z);

    let h = 0;
    for (const it of mix.weights) {
        h += heightForProfile(it.biome.profile, x, z) * it.w;
    }

    h += riverCarve(x, z) * 1.0;
    h += ravineCarve(x, z) * 0.85;

    h += fbm(x * 0.13 + 7.7, z * 0.13 - 4.2, 2, 2.0, 0.55) * 1.8;
    return h;
}

export function getHeight(x, z) {
    return Math.round(getHeightRaw(x, z));
}

export function getSurfaceMaterial(x, z) {
    const h = getHeight(x, z);

    const ice = getIceFactor(x, z, h);
    if (ice > 0.58) return MaterialId.ICE;
    if (h <= WATER_LEVEL) return MaterialId.WATER;

    const biome = getBiomeAt(x, z);
    if (biome.id === "volcanic_highlands") return MaterialId.BASALT;
    if (biome.id === "azure_peaks") return MaterialId.ANORTHOSITE;
    return MaterialId.REGOLITH;
}

export function getMaterialAt(x, y, z) {
    const h = getHeight(x, z);
    if (y > h) return MaterialId.VACUUM;

    const depth = h - y;
    if (y < -92) return MaterialId.BEDROCK;

    if (depth > 10 && depth < 18) {
        const m = clamp01((fbm(x * 0.08 + 9.7, z * 0.08 - 4.1, 2, 2.0, 0.55) + 1) * 0.5);
        if (m > 0.86) return MaterialId.METAL;
    }

    const biome = getBiomeAt(x, z);
    if (biome.id === "volcanic_highlands" && depth > 6) return MaterialId.BASALT;
    if (biome.id === "azure_peaks" && depth > 6) return MaterialId.ANORTHOSITE;

    return MaterialId.REGOLITH;
}

export function getColorForHeight(h, x, z) {
    let c = getBiomeMixedColor(h, x, z);

    const r = getRiverFactor(x, z);
    const v = getRavineFactor(x, z);
    const d = clamp01(r * 0.30 + v * 0.35);
    if (d > 0) {
        c = new Color3(
            clamp01(c.r * (1.0 - d)),
            clamp01(c.g * (1.0 - d)),
            clamp01(c.b * (1.0 - d))
        );
    }

    const ice = getIceFactor(x, z, h);
    if (ice > 0.35) {
        const t = clamp01((ice - 0.35) / 0.50);
        c = new Color3(
            lerp(c.r, c.r * 0.80, t),
            lerp(c.g, c.g * 0.88, t),
            lerp(c.b, Math.min(1, c.b * 1.10), t)
        );
    }

    const j = (rand01(Math.floor(x), Math.floor(z)) - 0.5) * 0.06;
    return new Color3(clamp01(c.r + j), clamp01(c.g + j), clamp01(c.b + j));
}

export function getWaterColor(x, z) {
    return getBiomeMixedWaterColor(x, z);
}
