import { createScene } from "./scene.js";
import { setNoiseSeed, getNoiseSeed } from "./util/hash.js";

function pickSeed() {
    // Allow deterministic repro: http://localhost:5173/?seed=abc123
    const params = new URLSearchParams(window.location.search);
    const s = params.get("seed");
    if (s && s.trim().length) return s.trim();

    // Default: new seed each reload (what you want for "variance")
    return `oracle-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

window.addEventListener("DOMContentLoaded", () => {
    const seed = pickSeed();
    setNoiseSeed(seed);

    // Useful debug: you can copy this into the URL if you want to reproduce
    console.log("[WORLD] seed =", seed, "(numeric:", getNoiseSeed(), ")");

    const canvas = document.getElementById("renderCanvas");
    if (canvas) {
        createScene(canvas);
    }
});
