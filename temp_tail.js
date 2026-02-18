function addRuin(blocks, x, y, z, radius, height) {
    // Determine ruin style based on position hash
    const ruinStyle = Math.floor(h01(x * 37, z * 53) * 3); // 0, 1, or 2

    // Style 0: Classic ring with pillars (enhanced)
    if (ruinStyle === 0) {
        // Create platform base
        for (let dx = -radius-1; dx <= radius+1; dx++) {
            for (let dz = -radius-1; dz <= radius+1; dz++) {
                const d = Math.sqrt(dx*dx + dz*dz);
                if (d <= radius + 1) {
                    // Use darker material for base
                    blocks.push({ x: x + dx, y, z: z + dz, type: "ruinDark" });
                }
            }
        }

        // Ring wall
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const d = Math.sqrt(dx*dx + dz*dz);
                if (d > radius - 1 && d <= radius) {
                    // Wall height varies slightly
                    const wallHeight = 1 + Math.floor(h01(x + dx*3, z + dz*5) * 2);
                    for (let i = 1; i <= wallHeight; i++) {
                        blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "ruin" });
                    }

                    // Some sections get ornate tops
                    if (h01(x + dx*7, z + dz*11) > 0.7) {
                        blocks.push({ x: x + dx, y: y + wallHeight + 1, z: z + dz, type: "ruinOrnate" });
                    }
                }
            }
        }

        // Enhanced pillars
        const corners = [
            [radius-1, radius-1],
            [-(radius-1), radius-1],
            [radius-1, -(radius-1)],
            [-(radius-1), -(radius-1)],
        ];

        for (const [dx, dz] of corners) {
            const ht = height - Math.floor(h01(x + dx, z + dz) * 2);

            // Create wider base for pillars
            for (let pdx = -1; pdx <= 1; pdx++) {
                for (let pdz = -1; pdz <= 1; pdz++) {
                    if (Math.abs(pdx) + Math.abs(pdz) <= 1) {
                        blocks.push({ x: x + dx + pdx, y: y + 1, z: z + dz + pdz, type: "ruin" });
                    }
                }
            }

            // Main pillar
            for (let i = 2; i <= ht; i++) {
                blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "ruin" });

                // Add ornate details at intervals
                if (i % 3 === 0) {
                    blocks.push({ x: x + dx + 1, y: y + i, z: z + dz, type: "ruinOrnate" });
                    blocks.push({ x: x + dx - 1, y: y + i, z: z + dz, type: "ruinOrnate" });
                    blocks.push({ x: x + dx, y: y + i, z: z + dz + 1, type: "ruinOrnate" });
                    blocks.push({ x: x + dx, y: y + i, z: z + dz - 1, type: "ruinOrnate" });
                }
            }

            // Glowing top
            blocks.push({ x: x + dx, y: y + ht + 1, z: z + dz, type: "ruinAccent" });
        }

        // Central structure
        if (radius >= 4) {
            const centerHeight = Math.floor(height * 0.7);
            const centerRadius = Math.floor(radius * 0.4);

            // Central platform
            for (let dx = -centerRadius; dx <= centerRadius; dx++) {
                for (let dz = -centerRadius; dz <= centerRadius; dz++) {
                    if (dx*dx + dz*dz <= centerRadius*centerRadius) {
                        blocks.push({ x: x + dx, y: y + 1, z: z + dz, type: "ruinDark" });
                    }
                }
            }

            // Central pillar
            for (let i = 2; i <= centerHeight; i++) {
                blocks.push({ x: x, y: y + i, z: z, type: "ruin" });
            }

            // Glowing artifact on top
            blocks.push({ x: x, y: y + centerHeight + 1, z: z, type: "artifactGlow" });
        }
    }
    // Style 1: Stepped pyramid
    else if (ruinStyle === 1) {
        const maxRadius = radius + 1;
        const levels = 3 + Math.floor(h01(x * 19, z * 23) * 3); // 3-5 levels

        // Create stepped pyramid
        for (let level = 0; level < levels; level++) {
            const levelRadius = maxRadius - level;
            const levelY = y + level;

            // Create square platform for this level
            for (let dx = -levelRadius; dx <= levelRadius; dx++) {
                for (let dz = -levelRadius; dz <= levelRadius; dz++) {
                    // Use different materials for different levels
                    let blockType = "ruin";
                    if (level === 0) blockType = "ruinDark";
                    else if (level === levels - 1) blockType = "ruinOrnate";

                    blocks.push({ x: x + dx, y: levelY, z: z + dz, type: blockType });
                }
            }
        }

        // Add central structure on top
        const topY = y + levels;
        const centerHeight = 2 + Math.floor(h01(x * 31, z * 37) * 3);

        for (let i = 0; i < centerHeight; i++) {
            blocks.push({ x: x, y: topY + i, z: z, type: "ruin" });
        }

        // Glowing top
        blocks.push({ x: x, y: topY + centerHeight, z: z, type: "ruinAccent" });

        // Add decorative elements on the corners of each step
        for (let level = 0; level < levels - 1; level++) {
            const levelRadius = maxRadius - level;
            const levelY = y + level + 1;

            // Corner decorations
            const corners = [
                [levelRadius, levelRadius],
                [-levelRadius, levelRadius],
                [levelRadius, -levelRadius],
                [-levelRadius, -levelRadius],
            ];

            for (const [dx, dz] of corners) {
                if (h01(x + dx * 7, z + dz * 11) > 0.4) {
                    blocks.push({ x: x + dx, y: levelY, z: z + dz, type: "ruinOrnate" });
                }
            }
        }
    }
    // Style 2: Ancient temple/structure
    else {
        // Create foundation platform
        for (let dx = -radius-1; dx <= radius+1; dx++) {
            for (let dz = -radius-1; dz <= radius+1; dz++) {
                if (Math.abs(dx) <= radius && Math.abs(dz) <= radius) {
                    blocks.push({ x: x + dx, y, z: z + dz, type: "ruinDark" });
                }
            }
        }

        // Create walls
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                // Only create walls on the perimeter
                if (Math.abs(dx) === radius || Math.abs(dz) === radius) {
                    const wallHeight = 3 + Math.floor(h01(x + dx*5, z + dz*7) * 2);

                    for (let i = 1; i <= wallHeight; i++) {
                        blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "ruin" });
                    }

                    // Add ornate top to some wall sections
                    if (h01(x + dx*13, z + dz*17) > 0.6) {
                        blocks.push({ x: x + dx, y: y + wallHeight + 1, z: z + dz, type: "ruinOrnate" });
                    }
                }
            }
        }

        // Create interior columns
        const columnPositions = [];
        const innerRadius = radius - 2;

        if (innerRadius >= 2) {
            // Add columns in a grid pattern
            for (let dx = -innerRadius + 1; dx <= innerRadius - 1; dx += 2) {
                for (let dz = -innerRadius + 1; dz <= innerRadius - 1; dz += 2) {
                    if (dx !== 0 || dz !== 0) { // Skip center
                        columnPositions.push([dx, dz]);
                    }
                }
            }

            // Create columns
            for (const [dx, dz] of columnPositions) {
                const columnHeight = 4 + Math.floor(h01(x + dx*11, z + dz*13) * 2);

                for (let i = 1; i <= columnHeight; i++) {
                    blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "ruin" });
                }

                // Add ornate top
                blocks.push({ x: x + dx, y: y + columnHeight + 1, z: z + dz, type: "ruinOrnate" });
            }

            // Create central altar/structure
            const centerHeight = 2 + Math.floor(h01(x * 29, z * 31) * 3);

            // Base of altar
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    blocks.push({ x: x + dx, y: y + 1, z: z + dz, type: "ruinDark" });
                }
            }

            // Central pillar
            for (let i = 2; i <= centerHeight; i++) {
                blocks.push({ x: x, y: y + i, z: z, type: "ruin" });
            }

            // Glowing artifact on top
            blocks.push({ x: x, y: y + centerHeight + 1, z: z, type: "artifactGlow" });
        }
    }
}

