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
    const rf = worldConfig.rivers.riverFreq ?? 0.015;
    
    // Warped domain for natural curves
    const warpX = fbm(x * 0.008, z * 0.008, 2, 2.0, 0.5) * 25;
    const warpZ = fbm(x * 0.008 + 100, z * 0.008 + 100, 2, 2.0, 0.5) * 25;
    
    const wx = x + warpX;
    const wz = z + warpZ;

    // Use a ridged-style field to create thin, long river channels
    const field1 = fbm(wx * rf, wz * rf, 2, 2.0, 0.5);
    const field2 = fbm(wx * rf + 50, wz * rf + 50, 2, 2.0, 0.5);
    
    // Intersection of two noise fields creates more branching/interesting paths
    const d = Math.abs(field1) * 0.7 + Math.abs(field2) * 0.3;

    // Sharpen the river: thin but deep
    const river = clamp01(1.0 - (d / 0.12));
    
    // Add some variation in width
    const widthVar = (fbm(x * 0.05, z * 0.05, 2, 2.0, 0.5) + 1) * 0.5;
    return river * river * (0.4 + 0.6 * widthVar);
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
    if (f <= 0.05) return 0;
    
    // Carve deep enough to hit water level
    const depth = worldConfig.rivers.riverDepth ?? 14.5;
    const carve = -(f * depth + f * fbm(x * 0.1, z * 0.1, 2, 2.0, 0.5) * 3.0);
    
    // Bank softening
    return carve;
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
    const macro = fbm(x * 0.003, z * 0.003, 3, 2.0, 0.5);
    const micro = fbm(x * 0.015, z * 0.015, 2, 2.0, 0.5) * 4.0;
    return macro * 25.0 + 8.0 + micro;
}

function heightDesert(x, z) {
    const base = profileBase(x, z) * 0.5;

    const dir = fbm(x * 0.001, z * 0.001, 2, 2.0, 0.5) * Math.PI * 2;
    const v = Math.cos(dir) * x + Math.sin(dir) * z;

    const dunes = Math.sin(v * 0.15) * 6.0 + Math.sin(v * 0.4) * 2.0;
    const ripples = fbm(x * 0.12, z * 0.12, 2, 2.0, 0.5) * 0.8;

    const lakeMask = clamp01(((fbm(x * 0.006 + 120, z * 0.006 - 60, 2, 2.0, 0.5) + 1) * 0.5 - 0.72) / 0.28);
    const lake = lakeMask > 0 ? -(lakeMask * 22.0) : 0;

    const mesaMask = clamp01(((fbm(x * 0.0015 + 90, z * 0.0015 - 40, 2, 2.0, 0.5) + 1) * 0.5 - 0.82) / 0.18);
    const mesa = mesaMask > 0 ? Math.pow(mesaMask, 0.5) * 15.0 : 0;

    return base + dunes + ripples + lake + mesa;
}

function heightSwamp(x, z) {
    const base = profileBase(x, z) * 0.35 - 12.0;

    const basin = (fbm(x * 0.007, z * 0.007, 3, 2, 0.5) + 1) * 0.5;
    const basinCarve = -(basin * 12.0);

    const puddle = fbm(x * 0.12 + 33, z * 0.12 - 44, 2, 2, 0.5) * 3.5;

    return base + basinCarve + puddle;
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
    const base = profileBase(x, z) * 0.5;
    const roll = fbm(x * 0.008, z * 0.008, 3, 2.0, 0.5) * 12.0;
    const micro = fbm(x * 0.08 + 21, z * 0.08 - 13, 2, 2.0, 0.5) * 2.5;

    const lakeMask = clamp01(((fbm(x * 0.005 + 200, z * 0.005 - 100, 2, 2, 0.5) + 1) * 0.5 - 0.78) / 0.22);
    const lake = -(lakeMask * 24.0);

    return base + roll + micro + lake;
}

function heightForest(x, z) {
    const base = heightPlains(x, z) * 0.98;
    const hum = fbm(x * 0.065, z * 0.065, 2, 2, 0.5) * 4.0;
    return base + hum;
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
