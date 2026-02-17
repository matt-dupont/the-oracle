// src/entities/Person.js

import { Vector3, MeshBuilder, StandardMaterial, Color3, TransformNode } from "@babylonjs/core";
import { getHeight } from "../world/terrain.js";

export class Person {
    /**
     * @param {import('@babylonjs/core').Scene} scene
     * @param {import('../util/rng.js').RNG} rng
     * @param {{
     *   startX?: number,
     *   startZ?: number,
     *   name?: string,
     *   diffuse?: import('@babylonjs/core').Color3,
     *   emissive?: import('@babylonjs/core').Color3,
     *   isElite?: boolean,
     * }} [opts]
     */
    constructor(scene, rng, opts = {}) {
        this.scene = scene;
        this.rng = rng;

        this.isElite = !!opts.isElite;

        this.root = new TransformNode(opts.name || "person", scene);

        const sx = typeof opts.startX === "number" ? opts.startX : rng.nextRange(-10, 10);
        const sz = typeof opts.startZ === "number" ? opts.startZ : rng.nextRange(-10, 10);
        this.pos = new Vector3(sx, 0, sz);

        this.direction = rng.nextRange(0, Math.PI * 2);
        this.speed = rng.nextRange(2.2, 3.8);
        this.wanderTimer = rng.nextRange(0.7, 2.2);

        this.t = rng.nextRange(0, 1000);
        this.yOffset = 0.58;

        /** @type {{x:number,z:number}|null} */
        this._target = null;

        this._buildMesh(opts);

        this._syncToGround();
    }

    _syncToGround() {
        const y = getHeight(this.pos.x, this.pos.z);
        this.pos.y = y + this.yOffset;
        this.root.position.copyFrom(this.pos);
    }

    _buildMesh(opts) {
        const mat = new StandardMaterial(`${this.root.name}_mat`, this.scene);
        mat.disableLighting = false;
        mat.emissiveColor = opts.emissive ?? (this.isElite ? new Color3(0.00, 0.22, 0.30) : new Color3(0.00, 0.12, 0.18));
        mat.specularColor = new Color3(0, 0, 0);
        mat.diffuseColor = opts.diffuse ?? (this.isElite ? new Color3(0.78, 0.80, 0.86) : new Color3(0.62, 0.64, 0.70));

        const body = MeshBuilder.CreateBox(`${this.root.name}_body`, { width: 0.53, height: 0.78, depth: 0.28 }, this.scene);
        body.parent = this.root;
        body.position.y = 0.90;
        body.material = mat;

        const head = MeshBuilder.CreateBox(`${this.root.name}_head`, { size: 0.33 }, this.scene);
        head.parent = this.root;
        head.position.y = 1.40;
        head.material = mat;

        this.leftLeg = MeshBuilder.CreateBox(`${this.root.name}_leftLeg`, { width: 0.20, height: 0.55, depth: 0.20 }, this.scene);
        this.leftLeg.parent = this.root;
        this.leftLeg.position.set(-0.14, 0.28, 0);
        this.leftLeg.material = mat;

        this.rightLeg = MeshBuilder.CreateBox(`${this.root.name}_rightLeg`, { width: 0.20, height: 0.55, depth: 0.20 }, this.scene);
        this.rightLeg.parent = this.root;
        this.rightLeg.position.set(0.14, 0.28, 0);
        this.rightLeg.material = mat;

        this.leftArm = MeshBuilder.CreateBox(`${this.root.name}_leftArm`, { width: 0.14, height: 0.53, depth: 0.14 }, this.scene);
        this.leftArm.parent = this.root;
        this.leftArm.position.set(-0.38, 0.90, 0);
        this.leftArm.material = mat;

        this.rightArm = MeshBuilder.CreateBox(`${this.root.name}_rightArm`, { width: 0.14, height: 0.53, depth: 0.14 }, this.scene);
        this.rightArm.parent = this.root;
        this.rightArm.position.set(0.38, 0.90, 0);
        this.rightArm.material = mat;

        body.isPickable = true;
        head.isPickable = true;
        this.leftLeg.isPickable = true;
        this.rightLeg.isPickable = true;
        this.leftArm.isPickable = true;
        this.rightArm.isPickable = true;
    }

    setTarget(x, z) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        this._target = { x, z };

        const dx = x - this.pos.x;
        const dz = z - this.pos.z;
        if (dx * dx + dz * dz > 1e-6) this.direction = Math.atan2(dx, dz);
    }

    update(dt) {
        this.t += dt;

        if (this._target) {
            const dx = this._target.x - this.pos.x;
            const dz = this._target.z - this.pos.z;
            const d2 = dx * dx + dz * dz;

            if (d2 < 0.8 * 0.8) {
                this._target = null;
            } else {
                this.direction = Math.atan2(dx, dz);
                this.wanderTimer = 0.6;
            }
        }

        this.wanderTimer -= dt;
        if (!this._target && this.wanderTimer <= 0) {
            this.direction += this.rng.nextRange(-Math.PI / 5, Math.PI / 5);
            this.wanderTimer = this.rng.nextRange(1.2, 3.0);
        }

        const vx = Math.sin(this.direction);
        const vz = Math.cos(this.direction);
        const spd = this._target ? (this.speed * 1.35) : this.speed;

        this.pos.x += vx * spd * dt;
        this.pos.z += vz * spd * dt;

        const y = getHeight(this.pos.x, this.pos.z);
        this.pos.y = y + this.yOffset;

        this.root.position.copyFrom(this.pos);
        this.root.rotation.y = this.direction;

        const walk = Math.sin(this.t * 9.5) * 0.35;
        this.leftLeg.rotation.x = walk;
        this.rightLeg.rotation.x = -walk;
        this.leftArm.rotation.x = -walk;
        this.rightArm.rotation.x = walk;
    }
}
