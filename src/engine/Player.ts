import * as THREE from 'three';
import { World } from './world/World';
import { BLOCKS, BLOCK_DEFS } from './blocks';
import { sounds } from './sound/SoundManager';
import { useGameStore } from '../store/gameStore';

export class Player {
  camera: THREE.PerspectiveCamera;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  world: World;

  speed = 4.3; // Minecraft walking speed ~4.3 m/s
  sprintMultiplier = 1.35;
  jumpForce = 8.5;
  gravity = 26.0;
  isGrounded = false;
  isFlying = false;
  isSwimming = false;
  isSubmerged = false;
  isSprinting = false;

  pitch = 0;
  yaw = 0;
  roll = 0;

  // Realistic Camera Dynamics
  bobCycle = 0;
  headBobOffset = new THREE.Vector3();
  landingDip = 0;
  strafeTilt = 0;

  // Fall damage tracking
  highestAirY = 0;
  inAir = false;

  // Footstep audio timers
  private stepDistance = 0;
  private lastSubmerged = false;
  
  // Drowning and Hunger timers
  private drownTimer = 0;
  private hungerDrainTimer = 0;
  private healthRegenTimer = 0;
  private starveTimer = 0;

  constructor(camera: THREE.PerspectiveCamera, world: World) {
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(8, 40, 8);
    this.velocity = new THREE.Vector3();
    this.camera.position.copy(this.position);
    this.highestAirY = this.position.y;
  }

  spawnAtSafeLocation() {
    const spawnX = 8;
    const spawnZ = 8;
    const spawnY = this.world.findSpawnHeight(spawnX, spawnZ);
    this.position.set(spawnX, spawnY, spawnZ);
    this.velocity.set(0, 0, 0);
    this.camera.position.copy(this.position);
    this.camera.position.y += 1.62;
    this.highestAirY = spawnY;
    this.inAir = false;
  }

