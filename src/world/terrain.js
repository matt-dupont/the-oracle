// src/world/terrain.js
// Terrain (height/material/color) with:
// - JSON-driven biome materials (no biome-id conditionals for rock types)
// - mountain spike control (soft clamp + tuned amplitudes)
// - better cohesion via biome vertical blending

import { noise2D, hash2D } from "../util/hash.js";
import { Color3 } from "@babylonjs/core";
import { MaterialId } from "./materials.js";
import { getBiomeAt, getBiomeMixAt, getBiomeMixedColor, getBiomeMixedWaterColor } from "./biomes.js";
import worldConfig from "./worldConfig.json";

export const WATER_LEVEL = worldConfig.waterLevel;

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

// soft clamp to stop insane ridged spikes without flattening everything
function softClamp(v, hardMax, knee) {
    if (v <= hardMax - knee) return v;
    const t = clamp01((v - (hardMax - knee)) / Math.max(1e-6, knee));
    // ease into hardMax
    return lerp(v, hardMax, t * t);
}

// ---- Rivers / Ravines ----
export function getRiverFactor(x, z) {
    const warp = fbm(x * 0.010, z * 0.010, 2, 2.0, 0.55);
    const wx = x + warp * 18;
    const wz = z - warp * 14;

    const field = fbm(wx * 0.020 + 100, wz * 0.020 - 50, 2, 2.0, 0.55);
    const d = Math.abs(field);

    // Wider and a bit stronger rivers (more visible water)
    const river = clamp01(1.0 - (d / 0.28));
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
    return -(f * worldConfig.rivers.riverDepth + f * fbm(x * 0.08, z * 0.08, 2, 2.0, 0.55) * 2.0);
}

function ravineCarve(x, z) {
    const f = getRavineFactor(x, z);
    if (f <= 0) return 0;
    return -(f * worldConfig.rivers.ravineDepth + f * fbm(x * 0.14, z * 0.14, 2, 2.0, 0.55) * 1.2);
}

// ---- Ice factor ----
export function getIceFactor(x, z, h) {
    const cfg = worldConfig.ice;
    const lat = clamp01(Math.abs(z) / cfg.latScale);
    const coldNoise = (fbm(x * 0.006 + 10, z * 0.006 - 5, 3, 2.0, 0.55) + 1) * 0.5;
    const cold = clamp01(lat * cfg.coldLatWeight + coldNoise * cfg.coldNoiseWeight);
    const elev = clamp01((h - cfg.elevStart) / cfg.elevRange);
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
    const base = profileBase(x, z) * 0.30 - 14.0;

    const basin = (fbm(x * 0.006, z * 0.006, 3, 2, 0.55) + 1) * 0.5;
    const basinCarve = -(basin * 9.0);

    const puddle = fbm(x * 0.11 + 33, z * 0.11 - 44, 2, 2, 0.55) * 3.2;

    const channel = getRiverFactor(x * 1.1, z * 1.1);
    const channelCarve = -(channel * 8.0);

    return base + basinCarve + puddle + channelCarve;
}

function heightMountains(x, z) {
    // More cohesive mountains:
    // - big ridge backbone + secondary ridges
    // - reduced high-frequency crag noise
    // - slight terracing at high altitudes for voxel readability
    // - still clamped by existing softClamp

    const mcfg = worldConfig.terrain.mountain;

    const base = profileBase(x, z) * 0.78 + mcfg.baseLift;

    // Ridge backbone (slow)
    const ridgeA = ridged(x * 0.0075, z * 0.0075, 3, 2, 0.55);
    // Secondary ranges (medium)
    const ridgeB = ridged(x * 0.015 + 77, z * 0.015 - 55, 3, 2, 0.55);

    // Turn ridges into a “mountain mask” so valleys stay sane
    const mask = clamp01((ridgeA - 0.38) / 0.62);
    const mask2 = mask * mask;

    let big = (ridgeA - 0.5) * (mcfg.bigAmp * 0.78) * (0.55 + 0.45 * mask2);
    let med = (ridgeB - 0.5) * (mcfg.medAmp * 0.72) * (0.45 + 0.55 * mask);

    // Gentle crag only (less noisy)
    const crag = (ridged(x * 0.050 - 12, z * 0.050 + 77, 2, 2, 0.55) - 0.5) * (mcfg.cragAmp * 0.55);

    // Erosion pushes down sharp needle peaks
    const erode = fbm(x * 0.020 + 9.1, z * 0.020 - 2.7, 2, 2, 0.55);
    const erosion = (erode * 0.5 + 0.5) * 7.0 * (0.40 + 0.60 * mask);

    let h = base + big + med + crag - erosion;

    // Subtle terracing above a threshold (keeps voxel charm without chaos)
    const t0 = 26;
    if (h > t0) {
        const step = 2.0;
        const terr = Math.round((h - t0) / step) * step + t0;
        h = h * 0.55 + terr * 0.45;
    }

    h = softClamp(h, mcfg.hardClamp, mcfg.softKnee);
    return h;
}

