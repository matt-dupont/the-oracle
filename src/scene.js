import {
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    Color4,
    HemisphericLight,
    DirectionalLight,
    Color3,
    StandardMaterial,
    MeshBuilder,
    DynamicTexture,
} from "@babylonjs/core";

import { World } from "./world/World.js";
import { Person } from "./entities/Person.js";
import { RNG } from "./util/rng.js";
import { getHeight } from "./world/terrain.js";

/**
 * Visual goals:
 * - readable terrain relief (lighting + fog)
 * - cohesive space vibe (starfield + subtle atmosphere)
 * - camera speed feels good (no walking for ages)
 */

function makeStarfield(scene) {
    const size = 1024;
    const dt = new DynamicTexture("stars", { width: size, height: size }, scene, false);
    const ctx = dt.getContext();

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, size, size);

    // stars
    const starCount = 2400;
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() * size) | 0;
        const y = (Math.random() * size) | 0;
        const r = Math.random();
        const s = r < 0.93 ? 1 : 2;
        const a = r < 0.93 ? 0.75 : 1.0;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, s, s);
    }

    // faint color stars
    for (let i = 0; i < 200; i++) {
        const x = (Math.random() * size) | 0;
        const y = (Math.random() * size) | 0;
        const c = Math.random() < 0.5 ? "rgba(170,210,255,0.75)" : "rgba(255,200,170,0.65)";
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
    }

    dt.update();

    const sky = MeshBuilder.CreateSphere("sky", { diameter: 5000, segments: 16 }, scene);
    sky.isPickable = false;

    const mat = new StandardMaterial("skyMat", scene);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.emissiveTexture = dt;
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);

    sky.material = mat;
    return sky;
}

export function createScene(canvas) {
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);

    scene.clearColor = new Color4(0.02, 0.03, 0.05, 1.0);

    makeStarfield(scene);

    // Fog = scale + depth perception
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.02, 0.03, 0.05);
    scene.fogDensity = 0.00055;

    // Lighting
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.groundColor = new Color3(0.03, 0.05, 0.06);

    const sun = new DirectionalLight("sun", new Vector3(-0.35, -1.0, -0.25), scene);
    sun.intensity = 1.15;

    // Camera
    const spawnY = getHeight(0, 0);
    const camera = new ArcRotateCamera(
        "camera",
        -Math.PI / 2.25,
        Math.PI / 3.2,
        210,
        new Vector3(0, spawnY + 18, 0),
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 45;
    camera.upperRadiusLimit = 520;
    camera.wheelDeltaPercentage = 0.015;
    camera.panningSensibility = 85; // lower = faster pan

    // World streaming
    const world = new World(scene);

    // People (debug agents)
    const rng = new RNG(123);
    const people = [];
    for (let i = 0; i < 18; i++) people.push(new Person(scene, rng));

    // ---- WASD pan (camera-relative) ----
    const inputMap = Object.create(null);
    const onKeyDown = (e) => (inputMap[e.key.toLowerCase()] = true);
    const onKeyUp = (e) => (inputMap[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let lastWorldUpdate = 0;

    engine.runRenderLoop(() => {
        const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);

        // WASD pan speed (Shift = turbo)
        const turbo = inputMap["shift"] ? 3.0 : 1.0;
        const panSpeed = 95 * turbo;

        const forward = camera.target.subtract(camera.position);
        forward.y = 0;
        forward.normalize();

        const right = Vector3.Cross(forward, Vector3.Up()).normalize();

        const move = new Vector3(0, 0, 0);
        if (inputMap["w"]) move.addInPlace(forward);
        if (inputMap["s"]) move.subtractInPlace(forward);
        if (inputMap["d"]) move.addInPlace(right);
        if (inputMap["a"]) move.subtractInPlace(right);

        if (move.lengthSquared() > 0) {
            move.normalize();
            move.scaleInPlace(panSpeed * dt);
            camera.target.addInPlace(move);
        }

        // Keep target hovering above terrain
        const th = getHeight(Math.round(camera.target.x), Math.round(camera.target.z));
        const desiredY = th + 18;
        camera.target.y = camera.target.y + (desiredY - camera.target.y) * Math.min(1, dt * 6.0);

        // Stream world around camera target (throttled)
        lastWorldUpdate += dt;
        if (lastWorldUpdate > 0.08) {
            world.update(camera.target);
            lastWorldUpdate = 0;
        }

        for (const p of people) p.update(dt);

        scene.render();
    });

    window.addEventListener("resize", () => engine.resize());

    return scene;
}
