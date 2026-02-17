// src/main.js
import { createScene } from "./scene.js";
import { setNoiseSeed, getNoiseSeed } from "./util/hash.js";

function pickSeed() {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("seed");
    if (s && s.trim().length) return s.trim();
    return `oracle-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

let started = false;

window.addEventListener("DOMContentLoaded", () => {
    const seed = pickSeed();
    setNoiseSeed(seed);
    console.log("[WORLD] seed =", seed, "(numeric:", getNoiseSeed(), ")");

    const canvas = document.getElementById("renderCanvas");
    if (!canvas) return;

    // ✅ Do not render anything until Start is pressed.
    window.addEventListener("oracle:newgame", (e) => {
        if (started) return;
        started = true;

        const settings = (e && e.detail) ? e.detail : (window.__ORACLE_SETTINGS__ || {});
        createScene(canvas, settings);
    });
});
