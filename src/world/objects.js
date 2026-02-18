// src/world/objects.js
import { Color3 } from "@babylonjs/core";

/**
 * Deterministic "object" / POI spawner.
 * Goal: you should always SEE stuff near spawn, and density should be high enough
 * that the world feels alive without turning into clutter.
 *
 * This returns an array of voxel blocks (x,y,z,type) or null.
 * Chunk.js already knows how to render these blocks as thin instances.
 */

    // --- Color palette per object block type ---
export function getTreeColors() {
    return {
        // Keeping only essential colors for the system, though objects are currently disabled
        ruin: new Color3(0.78, 0.80, 0.84),
    };
}

export function getTreeAt(worldX, worldZ, h) {
    // Random object spawning disabled per user request
    return null;
}

