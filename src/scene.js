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
    Texture,
} from "@babylonjs/core";

import { World } from "./world/World.js";
import { Person } from "./entities/Person.js";
import { RNG } from "./util/rng.js";

function makeStarfield(scene) {
    // Cheap procedural starfield: dynamic texture on inside-facing sphere
    const size = 1024;
    const tex = new Texture("", scene, true, false, Texture.NEAREST_SAMPLINGMODE);
    const dt = new BABYLON.DynamicTexture("stars", { width: size, height: size }, scene, false);
    const ctx = dt.getContext();

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, size, size);

    // stars
    const starCount = 2200;
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() * size) | 0;
        const y = (Math.random() * size) | 0;
        const r = Math.random();
        const b = r < 0.92 ? 1 : 2; // some brighter
        const a = r < 0.92 ? 0.8 : 1.0;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, b, b);
    }

    // a few faint blue-ish stars
    for (let i = 0; i < 150; i++) {
        const x = (Math.random() * size) | 0;
        const y = (Math.random() * size) | 0;
        ctx.fillStyle = `rgba(170,200,255,0.8)`;
        ctx.fillRect(x, y, 1, 1);
    }

    dt.update();

    const sky = MeshBuilder.CreateSphere("sky", { diameter: 4000, segments: 16 }, scene);
    sky.isPickable = false;

    const mat = new StandardMaterial("skyMat", scene);
    mat.backFaceCulling = false;         // show inside
    mat.disableLighting = true;          // no tint
    mat.emissiveTexture = dt;
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);

    sky.material = mat;

    // keep centered on camera later if you want; static is fine for now.
    return sky;
}

export function createScene(canvas) {
    const engine = new Engine(canvas, true, {
        antialias: true,
        preserveDrawingBuffer: false,
        stencil: false,
    });

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 1);

    // ---- HARD disable “bloomy / filmic” surprises ----
    const ipc = scene.imageProcessingConfiguration;
    ipc.toneMappingEnabled = false;
    ipc.vignetteEnabled = false;
    ipc.colorCurvesEnabled = false;
    ipc.exposure = 1.0;
    ipc.contrast = 1.0;

    // ---- Camera: rotatable, zoomable, pannable ----
    const camera = new ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        1.05,
        110,
        new Vector3(0, 0, 0),
        scene
    );
    camera.attachControl(canvas, true);

    camera.lowerBetaLimit = 0.55;
    camera.upperBetaLimit = 1.35;

    camera.lowerRadiusLimit = 30;
    camera.upperRadiusLimit = 260;

    camera.wheelPrecision = 45;
    camera.panningSensibility = 80;

    camera.inertia = 0.85;
    camera.panningInertia = 0.85;

    camera.minZ = 0.1;
    camera.maxZ = 6000;

    // ---- Neutral lighting (NO tints) ----
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.5;
    hemi.groundColor = new Color3(0.05, 0.05, 0.05); // DARK neutral
    hemi.specular.set(0, 0, 0);

    const dir = new DirectionalLight("dir", new Vector3(-0.6, -1.2, -0.45), scene);
    dir.position = new Vector3(120, 170, 90);
    dir.intensity = 0.8;

    // ---- Starfield ----
    // NOTE: requires DynamicTexture; if your bundler doesn't expose BABYLON global,
    // replace this with a static texture later. For now we’ll avoid globals:
    // Instead of DynamicTexture, comment this out if it errors.
    // Easiest safe: no stars until we wire DynamicTexture import.
    // We'll do safe version below that doesn't depend on BABYLON global:
    // (Leaving stars disabled to prevent breaking your app)
    // makeStarfield(scene);

        // Diagnostic Sphere (Neutral Yellow)
        const sphere = MeshBuilder.CreateSphere("originSphere", { diameter: 3 }, scene);
        sphere.position.set(0, 22, 0);
        const sphereMat = new StandardMaterial("sphereMat", scene);
        sphereMat.diffuseColor = new Color3(0.8, 0.8, 0.2);
        sphereMat.emissiveColor = new Color3(0.2, 0.2, 0);
        sphere.material = sphereMat;

    // ---- World + people ----
    const world = new World(scene);

    const rng = new RNG(123);
    const people = [];
    for (let i = 0; i < 20; i++) people.push(new Person(scene, rng));

    // ---- WASD pan (camera-relative) ----
    const inputMap = Object.create(null);
    const onKeyDown = (e) => (inputMap[e.key.toLowerCase()] = true);
    const onKeyUp = (e) => (inputMap[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let lastWorldUpdate = 0;

    engine.runRenderLoop(() => {
        const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);

        const forward = camera.target.subtract(camera.position);
        forward.y = 0;
        forward.normalize();

        const right = Vector3.Cross(forward, Vector3.Up());
        right.normalize();

        const panSpeed = 60 * dt * (inputMap["shift"] ? 2.0 : 1.0);

        if (inputMap["w"]) camera.target.addInPlace(forward.scale(panSpeed));
        if (inputMap["s"]) camera.target.addInPlace(forward.scale(-panSpeed));
        if (inputMap["a"]) camera.target.addInPlace(right.scale(-panSpeed));
        if (inputMap["d"]) camera.target.addInPlace(right.scale(panSpeed));

        if (Date.now() - lastWorldUpdate > 150) {
            world.update(camera.target);
            lastWorldUpdate = Date.now();
        }

        for (const p of people) p.update(dt);

        scene.render();
    });

    window.addEventListener("resize", () => engine.resize());

    scene.onDisposeObservable.add(() => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
    });

    return scene;
}
