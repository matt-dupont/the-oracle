import { noise2D, hash2D } from "../util/hash.js";
import { Color3 } from "@babylonjs/core";

export const WATER_LEVEL = -7;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fract = (v) => v - Math.floor(v);

function rand01(ix, iz) {
    // stable 0..1
    const h = Math.abs(hash2D(ix, iz));
    return fract(h * 43758.5453123);
}

function n(x, z) {
    const v = noise2D(x, z);
    return Number.isFinite(v) ? v : 0;
}

// -----------------------------
// Crater field (big lunar basins)
// -----------------------------
const CRATER_CELL = 76;

function craterField(x, z) {
    const cx = Math.floor(x / CRATER_CELL);
    const cz = Math.floor(z / CRATER_CELL);

    let out = 0;

    for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
            const gx = cx + ox;
            const gz = cz + oz;

            const density = rand01(gx * 971 + 13, gz * 631 + 97);
            const count = density > 0.70 ? (density > 0.90 ? 2 : 1) : 0;
            if (!count) continue;

            for (let i = 0; i < count; i++) {
                const sx = rand01(gx * 1013 + i * 77, gz * 2017 + i * 131);
                const sz = rand01(gx * 3011 + i * 211, gz * 911 + i * 97);

                const centerX = gx * CRATER_CELL + Math.floor(sx * CRATER_CELL);
                const centerZ = gz * CRATER_CELL + Math.floor(sz * CRATER_CELL);

                const radius = 18 + rand01(gx * 733 + i * 19, gz * 439 + i * 23) * 44; // 18..62
                const depth = 8 + rand01(gx * 881 + i * 29, gz * 557 + i * 31) * 22;  // 8..30

                const dx = x - centerX;
                const dz = z - centerZ;
                const d = Math.sqrt(dx * dx + dz * dz);

                const influence = radius * 1.6;
                if (d > influence) continue;

                const t = clamp01(d / radius);

                // bowl
                const bowl = 1 - t;
                out -= (bowl * bowl) * depth;

                // rim (narrow band near radius)
                const rimCenter = radius * 1.02;
                const rimWidth = radius * 0.16;
                const rimD = Math.abs(d - rimCenter);
                const rimT = 1 - clamp01(rimD / rimWidth);
                out += (rimT * rimT) * (depth * 0.38);

                // ejecta apron
                const apron = 1 - clamp01((d - radius * 1.05) / (radius * 0.55));
                out += apron * (depth * 0.05);
            }
        }
    }

    return out;
}

// -----------------------------
// Ravine for water/ice “flow”
// -----------------------------
const RAVINE_WIDTH = 10;
const RAVINE_SHOULDER = 28;
const RAVINE_DEPTH = 12;

function ravineCenterZ(x, z) {
    // gentle meander in X
    const base = n(x * 0.0055, 0) * 48;
    const wobble = n(x * 0.014, 133.7) * 18;
    const warp = n(x * 0.02, z * 0.02) * 2.5;
    return base + wobble + warp;
}

export function getRavineFactor(x, z) {
    const cz = ravineCenterZ(x, z);
    const d = Math.abs(z - cz);

    // 1 near center, 0 outside shoulder
    const t = clamp01((d - RAVINE_WIDTH) / RAVINE_SHOULDER);
    const s = t * t * (3 - 2 * t); // smoothstep
    return 1 - s;
}

function ravineCarve(x, z) {
    const f = getRavineFactor(x, z);
    return f > 0 ? -(f * f) * RAVINE_DEPTH : 0;
}

// -----------------------------
// Height
// -----------------------------
export function getHeight(x, z) {
    let h = 0;

    // large basins + rolling dunes
    h += n(x * 0.0035, z * 0.0035) * 8.0;
    h += n(x * 0.0105, z * 0.0105) * 3.4;

    // crater systems
    h += craterField(x, z);

    // ravine cut
    h += ravineCarve(x, z);

    // micro grain
    h += n(x * 0.22, z * 0.22) * 0.9;

    // global bias slightly downward
    h -= 3.5;

    return Math.round(h);
}

// -----------------------------
// Color (PURE moon dust: neutral greys only)
// -----------------------------
export function getColorForHeight(h, x, z) {
    // Pure Moon Palette: Neutral grays and whites
    let lum;
    
    if (h < WATER_LEVEL) {
        lum = 0.12; // Deep craters/shadows
    } else if (h < -5) {
        lum = 0.18; // Lowlands
    } else if (h < 5) {
        lum = 0.28; // Surface
    } else if (h < 15) {
        lum = 0.45; // Highlands
    } else if (h < 25) {
        lum = 0.65; // High peaks
    } else {
        lum = 0.85; // Brightest summits
    }

    // Add some per-voxel noise for texture/realism
    const j = (rand01(Math.floor(x), Math.floor(z)) - 0.5) * 0.05;
    lum = Math.max(0.05, Math.min(1.0, lum + j));

    // ✅ absolutely neutral grey
    return new Color3(lum, lum, lum);
}

// -----------------------------
// Water/ice surface color
// -----------------------------
export function getWaterColor(x, z) {
    // Dark "Frozen" water/ice look for moon craters
    return new Color3(0.1, 0.12, 0.15);
}
