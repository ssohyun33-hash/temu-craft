import { createNoise2D, createNoise3D } from 'simplex-noise';
import { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, BLOCKS } from '../blocks';

export class TerrainGenerator {
  seed: string;
  noiseElevation: (x: number, y: number) => number;
  noiseRoughness: (x: number, y: number) => number;
  noiseBiome: (x: number, y: number) => number;
  noiseForest: (x: number, y: number) => number;
  noiseMountains: (x: number, y: number) => number;
  noiseCaves: (x: number, y: number, z: number) => number;
  noiseCaveDetails: (x: number, y: number, z: number) => number;

  constructor(seed: string = 'voxel_world_2026') {
    this.seed = seed;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
    }
    const createPrng = (offset: number) => {
      let h = (hash + offset) | 0;
      return () => {
        h = Math.imul(741103597, h) + 1 | 0;
        return (h >>> 0) / 4294967296;
      };
    };

    this.noiseElevation = createNoise2D(createPrng(100));
    this.noiseRoughness = createNoise2D(createPrng(200));
    this.noiseBiome = createNoise2D(createPrng(300));
    this.noiseForest = createNoise2D(createPrng(350));
    this.noiseMountains = createNoise2D(createPrng(380));
    this.noiseCaves = createNoise3D(createPrng(400));
    this.noiseCaveDetails = createNoise3D(createPrng(500));
  }

  generateChunkData(chunkX: number, chunkZ: number, data: Uint8Array) {
    const heightMap = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
    const surfaceBlockMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    // PASS 1: Build base terrain columns for all (x, z)
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        const biomeVal = this.noiseBiome(worldX * 0.0035, worldZ * 0.0035);
        const mountainFactor = this.noiseMountains(worldX * 0.006, worldZ * 0.006);

        const continent = this.noiseElevation(worldX * 0.004, worldZ * 0.004);
        const hills = this.noiseRoughness(worldX * 0.018, worldZ * 0.018) * 0.45;
        const detail = this.noiseElevation(worldX * 0.05, worldZ * 0.05) * 0.15;

        let baseHeight = 27 + (continent * 10) + (hills * 8) + (detail * 3);

        if (mountainFactor > 0.15 || biomeVal < -0.35) {
          const mWeight = Math.max(0, mountainFactor - 0.15) * 2.5 + Math.max(0, -biomeVal - 0.35) * 1.8;
          baseHeight += mWeight * 26;
        }

        const height = Math.floor(Math.max(1, Math.min(CHUNK_HEIGHT - 4, baseHeight)));
        const mapIdx = x + z * CHUNK_SIZE;
        heightMap[mapIdx] = height;

        // Bedrock at bottom
        data[x + z * CHUNK_SIZE + 0 * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.BEDROCK;

        let surfaceBlock = BLOCKS.GRASS;
        let subBlock = BLOCKS.DIRT;

        if (height <= WATER_LEVEL + 1) {
          surfaceBlock = BLOCKS.SAND;
          subBlock = BLOCKS.SAND;
        } else if (biomeVal > 0.42) {
          surfaceBlock = BLOCKS.SAND;
          subBlock = BLOCKS.SAND;
        } else if (height > 46) {
          surfaceBlock = BLOCKS.SNOW_GRASS;
          subBlock = BLOCKS.STONE;
        } else if (height > 38 && mountainFactor > 0.3) {
          surfaceBlock = BLOCKS.STONE;
          subBlock = BLOCKS.STONE;
        } else {
          surfaceBlock = BLOCKS.GRASS;
          subBlock = BLOCKS.DIRT;
        }
        surfaceBlockMap[mapIdx] = surfaceBlock;

        for (let y = 1; y < CHUNK_HEIGHT; y++) {
          const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;

          if (y > height) {
            if (y <= WATER_LEVEL) {
              data[idx] = BLOCKS.WATER;
            } else {
              data[idx] = BLOCKS.AIR;
            }
          } else if (y === height) {
            data[idx] = surfaceBlock;
          } else if (y > height - 4) {
            data[idx] = subBlock;
          } else {
            const cave1 = this.noiseCaves(worldX * 0.045, y * 0.06, worldZ * 0.045);
            const cave2 = this.noiseCaveDetails(worldX * 0.07, y * 0.07, worldZ * 0.07);
            const isCave = (cave1 > 0.58 && Math.abs(cave2) > 0.15) && y < height - 2 && y > 2;

            if (isCave) {
              data[idx] = BLOCKS.AIR;
            } else {
              const oreRand = Math.sin(worldX * 37.17 + y * 13.51 + worldZ * 59.83) * 10000;
              const r = oreRand - Math.floor(oreRand);

              if (y < 16 && r < 0.012) {
                data[idx] = BLOCKS.DIAMOND_ORE;
              } else if (y < 20 && r < 0.02) {
                data[idx] = BLOCKS.REDSTONE_ORE;
              } else if (y < 25 && r < 0.025) {
                data[idx] = BLOCKS.GOLD_ORE;
              } else if (y < 30 && r < 0.035) {
                data[idx] = BLOCKS.LAPIS_ORE;
              } else if (biomeVal < -0.2 && y > 28 && r < 0.018) {
                data[idx] = BLOCKS.EMERALD_ORE;
              } else if (y < 45 && r < 0.065) {
                data[idx] = BLOCKS.IRON_ORE;
              } else if (r < 0.09) {
                data[idx] = BLOCKS.COAL_ORE;
              } else {
                data[idx] = BLOCKS.STONE;
              }
            }
          }
        }
      }
    }

    // PASS 2: Place Flora, Cacti, Flowers, and Full Symmetrical 3D Trees
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const mapIdx = x + z * CHUNK_SIZE;
        const height = heightMap[mapIdx];
        const surfaceBlock = surfaceBlockMap[mapIdx];

        if (height <= WATER_LEVEL + 1 || height >= 44) continue;

        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        const biomeVal = this.noiseBiome(worldX * 0.0035, worldZ * 0.0035);
        const forestVal = this.noiseForest(worldX * 0.012, worldZ * 0.012);

        const decorRand = Math.sin(worldX * 71.3 + worldZ * 89.7) * 10000;
        const dr = decorRand - Math.floor(decorRand);

        // Cacti
        if (surfaceBlock === BLOCKS.SAND && dr < 0.02) {
          const cactusH = 2 + (Math.floor(dr * 50) % 2);
          for (let cy = 1; cy <= cactusH; cy++) {
            if (height + cy < CHUNK_HEIGHT) {
              data[x + z * CHUNK_SIZE + (height + cy) * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.CACTUS;
            }
          }
        }
        // Tall Grass & Flowers
        else if (surfaceBlock === BLOCKS.GRASS && dr < 0.22) {
          const targetY = height + 1;
          if (targetY < CHUNK_HEIGHT) {
            const currentBlock = data[x + z * CHUNK_SIZE + targetY * CHUNK_SIZE * CHUNK_SIZE];
            if (currentBlock === BLOCKS.AIR) {
              if (dr < 0.16) {
                data[x + z * CHUNK_SIZE + targetY * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.TALL_GRASS;
              } else if (dr < 0.19) {
                data[x + z * CHUNK_SIZE + targetY * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.RED_FLOWER;
              } else {
                data[x + z * CHUNK_SIZE + targetY * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.YELLOW_FLOWER;
              }
            }
          }
        }

        // Tree placement (symmetrical full 3D canopy)
        const isForest = forestVal > 0.25 && biomeVal > -0.25 && biomeVal < 0.38;
        const isPlains = !isForest && surfaceBlock === BLOCKS.GRASS;
        const shouldSpawnTree = (isForest && dr > 0.82) || (isPlains && dr > 0.982);

        if (surfaceBlock === BLOCKS.GRASS && shouldSpawnTree && x >= 2 && x <= CHUNK_SIZE - 3 && z >= 2 && z <= CHUNK_SIZE - 3) {
          const treeHeight = 5 + (Math.floor(dr * 100) % 3);

          // 1. Trunk
          for (let ty = 1; ty <= treeHeight; ty++) {
            if (height + ty < CHUNK_HEIGHT) {
              data[x + z * CHUNK_SIZE + (height + ty) * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.OAK_LOG;
            }
          }

          // Helper to set leaf safely without replacing logs
          const setLeaf = (lx: number, ly: number, lz: number) => {
            if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly > height && ly < CHUNK_HEIGHT) {
              const lidx = lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE;
              if (data[lidx] === BLOCKS.AIR || data[lidx] === BLOCKS.TALL_GRASS || data[lidx] === BLOCKS.RED_FLOWER || data[lidx] === BLOCKS.YELLOW_FLOWER) {
                data[lidx] = BLOCKS.OAK_LEAVES;
              }
            }
          };

          // Top crown layer (+2 above trunk): 3x3 cross
          const topY = height + treeHeight + 2;
          setLeaf(x, topY, z);
          setLeaf(x - 1, topY, z);
          setLeaf(x + 1, topY, z);
          setLeaf(x, topY, z - 1);
          setLeaf(x, topY, z + 1);

          // Upper canopy layer (+1 above trunk): full 3x3
          const upperY = height + treeHeight + 1;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              setLeaf(x + dx, upperY, z + dz);
            }
          }

          // Main canopy layers (top of trunk y=top and y=-1): full 5x5 with rounded corners
          for (let layerOffset = 0; layerOffset >= -1; layerOffset--) {
            const layerY = height + treeHeight + layerOffset;
            for (let dx = -2; dx <= 2; dx++) {
              for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // Clip 4 corners
                setLeaf(x + dx, layerY, z + dz);
              }
            }
          }

          // Collar layer (-2 below top of trunk): full 3x3 around trunk
          const collarY = height + treeHeight - 2;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              setLeaf(x + dx, collarY, z + dz);
            }
          }
        }
      }
    }
  }
}
