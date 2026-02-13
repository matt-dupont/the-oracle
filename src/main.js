import { createScene } from './scene.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('renderCanvas');
    if (canvas) {
        createScene(canvas);
    }
});
