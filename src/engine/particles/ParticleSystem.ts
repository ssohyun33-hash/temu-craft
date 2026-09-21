import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  scene: THREE.Scene;
  particles: Particle[] = [];
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  maxParticles = 500;

  private positions: Float32Array;
  private colors: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  spawnBlockBreak(pos: THREE.Vector3, baseColor: number = 0x8a683d) {
    const col = new THREE.Color(baseColor);
    for (let i = 0; i < 18; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const p: Particle = {
        position: pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8
        )),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        ),
        color: col.clone().offsetHSL((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.15),
        size: 0.12 + Math.random() * 0.08,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      };
      this.particles.push(p);
    }
  }

  spawnUnderwaterBubbles(cameraPos: THREE.Vector3) {
    if (this.particles.length >= this.maxParticles - 10) return;
    if (Math.random() > 0.4) return;

    const p: Particle = {
      position: cameraPos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        -1.5 + Math.random() * 3,
        (Math.random() - 0.5) * 12
      )),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        0.5 + Math.random() * 0.8,
        (Math.random() - 0.5) * 0.2
      ),
      color: new THREE.Color(0xa6d8ff),
      size: 0.08 + Math.random() * 0.08,
      life: 0,
      maxLife: 2.0 + Math.random() * 1.5,
    };
    this.particles.push(p);
  }

  spawnWaterSplash(pos: THREE.Vector3, count: number = 6) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const p: Particle = {
        position: pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          0.1 + Math.random() * 0.2,
          (Math.random() - 0.5) * 0.6
        )),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.2,
          1.8 + Math.random() * 2.5,
          (Math.random() - 0.5) * 2.2
        ),
        color: new THREE.Color(0xb8e2f8).offsetHSL(
          (Math.random() - 0.5) * 0.05,
          0,
          (Math.random() - 0.5) * 0.1
        ),
        size: 0.10 + Math.random() * 0.08,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.35,
      };
      this.particles.push(p);
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= 9.8 * dt * 0.6; // gravity
      p.position.addScaledVector(p.velocity, dt);
    }

    // Write buffer attributes
    let pIdx = 0;
    let cIdx = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      this.positions[pIdx++] = p.position.x;
      this.positions[pIdx++] = p.position.y;
      this.positions[pIdx++] = p.position.z;

      this.colors[cIdx++] = p.color.r;
      this.colors[cIdx++] = p.color.g;
      this.colors[cIdx++] = p.color.b;
    }

    // Clear unused slots
    for (let i = this.particles.length; i < this.maxParticles; i++) {
      this.positions[pIdx++] = 0;
      this.positions[pIdx++] = -1000;
      this.positions[pIdx++] = 0;

      this.colors[cIdx++] = 0;
      this.colors[cIdx++] = 0;
      this.colors[cIdx++] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
