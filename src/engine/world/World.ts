import * as THREE from 'three';
import { Chunk } from './Chunk';
import { TerrainGenerator } from './TerrainGenerator';
import { CHUNK_SIZE, BLOCKS, BLOCK_DEFS } from '../blocks';
import { FluidSimulator } from './FluidSimulator';
import { ParticleSystem } from '../particles/ParticleSystem';

export class World {
  chunks: Map<string, Chunk> = new Map();
  scene: THREE.Scene;
  opaqueMaterial: THREE.Material;
  waterMaterial: THREE.Material;
  generator: TerrainGenerator;
  fluidSimulator: FluidSimulator;
  modifiedBlocks: Map<string, number> = new Map();

  // Queue to generate & mesh progressively
  private generateQueue: [number, number][] = [];
  private meshQueue: Chunk[] = [];

  constructor(
    scene: THREE.Scene,
    opaqueMaterial: THREE.Material,
    waterMaterial: THREE.Material,
    particles?: ParticleSystem
  ) {
    this.scene = scene;
    this.opaqueMaterial = opaqueMaterial;
    this.waterMaterial = waterMaterial;
    this.generator = new TerrainGenerator();
    this.fluidSimulator = new FluidSimulator(this, particles);
  }

  setParticleSystem(particles: ParticleSystem) {
    this.fluidSimulator.setParticleSystem(particles);
  }

  getChunkKey(x: number, z: number) {
    return `${x},${z}`;
  }

  getChunk(x: number, z: number) {
    return this.chunks.get(this.getChunkKey(x, z));
  }

  private applyModificationsToChunk(chunk: Chunk) {
    if (this.modifiedBlocks.size === 0) return;
    const minX = chunk.x * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE;
    const minZ = chunk.z * CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE;

    for (const [key, blockId] of this.modifiedBlocks.entries()) {
      const comma1 = key.indexOf(',');
      const comma2 = key.indexOf(',', comma1 + 1);
      const x = parseInt(key.substring(0, comma1), 10);
      const y = parseInt(key.substring(comma1 + 1, comma2), 10);
      const z = parseInt(key.substring(comma2 + 1), 10);

      if (x >= minX && x < maxX && z >= minZ && z < maxZ) {
        const bx = x - minX;
        const bz = z - minZ;
        chunk.setBlock(bx, y, bz, blockId);
      }
    }
  }