function addSpire(blocks, x, y, z, height) {
    // Determine spire style based on position hash
    const spireStyle = Math.floor(h01(x * 41, z * 59) * 3); // 0, 1, or 2

    // Style 0: Enhanced classic spire with more details
    if (spireStyle === 0) {
        // Create wider base
        const baseRadius = 2;
        for (let dx = -baseRadius; dx <= baseRadius; dx++) {
            for (let dz = -baseRadius; dz <= baseRadius; dz++) {
                const d = Math.sqrt(dx*dx + dz*dz);
                if (d <= baseRadius) {
                    blocks.push({ x: x + dx, y, z: z + dz, type: "spireBase" });
                }
            }
        }

        // Create tapered tower
        for (let i = 1; i <= height; i++) {
            // Main central column
            blocks.push({ x, y: y + i, z, type: "spire" });

            // Taper the spire as it goes up
            const layerRadius = Math.max(0, Math.floor(baseRadius * (1 - i/height)));

            // Add structural supports at regular intervals
            if (i % 4 === 0 || i === 1 || i === height) {
                for (let dx = -layerRadius; dx <= layerRadius; dx++) {
                    for (let dz = -layerRadius; dz <= layerRadius; dz++) {
                        if ((dx !== 0 || dz !== 0) && Math.abs(dx) + Math.abs(dz) <= layerRadius) {
                            blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "spire" });
                        }
                    }
                }
            }

            // Add glowing elements at intervals
            if (i % 3 === 0) {
                blocks.push({ x, y: y + i, z: z + 1, type: "spireGlow" });
                blocks.push({ x, y: y + i, z: z - 1, type: "spireGlow" });
                blocks.push({ x: x + 1, y: y + i, z, type: "spireGlow" });
                blocks.push({ x: x - 1, y: y + i, z, type: "spireGlow" });
            }
        }

        // Create more elaborate top
        blocks.push({ x, y: y + height + 1, z, type: "spireTop" });
        blocks.push({ x, y: y + height + 2, z, type: "beacon" });

        // Add floating elements near the top
        const floatingElements = 3 + Math.floor(h01(x * 13, z * 17) * 3);
        for (let i = 0; i < floatingElements; i++) {
            const angle = (i / floatingElements) * Math.PI * 2;
            const radius = 2 + Math.floor(h01(x + i*19, z + i*23) * 2);
            const fx = x + Math.round(Math.cos(angle) * radius);
            const fz = z + Math.round(Math.sin(angle) * radius);
            const fy = y + height - Math.floor(height * 0.2) + Math.floor(h01(fx, fz) * 3);

            blocks.push({ x: fx, y: fy, z: fz, type: "spireGlow" });
        }
    }
    // Style 1: Crystalline tech spire
    else if (spireStyle === 1) {
        // Create geometric base
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) + Math.abs(dz) <= 3) {
                    blocks.push({ x: x + dx, y, z: z + dz, type: "spireBase" });
                }
            }
        }

        // Create central column with geometric patterns
        for (let i = 1; i <= height; i++) {
            // Main column
            blocks.push({ x, y: y + i, z, type: "spire" });

            // Create geometric patterns at intervals
            if (i % 3 === 0) {
                // Cross pattern
                for (let d = 1; d <= 2; d++) {
                    blocks.push({ x: x + d, y: y + i, z, type: "spire" });
                    blocks.push({ x: x - d, y: y + i, z, type: "spire" });
                    blocks.push({ x, y: y + i, z: z + d, type: "spire" });
                    blocks.push({ x, y: y + i, z: z - d, type: "spire" });
                }

                // Add glowing accents
                blocks.push({ x: x + 1, y: y + i, z: z + 1, type: "spireGlow" });
                blocks.push({ x: x - 1, y: y + i, z: z - 1, type: "spireGlow" });
                blocks.push({ x: x + 1, y: y + i, z: z - 1, type: "spireGlow" });
                blocks.push({ x: x - 1, y: y + i, z: z + 1, type: "spireGlow" });
            }
            else if (i % 5 === 0) {
                // Diamond pattern
                for (let d = 1; d <= 2; d++) {
                    if (d === 1) {
                        blocks.push({ x: x + d, y: y + i, z, type: "spireGlow" });
                        blocks.push({ x: x - d, y: y + i, z, type: "spireGlow" });
                        blocks.push({ x, y: y + i, z: z + d, type: "spireGlow" });
                        blocks.push({ x, y: y + i, z: z - d, type: "spireGlow" });
                    } else {
                        blocks.push({ x: x + d, y: y + i, z, type: "spire" });
                        blocks.push({ x: x - d, y: y + i, z, type: "spire" });
                        blocks.push({ x, y: y + i, z: z + d, type: "spire" });
                        blocks.push({ x, y: y + i, z: z - d, type: "spire" });
                    }
                }
            }
        }

        // Create elaborate top structure
        const topHeight = 3 + Math.floor(h01(x * 23, z * 29) * 3);
        for (let i = 1; i <= topHeight; i++) {
            blocks.push({ x, y: y + height + i, z, type: "spireTop" });

            // Add decorative elements to top
            if (i < topHeight) {
                const radius = topHeight - i;
                for (let j = 0; j < 4; j++) {
                    const angle = (j / 4) * Math.PI * 2;
                    const dx = Math.round(Math.cos(angle) * radius);
                    const dz = Math.round(Math.sin(angle) * radius);
                    blocks.push({ x: x + dx, y: y + height + i, z: z + dz, type: "spireGlow" });
                }
            }
        }

        // Final beacon
        blocks.push({ x, y: y + height + topHeight + 1, z, type: "beacon" });
    }
    // Style 2: Alien monolith/obelisk
    else {
        // Create platform base
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                const d = Math.abs(dx) + Math.abs(dz);
                if (d <= 3) {
                    blocks.push({ x: x + dx, y, z: z + dz, type: "spireBase" });

                    // Add some height variation to the base
                    if (d <= 1 && h01(x + dx*7, z + dz*11) > 0.5) {
                        blocks.push({ x: x + dx, y: y + 1, z: z + dz, type: "spireBase" });
                    }
                }
            }
        }

        // Create main obelisk structure
        const width = 1 + Math.floor(h01(x * 31, z * 37) * 2); // 1-2 blocks wide

        for (let i = 1; i <= height; i++) {
            // Taper at the top
            const currentWidth = i > height * 0.8 ? 0 : width;

            // Create the structure at this layer
            for (let dx = -currentWidth; dx <= currentWidth; dx++) {
                for (let dz = -currentWidth; dz <= currentWidth; dz++) {
                    blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "spire" });
                }
            }

            // Add glowing runes/patterns at intervals
            if (i % 4 === 0 || i === Math.floor(height/2)) {
                // Add glowing patterns on each face
                if (currentWidth > 0) {
                    // Pattern on each face
                    const patterns = [
                        [currentWidth, 0], [-currentWidth, 0], [0, currentWidth], [0, -currentWidth]
                    ];

                    for (const [dx, dz] of patterns) {
                        blocks.push({ x: x + dx, y: y + i, z: z + dz, type: "spireGlow" });
                    }
                } else {
                    // Just add to the center if we're at the tapered top
                    blocks.push({ x, y: y + i, z, type: "spireGlow" });
                }
            }
        }

        // Create top
        blocks.push({ x, y: y + height + 1, z, type: "spireTop" });
        blocks.push({ x, y: y + height + 2, z, type: "beacon" });
    }
}

