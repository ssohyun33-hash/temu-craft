import * as THREE from 'three';
import { World } from './World';
import { Chunk } from './Chunk';
import { BLOCKS, BLOCK_DEFS, CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL } from '../blocks';
import { ParticleSystem } from '../particles/ParticleSystem';
import { sounds } from '../sound/SoundManager';

interface FluidBlock {
  x: number;
  y: number;
  z: number;
  flowDist: number; // 0 = source, 1..4 = horizontal flow distance
}

export class FluidSimulator {
  world: World;
  particles?: ParticleSystem;
  private queue: FluidBlock[] = [];
  private nextQueue: FluidBlock[] = [];
  private queuedSet: Set<string> = new Set();
  private flowDistanceMap: Map<string, number> = new Map(); // tracks distance from source (0..4)
  private tickTimer = 0;
  private tickInterval = 0.07; // ~14 updates per second for smooth, realistic cascades
  private splashTimer = 0;

  // Max horizontal spread when water rests on solid ground
  private readonly MAX_SPREAD_DISTANCE = 4;

  constructor(world: World, particles?: ParticleSystem) {
    this.world = world;
    this.particles = particles;
  }

  setParticleSystem(particles: ParticleSystem) {
    this.particles = particles;
  }

  private getKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Queue a block for fluid simulation check
   */
  queueBlock(x: number, y: number, z: number, flowDist?: number) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const key = this.getKey(x, y, z);
    if (this.queuedSet.has(key)) return;

    let dist = flowDist;
    if (dist === undefined) {
      dist = this.flowDistanceMap.get(key) ?? (y <= WATER_LEVEL ? 0 : 0);
    }

