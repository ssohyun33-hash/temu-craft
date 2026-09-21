import * as THREE from 'three';
import { BLOCKS, BLOCK_DEFS, ITEMS, ITEM_DEFS } from '../blocks';

export class FirstPersonHand {
  camera: THREE.PerspectiveCamera;
  handGroup: THREE.Group;
  itemMesh: THREE.Mesh;
  armMesh: THREE.Mesh;

  currentHoldingId: number = BLOCKS.AIR;
  swingProgress: number = 0;
  isSwinging: boolean = false;
  bobOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.handGroup = new THREE.Group();

    // Arm Mesh (Minecraft skin tone arm)
    const armGeo = new THREE.BoxGeometry(0.12, 0.42, 0.12);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xc48c66,
      roughness: 0.8,
      metalness: 0.1,
    });
    this.armMesh = new THREE.Mesh(armGeo, armMat);
    this.armMesh.position.set(0.28, -0.32, -0.45);
    this.armMesh.rotation.set(0.3, -0.2, 0.15);
    this.handGroup.add(this.armMesh);

    // Item/Block mesh held in hand
    const itemGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const itemMat = new THREE.MeshStandardMaterial({
      color: 0x5b8c34,
      roughness: 0.7,
      metalness: 0.1,
    });
    this.itemMesh = new THREE.Mesh(itemGeo, itemMat);
    this.itemMesh.position.set(0.24, -0.22, -0.48);
    this.itemMesh.rotation.set(0.2, -0.4, 0.2);
    this.handGroup.add(this.itemMesh);

    this.camera.add(this.handGroup);
  }

  updateHeldItem(itemId: number, getItemColor: (id: number) => string) {
    if (this.currentHoldingId === itemId) return;
    this.currentHoldingId = itemId;

    if (itemId === BLOCKS.AIR) {
      this.itemMesh.visible = false;
      this.armMesh.visible = true;
    } else {
      this.itemMesh.visible = true;
      const colorHex = parseInt(getItemColor(itemId).replace('#', '0x'), 16);
      (this.itemMesh.material as THREE.MeshStandardMaterial).color.setHex(colorHex);

      // Distinguish tool shape vs block shape
      const itemDef = ITEM_DEFS[itemId];
      if (itemDef?.isTool) {
        this.itemMesh.scale.set(0.4, 1.4, 0.3);
      } else {
        this.itemMesh.scale.set(1.0, 1.0, 1.0);
      }
    }
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  update(dt: number, isMoving: boolean, isSprinting: boolean, isBreaking: boolean, quality: string) {
    if (quality === 'Very Low') {
      this.handGroup.visible = false;
      return;
    }
    this.handGroup.visible = true;

    // Swing Animation (Mining / Attacking)
    if (isBreaking) {
      this.swingProgress = (this.swingProgress + dt * 10) % (Math.PI * 2);
    } else if (this.isSwinging) {
      this.swingProgress += dt * 14;
      if (this.swingProgress >= Math.PI) {
        this.isSwinging = false;
        this.swingProgress = 0;
      }
    } else {
      this.swingProgress = 0;
    }

    const swingAngle = Math.sin(this.swingProgress) * 0.45;

    // Movement Bobbing
    const time = performance.now() * 0.005;
    let bobX = 0;
    let bobY = 0;

    if (isMoving) {
      const speedMult = isSprinting ? 1.6 : 1.0;
      bobX = Math.cos(time * 1.8 * speedMult) * 0.015;
      bobY = Math.abs(Math.sin(time * 3.6 * speedMult)) * 0.02;
    } else {
      // Idle breathing bob
      bobY = Math.sin(time * 0.5) * 0.004;
    }

    // Apply smooth transforms to hand
    this.handGroup.position.set(bobX, bobY - swingAngle * 0.2, -swingAngle * 0.1);
    this.handGroup.rotation.set(-swingAngle * 0.7, swingAngle * 0.4, -swingAngle * 0.5);
  }
}
