import * as THREE from 'three';
import { World } from '../world/World';
import { BLOCKS, ITEMS } from '../blocks';
import { sounds } from '../sound/SoundManager';

export type AnimalType = 'pig' | 'cow' | 'sheep';

export class Animal {
  type: AnimalType;
  group: THREE.Group;
  world: World;
  
  position: THREE.Vector3;
  velocity: THREE.Vector3 = new THREE.Vector3();
  rotation: number = 0;
  
  // Health & Damage
  maxHealth: number = 10;
  health: number = 10;
  isDead: boolean = false;
  hurtTimer: number = 0;

  // Model parts for animation & material flashing
  materials: THREE.MeshLambertMaterial[] = [];
  head: THREE.Mesh;
  body: THREE.Mesh;
  legFL: THREE.Mesh;
  legFR: THREE.Mesh;
  legBL: THREE.Mesh;
  legBR: THREE.Mesh;

  // AI State
  state: 'idle' | 'walk' | 'panic' = 'idle';
  stateTimer: number = 2;
  targetDirection: THREE.Vector3 = new THREE.Vector3();
  walkSpeed: number = 1.6;
  soundTimer: number = 5 + Math.random() * 10;
  
  isGrounded: boolean = false;
  walkCycle: number = 0;

  constructor(type: AnimalType, pos: THREE.Vector3, world: World) {
    this.type = type;
    this.world = world;
    this.position = pos.clone();
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    if (type === 'sheep') {
      this.maxHealth = 8;
      this.health = 8;
    } else {
      this.maxHealth = 10;
      this.health = 10;
    }

    // Build voxel mesh based on type
    const parts = this.buildModel(type);
    this.head = parts.head;
    this.body = parts.body;
    this.legFL = parts.legFL;
    this.legFR = parts.legFR;
    this.legBL = parts.legBL;
    this.legBR = parts.legBR;

    this.group.add(this.body);
    this.group.add(this.head);
    this.group.add(this.legFL);
    this.group.add(this.legFR);
    this.group.add(this.legBL);
    this.group.add(this.legBR);

    // Tag for raycasting
    this.group.userData = { isMob: true, animal: this };
  }

  private buildModel(type: AnimalType) {
    let bodyColor = 0xf08080; // Pig pink
    let headColor = 0xf29191;
    let legColor = 0xdb7070;
    let bodySize: [number, number, number] = [0.8, 0.6, 1.2];
    let headSize: [number, number, number] = [0.5, 0.5, 0.5];
    let legSize: [number, number, number] = [0.2, 0.5, 0.2];

    if (type === 'cow') {
      bodyColor = 0x4a3728; // Brown/White cow
      headColor = 0x5a4433;
      legColor = 0x3d2c1e;
      bodySize = [0.9, 0.8, 1.4];
      headSize = [0.55, 0.55, 0.55];
      legSize = [0.22, 0.7, 0.22];
    } else if (type === 'sheep') {
      bodyColor = 0xf0eee9; // Fluffy White wool
      headColor = 0xd9cbb2; // Beige skin
      legColor = 0xbfae95;
      bodySize = [0.95, 0.8, 1.25];
      headSize = [0.45, 0.45, 0.45];
      legSize = [0.2, 0.6, 0.2];
    }

    const createMat = (c: number) => {
      const m = new THREE.MeshLambertMaterial({ color: c });
      this.materials.push(m);
      return m;
    };

    // Body
    const bodyGeo = new THREE.BoxGeometry(...bodySize);
    const body = new THREE.Mesh(bodyGeo, createMat(bodyColor));
    body.position.set(0, legSize[1] + bodySize[1] / 2, 0);
    body.castShadow = true;
    body.userData = { isMob: true, animal: this };

    // Head
    const headGeo = new THREE.BoxGeometry(...headSize);
    const head = new THREE.Mesh(headGeo, createMat(headColor));
    head.position.set(0, legSize[1] + bodySize[1] * 0.8, -bodySize[2] / 2 - headSize[2] / 2 + 0.1);
    head.castShadow = true;
    head.userData = { isMob: true, animal: this };

    // Legs
    const legGeo = new THREE.BoxGeometry(...legSize);
    const legFL = new THREE.Mesh(legGeo, createMat(legColor));
    const legFR = new THREE.Mesh(legGeo, createMat(legColor));
    const legBL = new THREE.Mesh(legGeo, createMat(legColor));
    const legBR = new THREE.Mesh(legGeo, createMat(legColor));

    const lx = bodySize[0] / 2 - legSize[0] / 2;
    const lz = bodySize[2] / 2 - legSize[2] / 2;
    const ly = legSize[1] / 2;

    legFL.position.set(-lx, ly, -lz);
    legFR.position.set(lx, ly, -lz);
    legBL.position.set(-lx, ly, lz);
    legBR.position.set(lx, ly, lz);

    legFL.userData = { isMob: true, animal: this };
    legFR.userData = { isMob: true, animal: this };
    legBL.userData = { isMob: true, animal: this };
    legBR.userData = { isMob: true, animal: this };

    return { body, head, legFL, legFR, legBL, legBR };
  }