    this.queuedSet.add(key);
    this.queue.push({ x, y, z, flowDist: dist });
  }

  /**
   * Called whenever a block is placed, mined, or modified in the world
   */
  onBlockChanged(x: number, y: number, z: number) {
    // Check this block and all 6 surrounding neighbors
    this.queueBlock(x, y, z);
    this.queueBlock(x, y + 1, z);
    this.queueBlock(x, y - 1, z);
    this.queueBlock(x + 1, y, z);
    this.queueBlock(x - 1, y, z);
    this.queueBlock(x, y, z + 1);
    this.queueBlock(x, y, z - 1);
  }

  /**
   * Scan newly generated chunk to kick-start any waterfalls or flowing springs
   */
  scanChunkWater(chunk: Chunk) {
    const cx = chunk.x * CHUNK_SIZE;
    const cz = chunk.z * CHUNK_SIZE;

    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.getBlock(x, y, z);
          if (block === BLOCKS.WATER) {
            const wx = cx + x;
            const wz = cz + z;
            // Check if there is air below or next to it
            const below = y > 0 ? chunk.getBlock(x, y - 1, z) : BLOCKS.BEDROCK;
            if (below === BLOCKS.AIR || (y > WATER_LEVEL)) {
              this.queueBlock(wx, y, wz, 0);
            }
          }
        }
      }
    }
  }

  /**
   * Fluid simulation update tick
   */
  update(dt: number, playerPos: THREE.Vector3) {
    this.tickTimer += dt;
    this.splashTimer += dt;

    if (this.tickTimer < this.tickInterval) {
      return;
    }
    this.tickTimer = 0;

    if (this.queue.length === 0) {
      return;
    }

    const currentBatch = this.queue;
    this.queue = this.nextQueue;
    this.nextQueue = [];
    this.queuedSet.clear();

    const maxUpdatesPerTick = 120; // Maintain solid 60+ FPS performance
    let processed = 0;

    for (let i = 0; i < currentBatch.length && processed < maxUpdatesPerTick; i++) {
      const { x, y, z, flowDist } = currentBatch[i];
      processed++;
      this.processWaterBlock(x, y, z, flowDist, playerPos);
    }

    // Re-queue any unprocessed from current batch into next tick
    if (processed < currentBatch.length) {
      for (let i = processed; i < currentBatch.length; i++) {
        const item = currentBatch[i];
        const key = this.getKey(item.x, item.y, item.z);
        if (!this.queuedSet.has(key)) {
          this.queuedSet.add(key);
          this.queue.push(item);
        }
      }
    }
  }

  private isPassableForWater(blockId: number): boolean {
    if (blockId === BLOCKS.AIR) return true;
    const def = BLOCK_DEFS[blockId];
    return !!def?.isFoliage; // Flowers, grass, torches get washed away by water
  }

  private isSolidBlock(blockId: number): boolean {
    if (blockId === BLOCKS.AIR || blockId === BLOCKS.WATER) return false;
    const def = BLOCK_DEFS[blockId];
    return !def?.isFoliage && !def?.isTransparent;
  }

  private processWaterBlock(x: number, y: number, z: number, flowDist: number, playerPos: THREE.Vector3) {
    const currentBlock = this.world.getBlockAt(x, y, z);
    const key = this.getKey(x, y, z);

    // If block is not water (e.g. was replaced by solid block or already air), clear tracking
    if (currentBlock !== BLOCKS.WATER) {
      this.flowDistanceMap.delete(key);
      return;
    }

    // Determine if this block is currently supported by a source/water from above or adjacent
    const aboveBlock = this.world.getBlockAt(x, y + 1, z);
    const isAboveWater = aboveBlock === BLOCKS.WATER;
    const isNaturalSource = (y <= WATER_LEVEL) || flowDist === 0;

    // Check if unsupported flowing water should drain
    if (!isNaturalSource && !isAboveWater) {
      // Check if there is an adjacent feeding water block with lower flowDist
      let hasSupplier = false;
      const neighbors = [
        [x + 1, y, z],
        [x - 1, y, z],
        [x, y, z + 1],
        [x, y, z - 1],
      ];
      for (const [nx, ny, nz] of neighbors) {
        if (this.world.getBlockAt(nx, ny, nz) === BLOCKS.WATER) {
          const nKey = this.getKey(nx, ny, nz);
          const nDist = this.flowDistanceMap.get(nKey) ?? 0;
          if (nDist < flowDist) {
            hasSupplier = true;
            break;
          }
        }
      }

      if (!hasSupplier) {
        // Water has no supply - drain and turn back into air!
        this.world.setBlockAt(x, y, z, BLOCKS.AIR);
        this.flowDistanceMap.delete(key);
        // Alert neighbors to re-evaluate
        this.onBlockChanged(x, y, z);
        return;
      }
    }

    this.flowDistanceMap.set(key, flowDist);

    // ==========================================
    // 1. HIGHEST PRIORITY: FLOW STRAIGHT DOWN
    // ==========================================
    if (y > 0) {
      const belowBlock = this.world.getBlockAt(x, y - 1, z);

      if (this.isPassableForWater(belowBlock)) {
        // Flow directly down into the space below!
        this.world.setBlockAt(x, y - 1, z, BLOCKS.WATER);
        const belowKey = this.getKey(x, y - 1, z);
        this.flowDistanceMap.set(belowKey, 0); // Vertical falls reset flow distance to 0 (full momentum)

        // Queue the block below to immediately continue cascading down
        this.queueBlock(x, y - 1, z, 0);

        // Splash effects when water falls on surfaces
        if (this.particles && this.splashTimer > 0.15) {
          const twoBelow = y > 1 ? this.world.getBlockAt(x, y - 2, z) : BLOCKS.BEDROCK;
          if (this.isSolidBlock(twoBelow)) {
            const hitPos = new THREE.Vector3(x + 0.5, y - 1.0, z + 0.5);
            if (hitPos.distanceTo(playerPos) < 32) {
              this.particles.spawnWaterSplash(hitPos, 4);
              this.splashTimer = 0;
            }
          }
        }

        // When falling straight down, vertical momentum dominates so skip horizontal spread until ground is hit
        return;
      }
    }

    // ==========================================
    // 2. HORIZONTAL SPREAD ON SOLID BASE
    // ==========================================
    // When water hits solid ground or water base, it can spread outward up to MAX_SPREAD_DISTANCE
    if (flowDist < this.MAX_SPREAD_DISTANCE) {
      const dirs = [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
      ];

      // Check if any neighboring direction has a downward drop (air at y - 1)
      const dropDirs: { dx: number; dz: number }[] = [];
      const flatDirs: { dx: number; dz: number }[] = [];

      for (const { dx, dz } of dirs) {
        const nx = x + dx;
        const nz = z + dz;
        const nBlock = this.world.getBlockAt(nx, y, nz);

        if (this.isPassableForWater(nBlock)) {
          const nBelow = y > 0 ? this.world.getBlockAt(nx, y - 1, nz) : BLOCKS.BEDROCK;
          if (this.isPassableForWater(nBelow)) {
            dropDirs.push({ dx, dz });
          } else {
            flatDirs.push({ dx, dz });
          }
        }
      }

      // Prioritize spreading towards cliff edges / drops
      const targetDirs = dropDirs.length > 0 ? dropDirs : flatDirs;

      for (const { dx, dz } of targetDirs) {
        const nx = x + dx;
        const nz = z + dz;
        const targetBlock = this.world.getBlockAt(nx, y, nz);

        if (this.isPassableForWater(targetBlock)) {
          this.world.setBlockAt(nx, y, nz, BLOCKS.WATER);
          const nextDist = flowDist + 1;
          const nextKey = this.getKey(nx, y, nz);
          this.flowDistanceMap.set(nextKey, nextDist);
          this.queueBlock(nx, y, nz, nextDist);
        }
      }
    }
  }
}