function addCrystalCluster(blocks, x, y, z, seed) {
    // Determine crystal formation style based on position hash
    const crystalStyle = Math.floor(h01(x * 43, z * 61) * 3); // 0, 1, or 2

    // Style 0: Enhanced diverse crystal cluster
    if (crystalStyle === 0) {
        // Create base platform
        const baseRadius = 2 + Math.floor(seed * 2);
        for (let dx = -baseRadius; dx <= baseRadius; dx++) {
            for (let dz = -baseRadius; dz <= baseRadius; dz++) {
                const d = Math.sqrt(dx*dx + dz*dz);
                if (d <= baseRadius && h01(x + dx*5, z + dz*7) > 0.3) {
                    blocks.push({ x: x + dx, y, z: z + dz, type: "crystal" });
                }
            }
        }

        // Create diverse crystal formations
        const count = 6 + Math.floor(seed * 8);
        for (let i = 0; i < count; i++) {
            // More controlled distribution - keep crystals closer to center
            const angle = (i / count) * Math.PI * 2 + seed * 0.5;
            const distance = Math.floor(h01(x + i*17, z + i*19) * baseRadius * 1.5);
            const dx = Math.round(Math.cos(angle) * distance);
            const dz = Math.round(Math.sin(angle) * distance);

            // Vary crystal heights more dramatically
            const ht = 3 + Math.floor(h01(x + dx*3, z + dz*5) * 12);

            // Use different crystal types for more variety
            let type;
            const typeRoll = h01(x + dx*7, z + dz*9);
            if (typeRoll < 0.3) type = "crystal";
            else if (typeRoll < 0.6) type = "crystal2";
            else if (typeRoll < 0.8) type = "crystalRed";
            else type = "crystalGreen";

            // Create the crystal
            for (let h = 1; h <= ht; h++) {
                blocks.push({ x: x + dx, y: y + h, z: z + dz, type });

                // Add crystal "arms" at intervals for more interesting shapes
                if (h % 3 === 0 && h < ht - 1 && h01(x + dx*11, z + dz*13) > 0.6) {
                    const armAngle = h01(x + dx*h, z + dz*h) * Math.PI * 2;
                    const armDx = Math.round(Math.cos(armAngle));
                    const armDz = Math.round(Math.sin(armAngle));
                    blocks.push({ x: x + dx + armDx, y: y + h, z: z + dz + armDz, type });
                }
            }

            // Add glowing top
            blocks.push({ x: x + dx, y: y + ht + 1, z: z + dz, type: "crystalCore" });
        }

        // Add central formation
        const centerHeight = 5 + Math.floor(seed * 10);
        for (let h = 1; h <= centerHeight; h++) {
            blocks.push({ x, y: y + h, z, type: "crystal2" });

            // Add arms at intervals
            if (h % 2 === 0 && h < centerHeight) {
                for (let j = 0; j < 4; j++) {
                    const angle = (j / 4) * Math.PI * 2;
                    const armDx = Math.round(Math.cos(angle));
                    const armDz = Math.round(Math.sin(angle));
                    blocks.push({ x: x + armDx, y: y + h, z: z + armDz, type: "crystal2" });
                }
            }
        }

        // Add special glowing top to central crystal
        blocks.push({ x, y: y + centerHeight + 1, z, type: "glow" });
    }
    // Style 1: Geometric crystal formation
    else if (crystalStyle === 1) {
        // Create geometric base
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                if (Math.abs(dx) + Math.abs(dz) <= 4) {
                    blocks.push({ x: x + dx, y, z: z + dz, type: "crystal" });
                }
            }
        }

        // Create central geometric crystal structure
        const centerHeight = 8 + Math.floor(seed * 8);

        // Main crystal column
        for (let h = 1; h <= centerHeight; h++) {
            blocks.push({ x, y: y + h, z, type: "crystal" });

            // Create geometric patterns at different heights
            const layer = Math.floor(h / 3);
            if (layer > 0 && layer < 4) {
                // Create cross pattern that gets smaller as we go up
                const extent = 4 - layer;
                for (let e = 1; e <= extent; e++) {
                    // Alternate crystal types for visual interest
                    const layerType = layer % 2 === 0 ? "crystal" : "crystal2";

                    blocks.push({ x: x + e, y: y + h, z, type: layerType });
                    blocks.push({ x: x - e, y: y + h, z, type: layerType });
                    blocks.push({ x, y: y + h, z: z + e, type: layerType });
                    blocks.push({ x, y: y + h, z: z - e, type: layerType });
                }
            }
        }

        // Add glowing core at the top
        blocks.push({ x, y: y + centerHeight + 1, z, type: "crystalCore" });

        // Add smaller surrounding crystals
        const surroundCount = 6 + Math.floor(seed * 6);
        for (let i = 0; i < surroundCount; i++) {
            const angle = (i / surroundCount) * Math.PI * 2;
            const distance = 3 + Math.floor(h01(x + i*23, z + i*29) * 2);
            const dx = Math.round(Math.cos(angle) * distance);
            const dz = Math.round(Math.sin(angle) * distance);

            // Vary crystal types
            let type;
            if (i % 3 === 0) type = "crystalRed";
            else if (i % 3 === 1) type = "crystalGreen";
            else type = "crystal2";

            const ht = 2 + Math.floor(h01(x + dx*13, z + dz*17) * 5);

            // Create smaller crystal
            for (let h = 1; h <= ht; h++) {
                blocks.push({ x: x + dx, y: y + h, z: z + dz, type });
            }

            // Add glowing top
            blocks.push({ x: x + dx, y: y + ht + 1, z: z + dz, type: "crystalCore" });
        }
    }
    // Style 2: Crystal cave/grotto
    else {
        // Create base depression/cave floor
        const baseRadius = 4;
        for (let dx = -baseRadius; dx <= baseRadius; dx++) {
            for (let dz = -baseRadius; dz <= baseRadius; dz++) {
                const d = Math.sqrt(dx*dx + dz*dz);
                if (d <= baseRadius) {
                    // Use different crystal types for floor
                    const floorType = h01(x + dx*3, z + dz*5) < 0.7 ? "crystal" : "crystal2";
                    blocks.push({ x: x + dx, y, z: z + dz, type: floorType });
                }
            }
        }

        // Create stalagmites (from floor)
        const stalagmiteCount = 8 + Math.floor(seed * 7);
        for (let i = 0; i < stalagmiteCount; i++) {
            const angle = (i / stalagmiteCount) * Math.PI * 2;
            const distance = Math.floor(h01(x + i*19, z + i*23) * baseRadius * 0.9);
            const dx = Math.round(Math.cos(angle) * distance);
            const dz = Math.round(Math.sin(angle) * distance);

            // Vary crystal types
            let type;
            const typeRoll = h01(x + dx*11, z + dz*13);
            if (typeRoll < 0.3) type = "crystal";
            else if (typeRoll < 0.6) type = "crystal2";
            else if (typeRoll < 0.8) type = "crystalRed";
            else type = "crystalGreen";

            const ht = 2 + Math.floor(h01(x + dx*7, z + dz*11) * 6);

            // Create stalagmite
            for (let h = 1; h <= ht; h++) {
                blocks.push({ x: x + dx, y: y + h, z: z + dz, type });

                // Add some crystal "branches" near the base
                if (h <= 2 && h01(x + dx*h, z + dz*h) > 0.6) {
                    const branchAngle = h01(x + dx*h*3, z + dz*h*5) * Math.PI * 2;
                    const branchDx = Math.round(Math.cos(branchAngle));
                    const branchDz = Math.round(Math.sin(branchAngle));
                    blocks.push({ x: x + dx + branchDx, y: y + h, z: z + dz + branchDz, type });
                }
            }

            // Add glowing tip to some stalagmites
            if (h01(x + dx*17, z + dz*19) > 0.6) {
                blocks.push({ x: x + dx, y: y + ht + 1, z: z + dz, type: "crystalCore" });
            }
        }

        // Create central crystal formation
        const centerHeight = 6 + Math.floor(seed * 5);
        const centerType = h01(x, z) < 0.5 ? "crystal" : "crystal2";

        for (let h = 1; h <= centerHeight; h++) {
            blocks.push({ x, y: y + h, z, type: centerType });

            // Add branches at intervals
            if (h % 2 === 0 && h < centerHeight - 1) {
                for (let j = 0; j < 3; j++) {
                    const angle = (j / 3) * Math.PI * 2 + h * 0.3; // Spiral effect
                    const branchDx = Math.round(Math.cos(angle));
                    const branchDz = Math.round(Math.sin(angle));
                    blocks.push({ x: x + branchDx, y: y + h, z: z + branchDz, type: centerType });

                    // Sometimes add a second segment
                    if (h01(x + branchDx*h, z + branchDz*h) > 0.6) {
                        blocks.push({ x: x + branchDx*2, y: y + h, z: z + branchDz*2, type: centerType });
                    }
                }
            }
        }

        // Add glowing core at the top of central formation
        blocks.push({ x, y: y + centerHeight + 1, z, type: "glow" });
    }
}