  setPositionAndRotation(x: number, y: number, z: number, yaw: number = 0, pitch: number = 0) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.camera.position.copy(this.position);
    this.camera.position.y += 1.62;
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch;
    this.highestAirY = y;
    this.inAir = false;
  }

  update(dt: number, keys: Record<string, boolean>) {
    const { gameMode, health, hunger, oxygen, isDead, isNoclip, isViewerMode, setHealth, setHunger, setOxygen, graphicsQuality } = useGameStore.getState();

    if (isDead) {
      return;
    }

    // Force disable flying in survival mode (unless viewer mode or noclip is active)
    if (gameMode === 'survival' && !isViewerMode && !isNoclip && this.isFlying) {
      this.isFlying = false;
      this.inAir = true;
      this.highestAirY = Math.max(this.highestAirY, this.position.y);
    }

    // 1. Water state check
    const feetBlock = this.world.getBlockAt(this.position.x, this.position.y + 0.2, this.position.z);
    const eyeBlock = this.world.getBlockAt(this.position.x, this.position.y + 1.6, this.position.z);

    this.isSwimming = feetBlock === BLOCKS.WATER;
    this.isSubmerged = eyeBlock === BLOCKS.WATER;

    // Splash sound when entering / leaving water
    if (this.isSubmerged !== this.lastSubmerged) {
      sounds.playSplash();
      this.lastSubmerged = this.isSubmerged;
    }

    // Survival mechanics: Drowning
    if (gameMode === 'survival') {
      if (this.isSubmerged) {
        setOxygen((prev) => Math.max(0, prev - dt * 0.7));
        if (oxygen <= 0) {
          this.drownTimer += dt;
          if (this.drownTimer >= 1.2) {
            this.drownTimer = 0;
            sounds.playPlayerHurt();
            setHealth((hp) => hp - 2);
          }
        }
      } else {
        setOxygen((prev) => Math.min(10, prev + dt * 4.0));
        this.drownTimer = 0;
      }

      // Survival mechanics: Hunger depletion (1 part out per 60s of running/movement)
      const isMoving = keys['w'] || keys['a'] || keys['s'] || keys['d'] || keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright'] || (this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z > 0.1);
      if (isMoving) {
        const speedMultiplier = this.isSprinting ? 1.0 : 0.6;
        this.hungerDrainTimer += dt * speedMultiplier;
        if (this.hungerDrainTimer >= 60.0) {
          this.hungerDrainTimer = 0;
          setHunger((h) => Math.max(0, h - 1.0));
        }
      }

      // Health regeneration when well-fed (>= 18)
      if (hunger >= 18 && health < 20) {
        this.healthRegenTimer += dt;
        if (this.healthRegenTimer >= 3.0) {
          this.healthRegenTimer = 0;
          setHealth((hp) => Math.min(20, hp + 1));
          setHunger((h) => Math.max(0, h - 0.5));
        }
      } else {
        this.healthRegenTimer = 0;
      }

      // Starvation damage when hunger == 0
      if (hunger <= 0) {
        this.starveTimer += dt;
        if (this.starveTimer >= 4.0) {
          this.starveTimer = 0;
          if (health > 1) {
            sounds.playPlayerHurt();
            setHealth((hp) => Math.max(1, hp - 1));
          }
        }
      } else {
        this.starveTimer = 0;
      }
    }

    // 2. Movement Direction Vectors & Key Detection (Multi-layout & Robust)
    const isW = Boolean(keys['w'] || keys['keyw'] || keys['arrowup'] || keys['z'] || keys['W']);
    const isS = Boolean(keys['s'] || keys['keys'] || keys['arrowdown'] || keys['S']);
    const isA = Boolean(keys['a'] || keys['keya'] || keys['arrowleft'] || keys['q'] || keys['A']);
    const isD = Boolean(keys['d'] || keys['keyd'] || keys['arrowright'] || keys['D']);
    const isSpace = Boolean(keys[' '] || keys['space'] || keys['Space']);
    const isShift = Boolean(keys['shift'] || keys['shiftleft'] || keys['shiftright'] || keys['control'] || keys['controlleft'] || keys['c'] || keys['keyc']);

    const isViewerActive = Boolean(isViewerMode || isNoclip || this.isFlying);

    // Camera vectors
    const forwardHoriz = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const rightHoriz = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    // 3D Camera Look Direction (for 3D free-flying in Viewer / Fly mode)
    const camDir3D = new THREE.Vector3();
    this.camera.getWorldDirection(camDir3D);
    const camRight3D = new THREE.Vector3().crossVectors(camDir3D, new THREE.Vector3(0, 1, 0)).normalize();

    const inputDir = new THREE.Vector3();
    let strafeInput = 0;

    if (isViewerActive) {
      // Full 3D Flight Direction: WASD glides towards where the camera looks!
      if (isW) inputDir.add(camDir3D);
      if (isS) inputDir.sub(camDir3D);
      if (isD) {
        inputDir.add(camRight3D);
        strafeInput += 1;
      }
      if (isA) {
        inputDir.sub(camRight3D);
        strafeInput -= 1;
      }
      if (isSpace) inputDir.y += 1.0;
      if (isShift) inputDir.y -= 1.0;
    } else {
      // Standard Ground / Swim Movement
      if (isW) inputDir.add(forwardHoriz);
      if (isS) inputDir.sub(forwardHoriz);
      if (isD) {
        inputDir.add(rightHoriz);
        strafeInput += 1;
      }
      if (isA) {
        inputDir.sub(rightHoriz);
        strafeInput -= 1;
      }
    }

    const isMoving = inputDir.lengthSq() > 0.001;
    if (isMoving) inputDir.normalize();

    this.isSprinting = isShift && !this.isSwimming && !isViewerActive;
    const isSprinting = this.isSprinting;
    let targetSpeed = this.speed;

    if (isViewerActive) {
      targetSpeed = this.speed * (isShift ? 4.2 : 2.8);
    } else if (this.isSwimming) {
      targetSpeed = this.speed * 0.65;
    } else if (isSprinting) {
      targetSpeed = this.speed * this.sprintMultiplier;
    }

    // 3. Velocity & Flight Integration
    if (isViewerActive) {
      // Smooth 3D Flying Velocity with high responsiveness
      const flyAccel = 18.0;
      this.velocity.x += (inputDir.x * targetSpeed - this.velocity.x) * Math.min(1, flyAccel * dt);
      this.velocity.y += (inputDir.y * targetSpeed - this.velocity.y) * Math.min(1, flyAccel * dt);
      this.velocity.z += (inputDir.z * targetSpeed - this.velocity.z) * Math.min(1, flyAccel * dt);
      this.highestAirY = this.position.y;
      this.inAir = false;
    } else {
      // Ground / Swim Horizontal Velocity
      const accel = (this.isGrounded || isNoclip) ? 16.0 : 7.0;
      this.velocity.x += (inputDir.x * targetSpeed - this.velocity.x) * Math.min(1, accel * dt);
      this.velocity.z += (inputDir.z * targetSpeed - this.velocity.z) * Math.min(1, accel * dt);

      // 4. Vertical velocity & Gravity (Non-flight)
      if (this.isSwimming) {
        this.highestAirY = this.position.y;
        this.inAir = false;

        const blockUnder = this.world.getBlockAt(this.position.x, this.position.y - 0.5, this.position.z);
        const isWaterfall = blockUnder === BLOCKS.AIR;
        const gravFactor = isWaterfall ? 0.35 : 0.15;

        this.velocity.y -= (this.gravity * gravFactor) * dt;
        if (isSpace) {
          this.velocity.y = 3.5;
        } else if (isShift) {
          this.velocity.y = -3.5;
        } else {
          this.velocity.y *= 0.85;
        }
        this.velocity.x *= 0.88;
        this.velocity.z *= 0.88;
      } else {
        if (!this.isGrounded) {
          if (!this.inAir) {
            this.inAir = true;
            this.highestAirY = this.position.y;
          } else {
            this.highestAirY = Math.max(this.highestAirY, this.position.y);
          }
          this.velocity.y -= this.gravity * dt;
        } else {
          this.velocity.y = Math.max(0, this.velocity.y);
          if (isSpace) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.inAir = true;
            this.highestAirY = this.position.y;
          }
        }
      }
    }

    // 5. Collision & Movement physics
    const wasInAir = !this.isGrounded && !this.isFlying && !this.isSwimming;
    this.isGrounded = false;

    const moveAxis = (axis: 'x' | 'y' | 'z', dist: number) => {
      if (dist === 0) return;
      const dir = Math.sign(dist);
      const steps = Math.ceil(Math.abs(dist) * 12);
      const stepDist = dist / steps;

      for (let i = 0; i < steps; i++) {
        this.position[axis] += stepDist;
        if (this.checkCollision()) {
          this.position[axis] -= stepDist;
          this.velocity[axis] = 0;
          if (axis === 'y' && dir < 0) {
            this.isGrounded = true;
          }
          break;
        }
      }
    };

    moveAxis('y', this.velocity.y * dt);
    moveAxis('x', this.velocity.x * dt);
    moveAxis('z', this.velocity.z * dt);

    // 6. Fall Damage & Landing Dip Camera Impulse
    if (this.isGrounded && wasInAir && !this.isFlying) {
      const fallDistance = this.highestAirY - this.position.y;
      this.landingDip = Math.min(0.22, Math.max(0.06, fallDistance * 0.04));

      if (gameMode === 'survival' && fallDistance >= 5.0) {
        const dmg = Math.floor((fallDistance - 4) * 1.5);
        if (dmg > 0) {
          sounds.playPlayerHurt();
          setHealth((hp) => hp - dmg);
        }
      }
      this.inAir = false;
      this.highestAirY = this.position.y;
    } else if (this.isGrounded) {
      this.inAir = false;
      this.highestAirY = this.position.y;
    }

    // 7. Footstep sound triggers
    if (this.isGrounded && isMoving && !this.isFlying && !this.isSwimming) {
      const horizontalDist = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z) * dt;
      this.stepDistance += horizontalDist;

      const stepInterval = isSprinting ? 1.5 : 1.9;
      if (this.stepDistance >= stepInterval) {
        this.stepDistance = 0;
        const groundBlock = this.world.getBlockAt(this.position.x, this.position.y - 0.5, this.position.z);
        let surface: 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'water' = 'grass';
        if (groundBlock === BLOCKS.STONE || groundBlock === BLOCKS.COBBLESTONE) surface = 'stone';
        else if (groundBlock === BLOCKS.DIRT) surface = 'dirt';
        else if (groundBlock === BLOCKS.SAND) surface = 'sand';
        else if (groundBlock === BLOCKS.OAK_LOG || groundBlock === BLOCKS.OAK_PLANKS) surface = 'wood';
        sounds.playFootstep(surface);
      }
    }

    // 8. Realistic Head Bobbing, Strafe Roll & Landing Spring
    const isRealisticQuality = graphicsQuality !== 'Very Low';
    if (isRealisticQuality) {
      // Landing spring recovery
      this.landingDip = Math.max(0, this.landingDip - dt * 0.9);

      // Smooth strafe banking roll
      const targetRoll = strafeInput * -0.022;
      this.strafeTilt += (targetRoll - this.strafeTilt) * dt * 8;

      // Realistic Head Bobbing
      if (this.isGrounded && isMoving && !this.isFlying) {
        const bobFreq = isSprinting ? 14 : 10;
        const bobAmpY = isSprinting ? 0.055 : 0.035;
        const bobAmpX = isSprinting ? 0.035 : 0.02;

        this.bobCycle += dt * bobFreq;
        this.headBobOffset.y = Math.sin(this.bobCycle) * bobAmpY - this.landingDip;
        this.headBobOffset.x = Math.cos(this.bobCycle * 0.5) * bobAmpX;
      } else {
        this.headBobOffset.x += (0 - this.headBobOffset.x) * dt * 6;
        this.headBobOffset.y += (-this.landingDip - this.headBobOffset.y) * dt * 6;
      }
    } else {
      this.headBobOffset.set(0, 0, 0);
      this.strafeTilt = 0;
    }

    // 9. Update Camera Position & Rotation
    this.camera.position.set(
      this.position.x + this.headBobOffset.x,
      this.position.y + 1.62 + this.headBobOffset.y,
      this.position.z
    );

    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(this.strafeTilt);

    // Dynamic FOV with smooth sprint stretch
    const targetFov = isSprinting ? 84 : (this.isSubmerged ? 68 : 75);
    this.camera.fov += (targetFov - this.camera.fov) * dt * 8;
    this.camera.updateProjectionMatrix();
  }

  checkCollision(): boolean {
    const { isNoclip, isViewerMode, gameMode } = useGameStore.getState();
    if (isNoclip || isViewerMode || (this.isFlying && gameMode === 'creative')) return false;

    const halfW = 0.3;
    const minX = Math.floor(this.position.x - halfW);
    const maxX = Math.floor(this.position.x + halfW);
    const minY = Math.floor(this.position.y);
    const maxY = Math.floor(this.position.y + 1.75);
    const minZ = Math.floor(this.position.z - halfW);
    const maxZ = Math.floor(this.position.z + halfW);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.world.getBlockAt(x, y, z);
          if (block === BLOCKS.AIR || block === BLOCKS.WATER) continue;
          const def = BLOCK_DEFS[block];
          if (def?.isSolid === false || def?.isFoliage) continue;
          return true;
        }
      }
    }
    return false;
  }
}
