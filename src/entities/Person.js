import {
    TransformNode,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Vector3,
} from "@babylonjs/core";

import { getHeight, WATER_LEVEL } from "../world/terrain.js";

export class Person {
    constructor(scene, rng) {
        this.scene = scene;
        this.rng = rng;

        this.root = new TransformNode("person", scene);

        this.pos = new Vector3(rng.nextRange(-10, 10), 0, rng.nextRange(-10, 10));

        this.direction = rng.nextRange(0, Math.PI * 2);
        this.speed = rng.nextRange(2.1, 3.4);
        this.wanderTimer = 0;

        this.t = 0;

        // Collision tuning
        this.radius = 0.35;     // footprint
        this.stepUp = 1.0;      // max step climb
        this.stepDown = 2.0;    // slow near cliffs
        this.yOffset = 0.58;    // stand height

        this._buildMesh();

        const gy = this._groundYAt(this.pos.x, this.pos.z);
        this.pos.y = gy + this.yOffset;
        this.root.position.copyFrom(this.pos);
    }

    _buildMesh() {
        const mat = new StandardMaterial("personMat", this.scene);
        mat.disableLighting = false;
        mat.emissiveColor = new Color3(0, 0, 0);
        mat.specularColor = new Color3(0, 0, 0);

        // Slight “astronaut tech” gray
        mat.diffuseColor = new Color3(0.7, 0.7, 0.75);

        const body = MeshBuilder.CreateBox("body", { width: 0.53, height: 0.78, depth: 0.28 }, this.scene);
        body.parent = this.root;
        body.position.y = 0.90;
        body.material = mat;

        const head = MeshBuilder.CreateBox("head", { size: 0.33 }, this.scene);
        head.parent = this.root;
        head.position.y = 1.40;
        head.material = mat;

        this.leftLeg = MeshBuilder.CreateBox("leftLeg", { width: 0.20, height: 0.55, depth: 0.20 }, this.scene);
        this.leftLeg.parent = this.root;
        this.leftLeg.position.set(-0.14, 0.28, 0);
        this.leftLeg.material = mat;

        this.rightLeg = MeshBuilder.CreateBox("rightLeg", { width: 0.20, height: 0.55, depth: 0.20 }, this.scene);
        this.rightLeg.parent = this.root;
        this.rightLeg.position.set(0.14, 0.28, 0);
        this.rightLeg.material = mat;

        this.leftArm = MeshBuilder.CreateBox("leftArm", { width: 0.14, height: 0.53, depth: 0.14 }, this.scene);
        this.leftArm.parent = this.root;
        this.leftArm.position.set(-0.38, 0.90, 0);
        this.leftArm.material = mat;

        this.rightArm = MeshBuilder.CreateBox("rightArm", { width: 0.14, height: 0.53, depth: 0.14 }, this.scene);
        this.rightArm.parent = this.root;
        this.rightArm.position.set(0.38, 0.90, 0);
        this.rightArm.material = mat;
    }

    _groundSample(x, z) {
        const h = getHeight(x, z);
        const safe = Number.isFinite(h) ? h : 0;
        return Math.max(safe, WATER_LEVEL);
    }

    // Max of 4 corners => don't clip into voxel edges
    _groundYAt(x, z) {
        const r = this.radius;
        const h1 = this._groundSample(x - r, z - r);
        const h2 = this._groundSample(x + r, z - r);
        const h3 = this._groundSample(x - r, z + r);
        const h4 = this._groundSample(x + r, z + r);
        return Math.max(h1, h2, h3, h4);
    }

    // Wall test: if ANY corner at next pos would be too high compared to current ground, block.
    _canOccupy(nextX, nextZ, currentGround) {
        const r = this.radius;

        const c1 = this._groundSample(nextX - r, nextZ - r);
        const c2 = this._groundSample(nextX + r, nextZ - r);
        const c3 = this._groundSample(nextX - r, nextZ + r);
        const c4 = this._groundSample(nextX + r, nextZ + r);

        const maxCorner = Math.max(c1, c2, c3, c4);
        const minCorner = Math.min(c1, c2, c3, c4);

        // Block hard walls
        if (maxCorner > currentGround + this.stepUp) return false;

        // Also prevent “threading” through razor ridges:
        // if footprint spans a huge height delta, treat as impassable.
        if (maxCorner - minCorner > 3.0) return false;

        return true;
    }

    update(dt) {
        this.t += dt;

        // Wander
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.direction += this.rng.nextRange(-Math.PI / 5, Math.PI / 5);
            this.wanderTimer = this.rng.nextRange(1.2, 3.0);
        }

        const fx = Math.sin(this.direction);
        const fz = Math.cos(this.direction);

        // Cliff-aware speed reduction
        let moveSpeed = this.speed;
        const gNow = this._groundYAt(this.pos.x, this.pos.z);
        const gAhead = this._groundYAt(this.pos.x + fx * 0.35, this.pos.z + fz * 0.35);
        const drop = gNow - gAhead;
        if (drop > this.stepDown) moveSpeed *= 0.35;

        const dx = fx * moveSpeed * dt;
        const dz = fz * moveSpeed * dt;

        // Axis-separated movement (prevents ghosting through walls)
        let moved = false;

        // Try X
        if (dx !== 0) {
            const nx = this.pos.x + dx;
            if (this._canOccupy(nx, this.pos.z, gNow)) {
                this.pos.x = nx;
                moved = true;
            }
        }

        // Try Z (re-sample ground after x move)
        const gMid = this._groundYAt(this.pos.x, this.pos.z);
        if (dz !== 0) {
            const nz = this.pos.z + dz;
            if (this._canOccupy(this.pos.x, nz, gMid)) {
                this.pos.z = nz;
                moved = true;
            }
        }

        if (!moved) {
            // Wall hit: rotate away
            this.direction += Math.PI * 0.5 + this.rng.nextRange(-0.6, 0.6);
            this.wanderTimer = this.rng.nextRange(0.4, 0.9);
        }

        // Smooth Y align
        const gFinal = this._groundYAt(this.pos.x, this.pos.z);
        const desiredY = gFinal + this.yOffset;
        const yLerp = 1 - Math.pow(0.001, dt);
        this.pos.y = this.pos.y + (desiredY - this.pos.y) * yLerp;

        this.root.position.copyFrom(this.pos);
        this.root.rotation.y = this.direction;

        // Walk anim tied to dt (no Date.now jitter)
        const stride = moveSpeed / 3.2;
        const wave = Math.sin(this.t * 8.0 * stride);

        this.leftLeg.rotation.x = wave * 0.55;
        this.rightLeg.rotation.x = -wave * 0.55;
        this.leftArm.rotation.x = -wave * 0.45;
        this.rightArm.rotation.x = wave * 0.45;
    }
}
