// src/world/materials.js
// Material stats for destructibility + "moon vibe" surface composition.
//
// These are gameplay knobs — tune them to feel good.
// hardness: baseline "HP" for a block to be mined/destroyed.
// blastResist: higher => bombs do less.
// laserResist: higher => lasers do less.

export const MaterialId = Object.freeze({
    VACUUM: "vacuum",
    REGOLITH: "regolith",
    BASALT: "basalt",
    ANORTHOSITE: "anorthosite",
    IMPACT_GLASS: "impact_glass",
    ICE: "ice",
    METAL: "metal",
    BEDROCK: "bedrock",
});

export const Materials = Object.freeze({
    [MaterialId.VACUUM]: {
        id: MaterialId.VACUUM,
        label: "Vacuum",
        hardness: 0,
        blastResist: 0,
        laserResist: 0,
    },

    // Loose dust layer
    [MaterialId.REGOLITH]: {
        id: MaterialId.REGOLITH,
        label: "Regolith",
        hardness: 1.0,
        blastResist: 0.7,
        laserResist: 0.9,
    },

    // Dark lunar maria rock
    [MaterialId.BASALT]: {
        id: MaterialId.BASALT,
        label: "Basalt",
        hardness: 4.8,
        blastResist: 3.8,
        laserResist: 2.8,
    },

    // Bright lunar highlands rock
    [MaterialId.ANORTHOSITE]: {
        id: MaterialId.ANORTHOSITE,
        label: "Anorthosite",
        hardness: 3.9,
        blastResist: 3.2,
        laserResist: 2.6,
    },

    // Glassy ejecta near fresh crater rims
    [MaterialId.IMPACT_GLASS]: {
        id: MaterialId.IMPACT_GLASS,
        label: "Impact Glass",
        hardness: 2.2,
        blastResist: 1.4,
        laserResist: 1.0,
    },

    // Transparent-ish ice for “glaciers”
    [MaterialId.ICE]: {
        id: MaterialId.ICE,
        label: "Ice",
        hardness: 1.6,
        blastResist: 0.6,
        laserResist: 0.35, // lasers cut/melt ice well
    },

    // Rare strong fortification / resource
    [MaterialId.METAL]: {
        id: MaterialId.METAL,
        label: "Metal Vein",
        hardness: 6.8,
        blastResist: 6.2,
        laserResist: 4.8,
    },

    // Basically “don’t dig here unless you have super weapons”
    [MaterialId.BEDROCK]: {
        id: MaterialId.BEDROCK,
        label: "Bedrock",
        hardness: 999,
        blastResist: 999,
        laserResist: 999,
    },
});

export function getMaterial(id) {
    return Materials[id] ?? Materials[MaterialId.REGOLITH];
}

export function computeDamage(materialId, weaponType, baseDamage) {
    const m = getMaterial(materialId);
    if (baseDamage <= 0) return 0;

    if (weaponType === "bomb") {
        return baseDamage / Math.max(0.25, m.blastResist);
    }
    if (weaponType === "laser") {
        return baseDamage / Math.max(0.25, m.laserResist);
    }
    return baseDamage;
}
