// src/scene.js
import {
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    Color4,
    HemisphericLight,
    DirectionalLight,
    ShadowGenerator,
    PointLight,
    Color3,
    StandardMaterial,
    MeshBuilder,
    DynamicTexture,
} from "@babylonjs/core";

import { World } from "./world/World.js";

function setLoadingVisible(visible) {
    const el = document.getElementById("loading");
    if (!el) return;
    el.style.display = visible ? "flex" : "none";
    el.style.opacity = visible ? "1" : "0";
    el.style.pointerEvents = visible ? "auto" : "none";
}

function setLoadingText(text) {
    const el = document.getElementById("loading-text");
    if (!el) return;
    el.textContent = text;
}

function setLoadingBar(pct01) {
    const bar = document.getElementById("loading-bar");
    if (!bar) return;
    const p = Math.max(0, Math.min(1, pct01));
    bar.style.width = `${Math.round(p * 100)}%`;
}

function makeStarfield(scene) {
    const size = 1024;
    const dt = new DynamicTexture("stars", { width: size, height: size }, scene, false);
    const ctx = dt.getContext();

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, size, size);

    const starCount = 2400;
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() * size) | 0;
        const y = (Math.random() * size) | 0;
        const a = 0.20 + Math.random() * 0.80;
        const r = Math.random() < 0.05 ? 2 : 1;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, r, r);
    }

    dt.update(false);

    const sky = MeshBuilder.CreateSphere("sky", { diameter: 1600, segments: 16 }, scene);
    sky.isPickable = false;

    const m = new StandardMaterial("skyMat", scene);
    m.diffuseTexture = dt;
    m.emissiveTexture = dt;
    m.disableLighting = true;
    m.backFaceCulling = false;
    sky.material = m;
    sky.infiniteDistance = true;
}

function createSandboxBorder(scene, world) {
    const bounds = world.bounds;
    const minX = bounds.minWorldX;
    const maxX = bounds.maxWorldX;
    const minZ = bounds.minWorldZ;
    const maxZ = bounds.maxWorldZ;

    const wallThickness = 4;
    const wallTop = 6; // low profile
    const wallBottom = -40;
    const wallHeight = wallTop - wallBottom;
    const centerY = wallBottom + wallHeight * 0.5;

    const frameMat = new StandardMaterial("trayMat", scene);
    frameMat.diffuseColor = new Color3(0.02, 0.04, 0.05);
    frameMat.emissiveColor = new Color3(0.0, 0.20, 0.24);
    frameMat.specularColor = new Color3(0, 0, 0);

    const lipMat = new StandardMaterial("trayLipMat", scene);
    lipMat.diffuseColor = new Color3(0.02, 0.04, 0.05);
    lipMat.emissiveColor = new Color3(0.0, 0.45, 0.62);
    lipMat.specularColor = new Color3(0, 0, 0);

    const widthX = (maxX - minX) + 1;
    const widthZ = (maxZ - minZ) + 1;

    const mk = (name, w, h, d, px, py, pz, mat) => {
        const b = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        b.position.set(px, py, pz);
        b.material = mat;
        b.isPickable = false;
        b.freezeWorldMatrix();
        return b;
    };

    mk("tray_north", widthX + wallThickness * 2, wallHeight, wallThickness, (minX + maxX) * 0.5, centerY, minZ - wallThickness * 0.5, frameMat);
    mk("tray_south", widthX + wallThickness * 2, wallHeight, wallThickness, (minX + maxX) * 0.5, centerY, maxZ + wallThickness * 0.5, frameMat);
    mk("tray_west", wallThickness, wallHeight, widthZ + wallThickness * 2, minX - wallThickness * 0.5, centerY, (minZ + maxZ) * 0.5, frameMat);
    mk("tray_east", wallThickness, wallHeight, widthZ + wallThickness * 2, maxX + wallThickness * 0.5, centerY, (minZ + maxZ) * 0.5, frameMat);

    const lipH = 0.9;
    const lipY = wallTop - lipH * 0.5;

    mk("tray_lipN", widthX + wallThickness * 2, lipH, wallThickness, (minX + maxX) * 0.5, lipY, minZ - wallThickness * 0.5, lipMat);
    mk("tray_lipS", widthX + wallThickness * 2, lipH, wallThickness, (minX + maxX) * 0.5, lipY, maxZ + wallThickness * 0.5, lipMat);
    mk("tray_lipW", wallThickness, lipH, widthZ + wallThickness * 2, minX - wallThickness * 0.5, lipY, (minZ + maxZ) * 0.5, lipMat);
    mk("tray_lipE", wallThickness, lipH, widthZ + wallThickness * 2, maxX + wallThickness * 0.5, lipY, (minZ + maxZ) * 0.5, lipMat);

    frameMat.freeze();
    lipMat.freeze();
}