  // Initial immediate generation around spawn so the world is visible instantly!
  initSpawnArea(spawnX: number, spawnZ: number, radius: number = 3) {
    const px = Math.floor(spawnX / CHUNK_SIZE);
    const pz = Math.floor(spawnZ / CHUNK_SIZE);

    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const cx = px + x;
        const cz = pz + z;
        const key = this.getChunkKey(cx, cz);
        if (!this.chunks.has(key)) {
          const chunk = new Chunk(cx, cz);
          this.generator.generateChunkData(cx, cz, chunk.data);
          this.applyModificationsToChunk(chunk);
          chunk.isGenerated = true;
          this.chunks.set(key, chunk);
          this.fluidSimulator.scanChunkWater(chunk);
        }
      }
    }

    // Immediately build mesh for initial chunks
    for (const chunk of Array.from(this.chunks.values())) {
      chunk.buildMesh(this.opaqueMaterial, this.waterMaterial, this.getNeighborBlock.bind(this));
      if (chunk.opaqueMesh && !this.scene.children.includes(chunk.opaqueMesh)) {
        this.scene.add(chunk.opaqueMesh);
      }
      if (chunk.waterMesh && !this.scene.children.includes(chunk.waterMesh)) {
        this.scene.add(chunk.waterMesh);
      }
    }
  }

  update(playerPos: THREE.Vector3, renderDistance: number, dt: number = 0.016) {
    const px = Math.floor(playerPos.x / CHUNK_SIZE);
    const pz = Math.floor(playerPos.z / CHUNK_SIZE);

    // 1. Identify chunks that need to be generated progressively (radial rings outward)
    let generatedThisFrame = 0;
    const maxGeneratesPerFrame = 10;

    for (let r = 0; r <= renderDistance && generatedThisFrame < maxGeneratesPerFrame; r++) {
      for (let x = -r; x <= r && generatedThisFrame < maxGeneratesPerFrame; x++) {
        for (let z = -r; z <= r && generatedThisFrame < maxGeneratesPerFrame; z++) {
          // Only process outer edge of current ring radius
          if (Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
          if (x * x + z * z > renderDistance * renderDistance) continue;

          const cx = px + x;
          const cz = pz + z;
          const key = this.getChunkKey(cx, cz);

          if (!this.chunks.has(key)) {
            const chunk = new Chunk(cx, cz);
            this.generator.generateChunkData(cx, cz, chunk.data);
            this.applyModificationsToChunk(chunk);
            chunk.isGenerated = true;
            this.chunks.set(key, chunk);
            this.fluidSimulator.scanChunkWater(chunk);

            // Mark neighbors dirty so seams connect seamlessly
            this.markChunkDirty(cx + 1, cz);
            this.markChunkDirty(cx - 1, cz);
            this.markChunkDirty(cx, cz + 1);
            this.markChunkDirty(cx, cz - 1);
            generatedThisFrame++;
          }
        }
      }
    }

    // 2. Unload distant chunks and mesh dirty chunks
    const toRemove: string[] = [];
    const maxDistSq = (renderDistance + 2) * (renderDistance + 2);

    let meshedCount = 0;
    const maxMeshesPerFrame = 8; // Fast responsive meshing for flowing water cascades and terrain updates

    for (const [key, chunk] of Array.from(this.chunks.entries())) {
      const dx = chunk.x - px;
      const dz = chunk.z - pz;

      if (dx * dx + dz * dz > maxDistSq) {
        chunk.dispose(this.scene);
        toRemove.push(key);
      } else if (chunk.isDirty && meshedCount < maxMeshesPerFrame) {
        chunk.buildMesh(this.opaqueMaterial, this.waterMaterial, this.getNeighborBlock.bind(this));
        if (chunk.opaqueMesh && !this.scene.children.includes(chunk.opaqueMesh)) {
          this.scene.add(chunk.opaqueMesh);
        }
        if (chunk.waterMesh && !this.scene.children.includes(chunk.waterMesh)) {
          this.scene.add(chunk.waterMesh);
        }
        meshedCount++;
      }
    }

    for (const key of toRemove) {
      this.chunks.delete(key);
    }

    // 3. Update Fluid Dynamics & Water Flow Simulation
    this.fluidSimulator.update(dt, playerPos);
  }

  private markChunkDirty(cx: number, cz: number) {
    const chunk = this.getChunk(cx, cz);
    if (chunk) chunk.isDirty = true;
  }

  getNeighborBlock(cx: number, cz: number, bx: number, by: number, bz: number): number {
    let nx = cx;
    let nz = cz;
    let nbx = bx;
    let nbz = bz;

    if (bx < 0) { nx -= 1; nbx += CHUNK_SIZE; }
    else if (bx >= CHUNK_SIZE) { nx += 1; nbx -= CHUNK_SIZE; }

    if (bz < 0) { nz -= 1; nbz += CHUNK_SIZE; }
    else if (bz >= CHUNK_SIZE) { nz += 1; nbz -= CHUNK_SIZE; }

    const chunk = this.getChunk(nx, nz);
    if (chunk) return chunk.getBlock(nbx, by, nbz);
    return BLOCKS.AIR;
  }

  getBlockAt(wx: number, wy: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCKS.AIR;

    const bx = Math.floor(wx) - cx * CHUNK_SIZE;
    const by = Math.floor(wy);
    const bz = Math.floor(wz) - cz * CHUNK_SIZE;
    return chunk.getBlock(bx, by, bz);
  }

  setBlockAt(wx: number, wy: number, wz: number, blockId: number, notifyFluid: boolean = true) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    const bx = Math.floor(wx) - cx * CHUNK_SIZE;
    const by = Math.floor(wy);
    const bz = Math.floor(wz) - cz * CHUNK_SIZE;
    const prevBlock = chunk.getBlock(bx, by, bz);
    if (prevBlock === blockId) return;

    chunk.setBlock(bx, by, bz, blockId);
    this.modifiedBlocks.set(`${Math.floor(wx)},${Math.floor(wy)},${Math.floor(wz)}`, blockId);

    // Update neighbors if placed on boundary
    if (bx === 0) this.markChunkDirty(cx - 1, cz);
    if (bx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (bz === 0) this.markChunkDirty(cx, cz - 1);
    if (bz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

    // Notify fluid simulator to react immediately to block changes
    if (notifyFluid) {
      this.fluidSimulator.onBlockChanged(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    }
  }

  findSpawnHeight(x: number, z: number): number {
    for (let y = 60; y >= 1; y--) {
      const block = this.getBlockAt(x, y, z);
      const def = BLOCK_DEFS[block];
      if (block !== BLOCKS.AIR && !def?.isLiquid && !def?.isFoliage) {
        return y + 2;
      }
    }
    return 35;
  }

  reseed(seed: string, spawnX = 8, spawnZ = 8, preserveModifications: boolean = false) {
    for (const chunk of this.chunks.values()) {
      chunk.dispose(this.scene);
    }
    this.chunks.clear();
    this.generateQueue = [];
    this.meshQueue = [];
    if (!preserveModifications) {
      this.modifiedBlocks.clear();
    }
    this.generator = new TerrainGenerator(seed);
    this.initSpawnArea(spawnX, spawnZ, 3);
  }

  getModifiedBlocksArray(): [number, number, number, number][] {
    const result: [number, number, number, number][] = [];
    for (const [key, id] of this.modifiedBlocks.entries()) {
      const parts = key.split(',');
      result.push([parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10), id]);
    }
    return result;
  }

  setModifiedBlocksFromArray(blocks: [number, number, number, number][]) {
    this.modifiedBlocks.clear();
    if (Array.isArray(blocks)) {
      for (const [x, y, z, id] of blocks) {
        this.modifiedBlocks.set(`${x},${y},${z}`, id);
      }
    }
  }

  clearModifiedBlocks() {
    this.modifiedBlocks.clear();
  }

  getLoadedChunkCount(): number {
    return this.chunks.size;
  }
}
