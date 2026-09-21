import * as THREE from 'three';
import { BLOCKS, BLOCK_DEFS, ITEMS, ITEM_DEFS } from '../blocks';

export class RemotePlayerMesh {
  group: THREE.Group;
  head: THREE.Mesh;
  body: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  heldItemMesh: THREE.Mesh | null = null;
  nameSprite: THREE.Sprite;

  targetPosition = new THREE.Vector3();
  targetYaw = 0;
  targetPitch = 0;
  currentYaw = 0;

  isMoving = false;
  isSprinting = false;
  walkTimer = 0;
  currentHeldItemId = BLOCKS.AIR;

  name: string;
  isHost: boolean;

  constructor(name: string, isHost: boolean) {
    this.name = name;
    this.isHost = isHost;
    this.group = new THREE.Group();

    // Material palette
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0a070,
      roughness: 0.8,
    });
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a2a10,
      roughness: 0.9,
    });
    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: isHost ? 0x2563eb : 0x059669, // Host blue, player green
      roughness: 0.7,
    });
    const pantsMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
    });

    // 1. Head (0.5 x 0.5 x 0.5)
    const headGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    this.head = new THREE.Mesh(headGeom, skinMaterial);
    this.head.position.y = 1.5;
    this.head.castShadow = true;

    // Head hair cap
    const hairGeom = new THREE.BoxGeometry(0.52, 0.2, 0.52);
    const hairMesh = new THREE.Mesh(hairGeom, hairMaterial);
    hairMesh.position.y = 0.18;
    this.head.add(hairMesh);

    // Eyes
    const eyeGeom = new THREE.PlaneGeometry(0.08, 0.08);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x1d4ed8 });

    const leftEyeWhite = new THREE.Mesh(eyeGeom, eyeWhiteMat);
    leftEyeWhite.position.set(-0.12, 0, 0.252);
    this.head.add(leftEyeWhite);
    const leftPupil = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), eyePupilMat);
    leftPupil.position.set(-0.12, 0, 0.254);
    this.head.add(leftPupil);

    const rightEyeWhite = new THREE.Mesh(eyeGeom, eyeWhiteMat);
    rightEyeWhite.position.set(0.12, 0, 0.252);
    this.head.add(rightEyeWhite);
    const rightPupil = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), eyePupilMat);
    rightPupil.position.set(0.12, 0, 0.254);
    this.head.add(rightPupil);

    this.group.add(this.head);

    // 2. Torso (0.5 x 0.75 x 0.25)
    const bodyGeom = new THREE.BoxGeometry(0.5, 0.75, 0.25);
    this.body = new THREE.Mesh(bodyGeom, shirtMaterial);
    this.body.position.y = 0.88;
    this.body.castShadow = true;
    this.group.add(this.body);

    // 3. Left Arm (pivot at shoulder)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.36, 1.2, 0);
    const armGeom = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const leftArmMesh = new THREE.Mesh(armGeom, skinMaterial);
    leftArmMesh.position.y = -0.32;
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.group.add(this.leftArm);

    // 4. Right Arm (pivot at shoulder)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.36, 1.2, 0);
    const rightArmMesh = new THREE.Mesh(armGeom, skinMaterial);
    rightArmMesh.position.y = -0.32;
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);
    this.group.add(this.rightArm);

    // 5. Left Leg (pivot at hip)
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.14, 0.5, 0);
    const legGeom = new THREE.BoxGeometry(0.22, 0.75, 0.22);
    const leftLegMesh = new THREE.Mesh(legGeom, pantsMaterial);
    leftLegMesh.position.y = -0.375;
    leftLegMesh.castShadow = true;
    this.leftLeg.add(leftLegMesh);
    this.group.add(this.leftLeg);

    // 6. Right Leg (pivot at hip)
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.14, 0.5, 0);
    const rightLegMesh = new THREE.Mesh(legGeom, pantsMaterial);
    rightLegMesh.position.y = -0.375;
    rightLegMesh.castShadow = true;
    this.rightLeg.add(rightLegMesh);
    this.group.add(this.rightLeg);

    // 7. Overhead Name Tag Sprite
    this.nameSprite = this.createNameSprite(name, isHost);
    this.nameSprite.position.y = 2.15;
    this.group.add(this.nameSprite);
  }

  private createNameSprite(name: string, isHost: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    // Rounded background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 360, 72, 20);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = isHost ? 'rgba(251, 191, 36, 0.9)' : 'rgba(148, 163, 184, 0.6)';
    ctx.stroke();

    // Text label
    ctx.font = 'bold 32px "Courier New", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHost ? '#fbbf24' : '#f8fafc';

    const label = isHost ? `👑 ${name} [HOST]` : `👤 ${name}`;
    ctx.fillText(label, 192, 48);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  updateHeldItem(itemId: number) {
    if (this.currentHeldItemId === itemId) return;
    this.currentHeldItemId = itemId;

    if (this.heldItemMesh) {
      this.rightArm.remove(this.heldItemMesh);
      this.heldItemMesh.geometry.dispose();
      this.heldItemMesh = null;
    }

    if (!itemId || itemId === BLOCKS.AIR) return;

    let itemColor = 0xa855f7;
    if (itemId in BLOCK_DEFS) {
      const bDef = BLOCK_DEFS[itemId];
      if (itemId === BLOCKS.GRASS) itemColor = 0x559e35;
      else if (itemId === BLOCKS.DIRT) itemColor = 0x866043;
      else if (itemId === BLOCKS.STONE) itemColor = 0x737373;
      else if (itemId === BLOCKS.OAK_LOG) itemColor = 0x674d33;
      else if (itemId === BLOCKS.OAK_PLANKS) itemColor = 0xb8945f;
      else if (itemId === BLOCKS.TORCH) itemColor = 0xf59e0b;
    } else if (itemId in ITEM_DEFS) {
      if (itemId.toString().includes('sword') || itemId.toString().includes('pickaxe')) {
        itemColor = 0x38bdf8;
      }
    }

    const itemGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const itemMat = new THREE.MeshStandardMaterial({
      color: itemColor,
      roughness: 0.5,
    });
    this.heldItemMesh = new THREE.Mesh(itemGeom, itemMat);
    this.heldItemMesh.position.set(0, -0.6, 0.15);
    this.rightArm.add(this.heldItemMesh);
  }

  update(dt: number) {
    // Smooth interpolation towards target position
    this.group.position.lerp(this.targetPosition, Math.min(1.0, dt * 14));

    // Smooth yaw rotation
    let diff = this.targetYaw - this.currentYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.currentYaw += diff * Math.min(1.0, dt * 16);
    this.group.rotation.y = this.currentYaw;

    // Head pitch
    this.head.rotation.x = this.targetPitch;

    // Walk cycle animation
    if (this.isMoving) {
      const speed = this.isSprinting ? 14 : 9;
      this.walkTimer += dt * speed;
      const swing = Math.sin(this.walkTimer) * 0.65;

      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing;
      this.rightArm.rotation.x = swing;
    } else {
      // Idle return to neutral
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, dt * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, dt * 8);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, dt * 8);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, dt * 8);
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }
}