function heightVolcanic(x, z) {
    const base = profileBase(x, z) * 0.72 + 12.0;

    const broken = fbm(x * 0.012, z * 0.012, 3, 2, 0.55) * 16.0;
    const rid = (ridged(x * 0.030, z * 0.030, 2, 2, 0.55) - 0.5) * 26.0;

    const calMask = clamp01(((fbm(x * 0.005 + 91, z * 0.005 - 18, 2, 2, 0.55) + 1) * 0.5 - 0.78) / 0.22);
    const caldera = calMask > 0 ? -(calMask * 18.0) : 0;

    return base + broken + rid + caldera;
}

function heightPlains(x, z) {
    const base = profileBase(x, z) * 0.60;
    const roll = fbm(x * 0.010, z * 0.010, 3, 2, 0.55) * 10.0;
    const micro = fbm(x * 0.090 + 21, z * 0.090 - 13, 2, 2, 0.55) * 2.8;
    return base + roll + micro;
}

function heightForest(x, z) {
    const base = heightPlains(x, z) * 0.95;
    const hum = fbm(x * 0.060, z * 0.060, 2, 2, 0.55) * 3.2;
    const creek = getRiverFactor(x * 1.05, z * 1.05) * -3.5;
    return base + hum + creek;
}

function heightGlacier(x, z) {
    const base = profileBase(x, z) * 0.72 + 8.0;
    const drift = fbm(x * 0.008, z * 0.008, 3, 2, 0.55) * 8.0;
    const crev = (ridged(x * 0.050, z * 0.050, 2, 2, 0.55) - 0.5) * 6.0;
    return base + drift + crev;
}

function heightRuins(x, z) {
    const base = heightPlains(x, z) * 1.05;
    const steps = Math.round(fbm(x * 0.020, z * 0.020, 2, 2, 0.55) * 6.0) * 1.5;
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

    // Blend profiles AND biome vertical so transitions feel intentional
    let h = 0;
    let v = 0;

    for (const it of mix.weights) {
        const biome = it.biome;
        const local = heightForProfile(biome.profile, x, z);
        h += local * it.w;
        v += (biome.vertical ?? 1.0) * it.w;
    }

    // Apply vertical shaping as a gentle multiplier around a stable baseline
    const vertical = lerp(0.92, 1.12, clamp01((v - 0.6) / 1.2));
    h *= vertical;

    h += riverCarve(x, z);
    h += ravineCarve(x, z) * worldConfig.rivers.ravineMix;

    h += fbm(x * 0.13 + 7.7, z * 0.13 - 4.2, 2, 2, 0.55) * 1.8;
    return h;
}

export function getHeight(x, z) {
    // round-to-int for voxels, but raw is stabilized now (less spike jitter)
    return Math.round(getHeightRaw(x, z));
}

function materialFromId(id) {
    // only allow known MaterialId values; fallback to REGOLITH
    if (id === MaterialId.BASALT) return MaterialId.BASALT;
    if (id === MaterialId.ANORTHOSITE) return MaterialId.ANORTHOSITE;
    if (id === MaterialId.ICE) return MaterialId.ICE;
    if (id === MaterialId.METAL) return MaterialId.METAL;
    if (id === MaterialId.IMPACT_GLASS) return MaterialId.IMPACT_GLASS;
    if (id === MaterialId.BEDROCK) return MaterialId.BEDROCK;
    return MaterialId.REGOLITH;
}

export function getSurfaceMaterial(x, z) {
    const h = getHeight(x, z);

    const ice = getIceFactor(x, z, h);
    if (ice > 0.58) return MaterialId.ICE;
    if (h <= WATER_LEVEL) return MaterialId.WATER;

    const biome = getBiomeAt(x, z);
    const surf = biome.materials?.surface ?? "regolith";
    return materialFromId(surf);
}

export function getMaterialAt(x, y, z) {
    const h = getHeight(x, z);
    if (y > h) return MaterialId.VACUUM;

    const depth = h - y;
    if (y < -92) return MaterialId.BEDROCK;

    // Rare metal veins
    if (depth > 10 && depth < 18) {
        const m = clamp01((fbm(x * 0.08 + 9.7, z * 0.08 - 4.1, 2, 2, 0.55) + 1) * 0.5);
        if (m > 0.86) return MaterialId.METAL;
    }

    const biome = getBiomeAt(x, z);
    const sub = biome.materials?.subsurface ?? "regolith";
    return materialFromId(sub);
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