function addIceFormation(blocks, x, y, z, seed) {
    // Determine ice formation type based on seed
    const formationType = Math.floor((seed * 100) % 3); // 0, 1, or 2

    // Type 0: Glacier/Ice Sheet (wide, lower profile)
    if (formationType === 0) {
        const width = 4 + Math.floor(seed * 3); // 4-6 blocks wide
        const height = 3 + Math.floor(seed * 4); // 3-6 blocks tall

        // Create base layer (widest)
        for (let dx = -width; dx <= width; dx++) {
            for (let dz = -width; dz <= width; dz++) {
                // Create circular/oval shape
                const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist <= width) {
                    // Add some randomness to edges
                    if (dist > width - 1 && h01(x + dx, z + dz) < 0.4) continue;

                    // Vary height slightly for natural look
                    const heightVar = Math.floor(h01(x + dx*3, z + dz*5) * 2);
                    blocks.push({ x: x + dx, y: y + 1, z: z + dz, type: "iceSpire" });

                    // Add some height variation
                    if (dist < width - 1) {
                        blocks.push({ x: x + dx, y: y + 2, z: z + dz, type: "iceSpire" });

                        // Central area is higher
                        if (dist < width/2) {
                            for (let h = 3; h <= height + heightVar; h++) {
                                // Taper as we go up
                                if (dist < (width/2) - (h-3)) {
                                    blocks.push({ x: x + dx, y: y + h, z: z + dz, type: "iceSpire" });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add some ice core highlights
        for (let i = 0; i < 3; i++) {
            const dx = Math.floor((h01(x + i*17, z + i*23) - 0.5) * (width/2));
            const dz = Math.floor((h01(x + i*31, z + i*13) - 0.5) * (width/2));
            const h = height + Math.floor(h01(x + dx, z + dz) * 2);
            blocks.push({ x: x + dx, y: y + h, z: z + dz, type: "iceCore" });
        }
    }
    // Type 1: Ice Crystals (geometric, medium height)
    else if (formationType === 1) {
        const centerHeight = 5 + Math.floor(seed * 7); // 5-11 blocks tall

        // Main crystal
        for (let i = 1; i <= centerHeight; i++) {
            blocks.push({ x, y: y + i, z, type: "iceSpire" });

            // Create geometric crystal shape
            const layer = Math.floor(i / 2);
            if (layer > 0 && layer < 4) {
                // Cross pattern that gets smaller as we go up
                const extent = 4 - layer;
                for (let e = 1; e <= extent; e++) {
                    blocks.push({ x: x + e, y: y + i, z, type: "iceSpire" });
                    blocks.push({ x: x - e, y: y + i, z, type: "iceSpire" });
                    blocks.push({ x, y: y + i, z: z + e, type: "iceSpire" });
                    blocks.push({ x, y: y + i, z: z - e, type: "iceSpire" });
                }
            }
        }

        // Crystal top
        blocks.push({ x, y: y + centerHeight + 1, z, type: "iceCore" });

        // Smaller surrounding crystals
        const crystalCount = 3 + Math.floor(seed * 4); // 3-6 crystals
        for (let c = 0; c < crystalCount; c++) {
            const angle = (c / crystalCount) * Math.PI * 2;
            const dist = 3 + Math.floor(h01(x + c*19, z + c*23) * 2);
            const cx = x + Math.round(Math.cos(angle) * dist);
            const cz = z + Math.round(Math.sin(angle) * dist);
            const height = 2 + Math.floor(h01(cx, cz) * 4);

            // Create smaller crystal
            for (let i = 1; i <= height; i++) {
                blocks.push({ x: cx, y: y + i, z: cz, type: "iceSpire" });

                // Add small arms on some crystals
                if (i === Math.floor(height/2) && h01(cx*3, cz*5) > 0.5) {
                    blocks.push({ x: cx + 1, y: y + i, z: cz, type: "iceSpire" });
                    blocks.push({ x: cx, y: y + i, z: cz + 1, type: "iceSpire" });
                }
            }

            // Some get glowing tops
            if (h01(cx*7, cz*11) > 0.6) {
                blocks.push({ x: cx, y: y + height + 1, z: cz, type: "iceCore" });
            }
        }
    }
    // Type 2: Ice Cave/Formation (more natural looking)
    else {
        const width = 3 + Math.floor(seed * 3); // 3-5 blocks wide
        const height = 4 + Math.floor(seed * 6); // 4-9 blocks tall

        // Create arch/cave structure
        for (let dx = -width; dx <= width; dx++) {
            for (let dz = -width; dz <= width; dz++) {
                const dist = Math.sqrt(dx*dx + dz*dz);

                // Create circular base
                if (dist <= width) {
                    // Base layer
                    blocks.push({ x: x + dx, y: y + 1, z: z + dz, type: "iceSpire" });

                    // Second layer
                    if (dist <= width - 0.5) {
                        blocks.push({ x: x + dx, y: y + 2, z: z + dz, type: "iceSpire" });
                    }

                    // Wall layers (leave center hollow)
                    for (let h = 3; h <= height; h++) {
                        // Create walls but leave center open for cave effect
                        if (dist > width/2 && dist <= width - (h/height)) {
                            blocks.push({ x: x + dx, y: y + h, z: z + dz, type: "iceSpire" });
                        }
                    }

                    // Top/ceiling layer
                    if (dist <= width - 1 && h01(x + dx*5, z + dz*7) > 0.3) {
                        blocks.push({ x: x + dx, y: y + height + 1, z: z + dz, type: "iceSpire" });
                    }
                }
            }
        }

        // Add some ice core highlights in the ceiling
        for (let i = 0; i < 2; i++) {
            const dx = Math.floor((h01(x + i*29, z + i*41) - 0.5) * (width - 1));
            const dz = Math.floor((h01(x + i*37, z + i*19) - 0.5) * (width - 1));
            blocks.push({ x: x + dx, y: y + height + 1, z: z + dz, type: "iceCore" });
        }

        // Add some stalagmites/stalactites
        const spikeCount = 2 + Math.floor(seed * 3);
        for (let s = 0; s < spikeCount; s++) {
            const dx = Math.floor((h01(x + s*13, z + s*17) - 0.5) * width/2);
            const dz = Math.floor((h01(x + s*23, z + s*11) - 0.5) * width/2);
            const spikeHeight = 2 + Math.floor(h01(x + dx*3, z + dz*5) * 3);

            // Stalagmite (from ground)
            for (let h = 1; h <= spikeHeight; h++) {
                blocks.push({ x: x + dx, y: y + h, z: z + dz, type: "iceSpire" });
            }

            // Stalactite (from ceiling)
            const dx2 = Math.floor((h01(x + s*31, z + s*43) - 0.5) * width/2);
            const dz2 = Math.floor((h01(x + s*47, z + s*29) - 0.5) * width/2);
            const spikeHeight2 = 1 + Math.floor(h01(x + dx2*7, z + dz2*3) * 2);

            for (let h = 0; h < spikeHeight2; h++) {
                blocks.push({ x: x + dx2, y: y + height + 1 - h, z: z + dz2, type: "iceSpire" });
            }
        }
    }
}

/**
 * Main hook used by Chunk.js
 * @returns {Array<{x:number,y:number,z:number,type:string}>|null}
 */
export function getTreeAt(worldX, worldZ, terrainH) {
    // don't place under water
    if (terrainH <= WATER_LEVEL + 1) return null;

    // avoid placing on steep rilles and directly in river beds
    const rav = getRavineFactor(worldX, worldZ);
    if (rav > 0.65) return null;

    const river = getRiverFactor(worldX, worldZ);
    if (river > 0.70) return null;

    const biome = getBiomeAt(worldX, worldZ);
    const blocks = [];

    // --- Big POIs on a grid (rarer + more intentional) ---
    const CELL = 96;
    const { cx, cz } = cellId(worldX, worldZ, CELL);
    const c = cellCenter(cx, cz, CELL);

    if (worldX === c.x && worldZ === c.z) {
        const p = h01(cx * 5011 + 7, cz * 9011 + 19);
        const spawnBoost = nearSpawnBoost(worldX, worldZ);

        // Slightly rarer than before
        const threshold = 0.83 - spawnBoost * 0.24;
        if (p > threshold) {
            const objectProbs = biome.objectProbabilities;

            // Cluster mask: prevents “random everywhere” towers
            const clusterMask = h01(cx * 911 + 5, cz * 733 + 9);
            const allowCluster = clusterMask > 0.38;

            // Ice special case stays (but still respects clustering a bit)
            const ice = getIceFactor(worldX, worldZ, terrainH);
            if (ice > 0.55 && allowCluster && h01(cx * 701 + 3, cz * 1109 + 9) > 0.42) {
                addIceFormation(blocks, worldX, terrainH, worldZ, p);
                return blocks;
            }

            if (!allowCluster) return null;

            // --- Proper weighted selection (fixes monolith bug) ---
            const wR = Number(objectProbs?.ruin ?? 0);
            const wS = Number(objectProbs?.spire ?? 0);
            const wC = Number(objectProbs?.crystal ?? 0);
            const wCC = Number(objectProbs?.crystal_cluster ?? 0);
            const wM = Number(objectProbs?.monolith ?? 0);

            const total = wR + wS + wC + wCC + wM;
            if (total <= 0) return null;

            const r = h01(cx * 133 + 17, cz * 277 + 23) * total;

            let acc = 0;

            acc += wR;
            if (r < acc && wR > 0) {
                const rad = 3 + Math.floor(h01(cx * 19, cz * 29) * 2);  // 3..4
                const ht = 4 + Math.floor(h01(cx * 31, cz * 41) * 4);   // 4..7
                addRuin(blocks, worldX, terrainH + 1, worldZ, rad, ht);
                return blocks;
            }

            acc += wS;
            if (r < acc && wS > 0) {
                // shorter spires = less ugly
                const ht = 8 + Math.floor(h01(cx * 47, cz * 59) * 9); // 8..16
                addSpire(blocks, worldX, terrainH, worldZ, ht);
                return blocks;
            }

            acc += wC;
            if (r < acc && wC > 0) {
                addCrystalCluster(blocks, worldX, terrainH, worldZ, p);
                return blocks;
            }

            acc += wCC;
            if (r < acc && wCC > 0) {
                addCrystalCluster(blocks, worldX, terrainH, worldZ, p);
                return blocks;
            }

            // Monolith (now correctly gated)
            if (wM > 0) {
                const height = 6 + Math.floor(h01(cx * 61, cz * 73) * 9); // 6..14
                for (let i = 1; i <= height; i++) {
                    blocks.push({ x: worldX, y: terrainH + i, z: worldZ, type: "monolith" });
                }
                blocks.push({ x: worldX, y: terrainH + height + 1, z: worldZ, type: "monolithGlow" });
                return blocks;
            }
        }
    }

    // --- Small ambient props (less spam + slight clustering) ---
    const spawnBoost = nearSpawnBoost(worldX, worldZ);

    // Reduce base densities
    const biomeDensity =
        biome.id === "fungal_marsh" || biome.id === "alien_forest"
            ? 0.040
            : 0.018;

    const prob = biomeDensity + spawnBoost * 0.02;

    // Cluster mask to avoid salt-and-pepper noise
    const ax = Math.floor(worldX / 6);
    const az = Math.floor(worldZ / 6);
    const ambientCluster = h01(ax * 41 + 7, az * 53 - 11);

    const a = h01(worldX * 3, worldZ * 3);

    if (ambientCluster > 0.55 && a < prob) {
        const kind = h01(worldX * 11 + 9, worldZ * 13 - 7);

        if (biome.id === "alien_forest") {
            if (kind < 0.55) {
                const height = 2 + Math.floor(h01(worldX * 17, worldZ * 19) * 2); // 2..3
                for (let i = 1; i <= height; i++) {
                    blocks.push({ x: worldX, y: terrainH + i, z: worldZ, type: "tree_trunk" });
                }
                blocks.push({ x: worldX, y: terrainH + height + 1, z: worldZ, type: "tree_canopy" });
            } else {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "shrub" });
            }
        } else if (biome.id === "fungal_marsh") {
            if (kind < 0.65) {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "mushroom" });
                if (h01(worldX * 23, worldZ * 29) < 0.22) {
                    blocks.push({ x: worldX, y: terrainH + 2, z: worldZ, type: "mushroom" });
                }
            } else {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "mushroomGlow" });
            }
        } else if (biome.id === "crystalline_plains") {
            if (kind < 0.65) {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "crystal" });
            } else {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "crystal2" });
            }
        } else if (biome.id === "crimson_desert") {
            if (kind < 0.75) {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "shrub" });
            } else {
                blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "crystal2" });
            }
        } else {
            // fallback: very minimal
            if (kind < 0.5) blocks.push({ x: worldX, y: terrainH + 1, z: worldZ, type: "shrub" });
        }

        return blocks;
    }

    return null;
}

