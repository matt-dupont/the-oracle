// src/world/objects.js
import { hash2D } from "../util/hash.js";
import { Color3 } from "@babylonjs/core";
import { WATER_LEVEL, getRavineFactor } from "./terrain.js";

// Minimal “beacons” (rare), readable top-down, no clutter.
export function getTreeAt(worldX, worldZ, terrainH) {
    if (terrainH <= WATER_LEVEL + 1) return null;

    const rav = getRavineFactor(worldX, worldZ);
    if (rav > 0.62) return null;

    const h = Math.abs(hash2D(worldX, worldZ));
    if (h < 0.9982) return null; // rarer

    const blocks = [];
    const height = 3 + Math.floor((h - 0.9982) * 2200); // ~3..8

    for (let y = 1; y <= height; y++) {
        blocks.push({ x: worldX, y: terrainH + y, z: worldZ, type: "beacon" });
    }
    blocks.push({ x: worldX, y: terrainH + height + 1, z: worldZ, type: "glow" });

    return blocks;
}

export function getTreeColors() {
    return {
        beacon: new Color3(0.6, 0.6, 0.65), // Muted steel
        glow: new Color3(0.9, 0.9, 1.0),    // Bright white frost
    };
}
