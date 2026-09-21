import * as THREE from 'three';

export class BreakEffect {
  scene: THREE.Scene;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  crackCanvas: HTMLCanvasElement;
  crackTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.crackCanvas = document.createElement('canvas');
    this.crackCanvas.width = 64;
    this.crackCanvas.height = 64;
    this.crackTexture = new THREE.CanvasTexture(this.crackCanvas);
    this.crackTexture.magFilter = THREE.NearestFilter;
    this.crackTexture.minFilter = THREE.NearestFilter;

    this.material = new THREE.MeshBasicMaterial({
      map: this.crackTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  updateProgress(x: number, y: number, z: number, progress: number) {
    if (progress <= 0 || progress >= 1.0) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    this.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);

    // Draw crack pattern stage (0 to 9)
    const stage = Math.min(9, Math.floor(progress * 10));
    this.drawCrackStage(stage);
  }

  private drawCrackStage(stage: number) {
    const ctx = this.crackCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Crack lines growing with stage
    if (stage >= 1) {
      ctx.moveTo(32, 10);
      ctx.lineTo(34, 32);
      ctx.lineTo(20, 48);
    }
    if (stage >= 3) {
      ctx.moveTo(34, 32);
      ctx.lineTo(50, 36);
      ctx.lineTo(58, 20);
    }
    if (stage >= 5) {
      ctx.moveTo(32, 10);
      ctx.lineTo(18, 14);
      ctx.lineTo(10, 30);
    }
    if (stage >= 7) {
      ctx.moveTo(20, 48);
      ctx.lineTo(38, 54);
      ctx.lineTo(44, 60);
      ctx.moveTo(34, 32);
      ctx.lineTo(28, 24);
    }
    if (stage >= 9) {
      ctx.moveTo(10, 30);
      ctx.lineTo(24, 38);
      ctx.lineTo(50, 36);
      ctx.moveTo(18, 14);
      ctx.lineTo(44, 18);
    }
    ctx.stroke();

    this.crackTexture.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}