  takeDamage(
    amount: number,
    knockbackDir: THREE.Vector3,
    onDeath: (dropItem: number, count: number, pos: THREE.Vector3) => void
  ): boolean {
    if (this.isDead) return false;

    this.health -= amount;
    this.hurtTimer = 0.2; // Red hurt flash

    // Knockback
    this.velocity.x += knockbackDir.x * 6;
    this.velocity.y += 4.5;
    this.velocity.z += knockbackDir.z * 6;

    // Panic AI
    this.state = 'panic';
    this.stateTimer = 4.0;
    this.walkSpeed = 4.2;
    const angle = Math.atan2(knockbackDir.x, knockbackDir.z);
    this.targetDirection.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
    this.rotation = angle + Math.PI;

    sounds.playMobHurt();

    if (this.health <= 0) {
      this.isDead = true;
      let dropItem = ITEMS.RAW_PORKCHOP;
      let count = 1 + Math.floor(Math.random() * 2);

      if (this.type === 'sheep') {
        dropItem = BLOCKS.WHITE_WOOL; // User: "Kill sheep, i get a wool"
        count = 1 + Math.floor(Math.random() * 2);
      } else if (this.type === 'cow') {
        dropItem = ITEMS.RAW_BEEF;
        count = 1 + Math.floor(Math.random() * 2);
      }

      onDeath(dropItem, count, this.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
      return true;
    }
    return false;
  }

  update(dt: number) {
    if (this.isDead) return;

    // Hurt flash visual update
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      for (const m of this.materials) {
        m.color.setHex(0xff3333);
      }
    } else {
      for (const m of this.materials) {
        if (this.type === 'pig') m.color.setHex(0xf08080);
        else if (this.type === 'cow') m.color.setHex(0x4a3728);
        else if (this.type === 'sheep') m.color.setHex(0xf0eee9);
      }
    }

    // Ambient Sound loop
    this.soundTimer -= dt;
    if (this.soundTimer <= 0) {
      if (Math.random() < 0.6) {
        sounds.playAnimalSound(this.type);
      }
      this.soundTimer = 8 + Math.random() * 15;
    }

    // AI state machine
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      if (this.state === 'idle') {
        this.state = 'walk';
        this.walkSpeed = 1.6;
        this.stateTimer = 2 + Math.random() * 4;
        const angle = Math.random() * Math.PI * 2;
        this.targetDirection.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
        this.rotation = angle + Math.PI;
      } else {
        this.state = 'idle';
        this.walkSpeed = 1.6;
        this.stateTimer = 3 + Math.random() * 5;
        this.targetDirection.set(0, 0, 0);
      }
    }

    // Movement & Collision
    if (this.state === 'walk' || this.state === 'panic') {
      // Check ahead for water to avoid it
      const aheadX = this.position.x + this.targetDirection.x * 1.0;
      const aheadZ = this.position.z + this.targetDirection.z * 1.0;
      const blockAhead = this.world.getBlockAt(aheadX, this.position.y, aheadZ);
      const blockUnderAhead = this.world.getBlockAt(aheadX, this.position.y - 1, aheadZ);

      if (blockAhead === BLOCKS.WATER || blockUnderAhead === BLOCKS.WATER) {
        this.targetDirection.negate();
        this.rotation += Math.PI;
      }

      this.velocity.x = this.targetDirection.x * this.walkSpeed;
      this.velocity.z = this.targetDirection.z * this.walkSpeed;
      this.walkCycle += dt * (this.state === 'panic' ? 14 : 6);
    } else {
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
      this.walkCycle = 0;
    }

    // Gravity
    this.velocity.y -= 22 * dt;

    // Apply vertical physics
    this.position.y += this.velocity.y * dt;
    const groundY = this.findGroundY(this.position.x, this.position.z, this.position.y);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Apply horizontal physics with simple step-up (auto jump 1 block)
    const newX = this.position.x + this.velocity.x * dt;
    const newZ = this.position.z + this.velocity.z * dt;
    const headBlock = this.world.getBlockAt(newX, this.position.y + 0.5, newZ);

    if (headBlock === BLOCKS.AIR || headBlock === BLOCKS.WATER) {
      this.position.x = newX;
      this.position.z = newZ;
    } else {
      const aboveHead = this.world.getBlockAt(newX, this.position.y + 1.5, newZ);
      if (aboveHead === BLOCKS.AIR) {
        this.position.y += 1.0;
        this.position.x = newX;
        this.position.z = newZ;
      } else {
        this.targetDirection.set(-this.targetDirection.z, 0, this.targetDirection.x);
        this.rotation += Math.PI / 2;
      }
    }

    // Sync 3D group
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;

    // Leg swing animation
    const swing = Math.sin(this.walkCycle) * 0.4;
    this.legFL.rotation.x = swing;
    this.legBR.rotation.x = swing;
    this.legFR.rotation.x = -swing;
    this.legBL.rotation.x = -swing;
  }

  private findGroundY(x: number, z: number, currentY: number): number {
    for (let y = Math.min(60, Math.floor(currentY + 1)); y >= 0; y--) {
      const block = this.world.getBlockAt(x, y, z);
      if (block !== BLOCKS.AIR && block !== BLOCKS.WATER) {
        return y + 1;
      }
    }
    return 1;
  }
}
