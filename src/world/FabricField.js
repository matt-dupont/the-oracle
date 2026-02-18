// src/world/FabricField.js
import {
    MeshBuilder,
    ShaderMaterial,
    Color3,
    Vector2,
    VertexBuffer,
    Mesh
} from "@babylonjs/core";

export class FabricField {
    /**
     * @param {import('@babylonjs/core').Scene} scene
     * @param {import('./World.js').World} world
     */
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;

        // "Insane fading green neon fabric of the universe"
        const side = (world.sizeChunks + 2) * 16;
        
        // Custom shader for the neon grid effect
        const shaderName = "fabricShader";
        
        // Vertex Shader
        const vertexShader = `
            precision highp float;
            attribute position;
            attribute uv;
            uniform mat4 worldViewProjection;
            varying vec2 vUv;
            varying vec3 vPos;
            void main(void) {
                vUv = uv;
                vPos = position;
                gl_Position = worldViewProjection * vec4(position, 1.0);
            }
        `;

        // Fragment Shader
        const fragmentShader = `
            precision highp float;
            varying vec2 vUv;
            varying vec3 vPos;
            uniform float time;
            uniform float fade00;
            uniform float fade10;
            uniform float fade01;
            uniform float fade11;
            uniform vec3 neonColor;

            void main(void) {
                // Bilinear interpolation of fade values across the whole field
                // Note: vUv is 0..1 across the entire mesh
                float f0 = mix(fade00, fade10, vUv.x);
                float f1 = mix(fade01, fade11, vUv.x);
                float fade = mix(f0, f1, vUv.y);

                // Grid calculation
                vec2 grid = abs(fract(vPos.xz * 0.5 - 0.5) - 0.5) / fwidth(vPos.xz * 0.5);
                float line = min(grid.x, grid.y);
                float gridVal = 1.0 - smoothstep(0.0, 0.08, line);

                // Pulse effect
                float pulse = 0.85 + 0.15 * sin(time * 2.0 + vPos.x * 0.1 + vPos.z * 0.1);
                
                // Digital brilliance - additive glow
                float glow = 0.02 / (line + 0.01);
                
                vec3 color = neonColor * (gridVal + glow * 1.5) * pulse;
                
                // Fade into the "universe" (black/nothingness)
                // We want it to be more visible where voxels are GONE (fade is low)
                // Actually the user said "making this fade into like a digital brilliance"
                // Usually fog-of-war is black, and fabric replaces it.
                // So visibility = 1.0 - fade
                float finalAlpha = (1.0 - fade) * 0.8;
                
                if (finalAlpha < 0.01) discard;

                gl_FragColor = vec4(color, finalAlpha);
            }
        `;

        // Register shaders in Babylon's Effect.ShadersStore
        if (!ShaderMaterial.ShadersStore) {
            // In some environments it might be different, but usually:
            // BABYLON.Effect.ShadersStore["fabricShaderVertexShader"] = ...
        }
        
        // We'll use the 'shaderPath' approach with custom raw shaders
        this.material = new ShaderMaterial(
            "fabricMat",
            scene,
            {
                vertexSource: vertexShader,
                fragmentSource: fragmentShader,
            },
            {
                attributes: ["position", "uv"],
                uniforms: ["worldViewProjection", "time", "fade00", "fade10", "fade01", "fade11", "neonColor"],
                needAlphaBlending: true,
            }
        );

        this.material.setColor3("neonColor", new Color3(0.0, 1.0, 0.4)); // Neon Green
        this.material.backFaceCulling = false;

        this.mesh = MeshBuilder.CreateGround("fabricMesh", {
            width: side,
            height: side,
            subdivisions: 1
        }, scene);
        
        this.mesh.position.y = -10.5; // Just below water/ground baseline
        this.mesh.material = this.material;
        this.mesh.isPickable = false;

        this._time = 0;
    }

    update(dt) {
        this._time += dt;
        this.material.setFloat("time", this._time);
        
        // We sync these from the world's vision state
        // For simplicity, we could sample 4 corners of the whole world or just use fixed ones
        // The world.applyVisionLights should ideally update these
    }

    setFades(f00, f10, f01, f11) {
        this.material.setFloat("fade00", f00);
        this.material.setFloat("fade10", f10);
        this.material.setFloat("fade01", f01);
        this.material.setFloat("fade11", f11);
    }

    dispose() {
        if (this.mesh) this.mesh.dispose();
        if (this.material) this.material.dispose();
    }
}