function setupInput() {
    const keys = Object.create(null);
    const down = (e) => (keys[e.key.toLowerCase()] = true);
    const up = (e) => (keys[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return keys;
}

function spawnCityAndBuilders(scene, world, buildersCount) {
    const x = 0;
    const z = 0;
    const y = world.getGroundY(x, z);

    const city = MeshBuilder.CreateCylinder("cityCore", { height: 7, diameter: 10, tessellation: 12 }, scene);
    city.position.set(x, y + 4, z);
    city.isPickable = true;

    const cityLight = new PointLight("cityLight", city.position.clone(), scene);
    cityLight.intensity = 0.8;
    cityLight.range = 30;
    cityLight.diffuse = new Color3(0.0, 0.8, 1.0);

    const cityMat = new StandardMaterial("cityMat", scene);
    cityMat.diffuseColor = new Color3(0.03, 0.06, 0.08);
    cityMat.emissiveColor = new Color3(0.0, 0.65, 0.85);
    cityMat.specularColor = new Color3(0, 0, 0);
    city.material = cityMat;

    const builders = [];
    const bMat = new StandardMaterial("builderMat", scene);
    bMat.diffuseColor = new Color3(0.02, 0.05, 0.06);
    bMat.emissiveColor = new Color3(0.0, 0.35, 0.55);
    bMat.specularColor = new Color3(0, 0, 0);

    const r = 12;
    for (let i = 0; i < buildersCount; i++) {
        const ang = (i / Math.max(1, buildersCount)) * Math.PI * 2;
        const bx = x + Math.cos(ang) * r;
        const bz = z + Math.sin(ang) * r;
        const by = world.getGroundY(bx, bz);

        const b = MeshBuilder.CreateBox(`builder_${i}`, { size: 2.2 }, scene);
        b.position.set(bx, by + 1.2, bz);
        b.isPickable = true;
        b.material = bMat;

        const bLight = new PointLight(`builderLight_${i}`, b.position.clone(), scene);
        bLight.intensity = 0.6;
        bLight.range = 20;
        bLight.diffuse = new Color3(0.2, 0.6, 1.0);

        builders.push({
            mesh: b,
            light: bLight,
            target: b.position.clone(),
            speed: 28 + (i === 0 ? 6 : 0),
        });
    }

    return { city, cityLight, builders };
}

export function createScene(canvas, initialSettings = {}) {
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 1);

    makeStarfield(scene);

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.12;

    const sun = new DirectionalLight("sun", new Vector3(-0.35, -1.0, -0.2), scene);
    sun.intensity = 0.72;


    const topCam = new ArcRotateCamera("topCam", -Math.PI / 2, Math.PI / 3.0, 260, new Vector3(0, 0, 0), scene);
    topCam.attachControl(canvas, true);
    topCam.lowerBetaLimit = 0.20;
    topCam.upperBetaLimit = 1.45;

    // Prevent camera from going below voxels
    topCam.onViewMatrixChangedObservable.add(() => {
        if (world) {
            const groundY = world.getGroundY(topCam.position.x, topCam.position.z);
            if (topCam.position.y < groundY + 10) {
                topCam.position.y = groundY + 10;
            }
        }
    });

    topCam.angularSensibilityX = 150;
    topCam.angularSensibilityY = 150;

    topCam.wheelPrecision = 2.2;
    topCam.panningSensibility = 1100;
    topCam.pinchPrecision = 18;

    const keys = setupInput();
    const camVel = new Vector3(0, 0, 0);
    let wasdMaxSpeed = 220;
    const accel = 780;
    const damping = 10.5;
    const turboMul = 1.85;

    let world = null;
    let borderBuilt = false;
    let loadingFade = 0;

    let visionRadius = 190;
    let builderCount = 6;

    let spawned = null;
    let selectedBuilderIndex = 0;

    let visTimer = 0;

    let pickPlane = null;

    let shadows = null;

    function cleanupSpawned() {
        if (spawned) {
            if (spawned.city) spawned.city.dispose();
            if (spawned.cityLight) spawned.cityLight.dispose();
            if (spawned.builders) {
                for (const b of spawned.builders) {
                    if (b.mesh) b.mesh.dispose();
                    if (b.light) b.light.dispose();
                }
            }
            spawned = null;
        }
    }

    function applySettings(settings) {
        topCam.angularSensibilityX = settings.rightDrag ?? 150;
        topCam.angularSensibilityY = settings.rightDrag ?? 150;

        topCam.wheelPrecision = settings.wheel ?? 2.2;
        topCam.panningSensibility = settings.panSens ?? 1100;

        wasdMaxSpeed = settings.wasd ?? 220;
        visionRadius = settings.visionRadius ?? 190;
        builderCount = settings.builders ?? 6;

        if (world) world.dispose();
        cleanupSpawned();
        world = new World(scene, {
            sizeChunks: settings.mapChunks ?? 33,
            budgetBoot: settings.budgetBoot ?? 64,
            budgetSteady: Math.max(10, Math.floor((settings.budgetBoot ?? 64) * 0.25)),
        });

        if (shadows) shadows.dispose();
        shadows = new ShadowGenerator(1024, sun);
        shadows.useBlurExponentialShadowMap = true;
        shadows.blurKernel = 32;
        shadows.setDarkness(0.2);
        // Cascade to world
        world.shadows = shadows;

        const plateSizeVox = world.sizeChunks * 16;
        const plateRadius = plateSizeVox * 0.5;

        topCam.lowerRadiusLimit = Math.max(90, plateRadius * 0.16);
        topCam.upperRadiusLimit = Math.max(420, Math.min(1400, plateRadius * 1.55));

        borderBuilt = false;
        loadingFade = 0;
        spawned = null;
        selectedBuilderIndex = 0;
        visTimer = 0;

        if (pickPlane) pickPlane.dispose();
        pickPlane = MeshBuilder.CreateGround("pickPlane", { width: plateSizeVox + 80, height: plateSizeVox + 80, subdivisions: 1 }, scene);
        pickPlane.isVisible = false;
        pickPlane.isPickable = true;
        pickPlane.position.y = 0;

        setLoadingVisible(true);
        setLoadingText("INITIALIZING VOXEL CORE...");
        setLoadingBar(0);
    }

    applySettings(initialSettings);

    scene.onPointerObservable.add((pi) => {
        if (!world || !world.isReady || !spawned) return;

        if (pi.event && pi.event.button === 0) {
            const pick = scene.pick(scene.pointerX, scene.pointerY);
            if (pick && pick.hit && pick.pickedMesh) {
                const name = pick.pickedMesh.name || "";
                if (name.startsWith("builder_")) {
                    const idx = Number(name.split("_")[1]);
                    if (!Number.isNaN(idx)) selectedBuilderIndex = idx;
                }
            }
        }

        if (pi.event && pi.event.button === 2) {
            pi.event.preventDefault();

            const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m === pickPlane);
            if (pick && pick.hit && pick.pickedPoint && spawned.builders[selectedBuilderIndex]) {
                const p = pick.pickedPoint;
                const clamped = world.clampWorldXZ(p.x, p.z, 14);
                const y = world.getGroundY(clamped.x, clamped.z);

                const b = spawned.builders[selectedBuilderIndex];
                b.target.x = clamped.x;
                b.target.z = clamped.z;
                b.target.y = y + 1.2;
            }
        }
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    engine.runRenderLoop(() => {
        const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);

        world.update(dt);

        if (!world.isReady) {
            setLoadingBar(world.progress);
            scene.render();
            return;
        }

        if (!spawned) {
            spawned = spawnCityAndBuilders(scene, world, builderCount);
            if (shadows) {
                shadows.addShadowCaster(spawned.city);
                for (const b of spawned.builders) {
                    shadows.addShadowCaster(b.mesh);
                }
            }
            // Update city light position once spawned
            if (spawned.cityLight) {
                spawned.cityLight.position.copyFrom(spawned.city.position);
            }
        }

        if (loadingFade < 1) {
            loadingFade = Math.min(1, loadingFade + dt * 2.2);
            const el = document.getElementById("loading");
            if (el) el.style.opacity = String(1 - loadingFade);
            if (loadingFade >= 1) setLoadingVisible(false);
        }

        const turbo = keys["shift"] ? turboMul : 1.0;

        const fwd = topCam.target.subtract(topCam.position);
        fwd.y = 0;
        if (fwd.lengthSquared() > 1e-6) fwd.normalize();

        const right = Vector3.Cross(fwd, Vector3.Up());
        if (right.lengthSquared() > 1e-6) right.normalize();

        const wish = new Vector3(0, 0, 0);
        if (keys["w"]) wish.addInPlace(fwd);
        if (keys["s"]) wish.subtractInPlace(fwd);
        if (keys["d"]) wish.addInPlace(right);
        if (keys["a"]) wish.subtractInPlace(right);

        if (wish.lengthSquared() > 0) {
            wish.normalize();
            const desired = wish.scale(accel * turbo);
            camVel.x += desired.x * dt;
            camVel.z += desired.z * dt;
        }

        const max = wasdMaxSpeed * turbo;
        const sp2 = camVel.x * camVel.x + camVel.z * camVel.z;
        if (sp2 > max * max) {
            const s = Math.sqrt(sp2);
            camVel.x = (camVel.x / s) * max;
            camVel.z = (camVel.z / s) * max;
        }

        camVel.x -= camVel.x * Math.min(1, damping * dt);
        camVel.z -= camVel.z * Math.min(1, damping * dt);

        topCam.target.x += camVel.x * dt;
        topCam.target.z += camVel.z * dt;

        const clamped = world.clampWorldXZ(topCam.target.x, topCam.target.z, 14);
        topCam.target.x = clamped.x;
        topCam.target.z = clamped.z;

        for (let i = 0; i < spawned.builders.length; i++) {
            const b = spawned.builders[i];
            const m = b.mesh;
            const dx = b.target.x - m.position.x;
            const dz = b.target.z - m.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.15) {
                const step = Math.min(dist, b.speed * dt);
                const nx = dx / dist;
                const nz = dz / dist;
                m.position.x += nx * step;
                m.position.z += nz * step;

                const y = world.getGroundY(m.position.x, m.position.z);
                m.position.y = y + 1.2;
                b.light.position.copyFrom(m.position);
            }
        }

        visTimer += dt;
        if (visTimer >= 0.14) {
            visTimer = 0;

            const lights = [];

            lights.push({
                x: spawned.city.position.x,
                z: spawned.city.position.z,
                r: Math.max(130, visionRadius * 0.86),
            });

            for (let i = 0; i < spawned.builders.length; i++) {
                const m = spawned.builders[i].mesh;
                const r = i === 0 ? Math.max(110, visionRadius * 0.70) : Math.max(85, visionRadius * 0.52);
                lights.push({ x: m.position.x, z: m.position.z, r });
            }

            world.applyVisionLights(lights, { innerMul: 0.78, outerMul: 1.45 });
        }

        scene.render();
    });

    window.addEventListener("resize", () => engine.resize());
    return scene;
}
