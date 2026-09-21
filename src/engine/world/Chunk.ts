import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, BLOCKS, BLOCK_DEFS, ATLAS_SIZE } from '../blocks';

export class Chunk {
  x: number;
  z: number;
  data: Uint8Array;
  opaqueMesh?: THREE.Mesh;
  waterMesh?: THREE.Mesh;
  isDirty: boolean = true;
  isGenerated: boolean = false;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  }

  getIndex(x: number, y: number, z: number) {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  getBlock(x: number, y: number, z: number) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BLOCKS.AIR;
    }
    return this.data[this.getIndex(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, blockId: number) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.data[this.getIndex(x, y, z)] = blockId;
    this.isDirty = true;
  }

  buildMesh(
    opaqueMat: THREE.Material,
    waterMat: THREE.Material,
    getNeighborBlock: (cx: number, cz: number, bx: number, by: number, bz: number) => number
  ) {
    // Opaque buffers
    const oPositions: number[] = [];
    const oNormals: number[] = [];
    const oUvs: number[] = [];
    const oColors: number[] = [];
    const oWindWeights: number[] = [];
    const oBlockTypes: number[] = [];
    const oIndices: number[] = [];
    let oIdxOffset = 0;

    // Water buffers
    const wPositions: number[] = [];
    const wNormals: number[] = [];
    const wUvs: number[] = [];
    const wIndices: number[] = [];
    let wIdxOffset = 0;

    const getBlockAt = (bx: number, by: number, bz: number) => {
      if (by < 0 || by >= CHUNK_HEIGHT) return BLOCKS.AIR;
      if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE) {
        return getNeighborBlock(this.x, this.z, bx, by, bz);
      }
      return this.getBlock(bx, by, bz);
    };

    // Ambient Occlusion calculation for 4 corners of a face
    const calculateAO = (side1: boolean, side2: boolean, corner: boolean) => {
      if (side1 && side2) return 0.55;
      const count = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
      return 1.0 - count * 0.15;
    };

    const isOpaque = (id: number) => {
      if (id === BLOCKS.AIR) return false;
      const def = BLOCK_DEFS[id];
      return !def?.isTransparent && !def?.isLiquid && !def?.isFoliage;
    };

    const addOpaqueFace = (x: number, y: number, z: number, blockId: number, faceIdx: number) => {
      const def = BLOCK_DEFS[blockId];
      if (!def) return;

      let tex = def.textures.side;
      if (faceIdx === 2) tex = def.textures.top;
      if (faceIdx === 3) tex = def.textures.bottom;

      // Half-texel inset (0.5 / 1024) to eliminate texture bleeding lines between blocks
      const uvInset = 0.5 / (ATLAS_SIZE * 64);
      const step = 1.0 / ATLAS_SIZE;
      const u = tex[0] / ATLAS_SIZE;
      const v = 1.0 - (tex[1] + 1) / ATLAS_SIZE;
      const u0 = u + uvInset;
      const u1 = u + step - uvInset;
      const v0 = v + uvInset;
      const v1 = v + step - uvInset;

      const px = x + this.x * CHUNK_SIZE;
      const py = y;
      const pz = z + this.z * CHUNK_SIZE;

      // Base AO calculations
      let ao = [1, 1, 1, 1];
      if (faceIdx === 2) { // Top (+Y)
        const sN = isOpaque(getBlockAt(x, y + 1, z - 1));
        const sS = isOpaque(getBlockAt(x, y + 1, z + 1));
        const sW = isOpaque(getBlockAt(x - 1, y + 1, z));
        const sE = isOpaque(getBlockAt(x + 1, y + 1, z));
        const cNW = isOpaque(getBlockAt(x - 1, y + 1, z - 1));
        const cNE = isOpaque(getBlockAt(x + 1, y + 1, z - 1));
        const cSW = isOpaque(getBlockAt(x - 1, y + 1, z + 1));
        const cSE = isOpaque(getBlockAt(x + 1, y + 1, z + 1));

        ao = [
          calculateAO(sW, sS, cSW),
          calculateAO(sE, sS, cSE),
          calculateAO(sW, sN, cNW),
          calculateAO(sE, sN, cNE),
        ];
      }

      if (faceIdx === 0) { // Right (+X)
        oPositions.push(px + 1, py + 1, pz + 1,  px + 1, py, pz + 1,  px + 1, py + 1, pz,  px + 1, py, pz);
        oNormals.push(1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0);
        oUvs.push(u0, v1,  u0, v0,  u1, v1,  u1, v0);
      } else if (faceIdx === 1) { // Left (-X)
        oPositions.push(px, py + 1, pz,  px, py, pz,  px, py + 1, pz + 1,  px, py, pz + 1);
        oNormals.push(-1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0);
        oUvs.push(u0, v1,  u0, v0,  u1, v1,  u1, v0);
      } else if (faceIdx === 2) { // Top (+Y)
        oPositions.push(px, py + 1, pz + 1,  px + 1, py + 1, pz + 1,  px, py + 1, pz,  px + 1, py + 1, pz);
        oNormals.push(0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0);
        oUvs.push(u0, v1,  u1, v1,  u0, v0,  u1, v0);
      } else if (faceIdx === 3) { // Bottom (-Y)
        oPositions.push(px, py, pz,  px + 1, py, pz,  px, py, pz + 1,  px + 1, py, pz + 1);
        oNormals.push(0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0);
        oUvs.push(u0, v0,  u1, v0,  u0, v1,  u1, v1);
      } else if (faceIdx === 4) { // Front (+Z)
        oPositions.push(px, py + 1, pz + 1,  px, py, pz + 1,  px + 1, py + 1, pz + 1,  px + 1, py, pz + 1);
        oNormals.push(0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1);
        oUvs.push(u0, v1,  u0, v0,  u1, v1,  u1, v0);
      } else if (faceIdx === 5) { // Back (-Z)
        oPositions.push(px + 1, py + 1, pz,  px + 1, py, pz,  px, py + 1, pz,  px, py, pz);
        oNormals.push(0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1);
        oUvs.push(u0, v1,  u0, v0,  u1, v1,  u1, v0);
      }

      // Solid terrain blocks stay 100% rigid and grounded
      const windWeight = blockId === BLOCKS.OAK_LEAVES ? 0.02 : 0.0;
      oWindWeights.push(windWeight, windWeight, windWeight, windWeight);

      // Block type for Real Life organic vertex sculpting:
      // 0 = Grass/Snow turf, 1 = Dirt/Soil, 2 = Stone/Rock/Bedrock, 3 = Sand,
      // 4 = Tree Trunk, 5 = Tree Leaves Canopy, 6 = Architectural (Planks/Bricks),
      // 7 = Ores/Crystals, 8 = Cactus, 9 = Foliage/Flora
      let blockType = 0.0;
      if (blockId === BLOCKS.GRASS || blockId === BLOCKS.SNOW_GRASS) blockType = 0.0;
      else if (blockId === BLOCKS.DIRT) blockType = 1.0;
      else if (blockId === BLOCKS.STONE || blockId === BLOCKS.COBBLESTONE || blockId === BLOCKS.BEDROCK) blockType = 2.0;
      else if (blockId === BLOCKS.SAND) blockType = 3.0;
      else if (blockId === BLOCKS.OAK_LOG) blockType = 4.0;
      else if (blockId === BLOCKS.OAK_LEAVES) blockType = 5.0;
      else if (blockId === BLOCKS.OAK_PLANKS || blockId === BLOCKS.BRICKS || blockId === BLOCKS.CRAFTING_TABLE || blockId === BLOCKS.FURNACE || blockId === BLOCKS.GLASS || blockId === BLOCKS.BED) blockType = 6.0;
      else if (blockId === BLOCKS.COAL_ORE || blockId === BLOCKS.IRON_ORE || blockId === BLOCKS.GOLD_ORE || blockId === BLOCKS.DIAMOND_ORE || blockId === BLOCKS.EMERALD_ORE || blockId === BLOCKS.LAPIS_ORE || blockId === BLOCKS.REDSTONE_ORE) blockType = 7.0;
      else if (blockId === BLOCKS.CACTUS) blockType = 8.0;
      else if (BLOCK_DEFS[blockId]?.isFoliage) blockType = 9.0;
      oBlockTypes.push(blockType, blockType, blockType, blockType);

      for (let i = 0; i < 4; i++) {
        const val = ao[i];
        oColors.push(val, val, val);
      }

      oIndices.push(
        oIdxOffset, oIdxOffset + 1, oIdxOffset + 2,
        oIdxOffset + 2, oIdxOffset + 1, oIdxOffset + 3
      );
      oIdxOffset += 4;
    };

    const addWaterFace = (x: number, y: number, z: number, faceIdx: number) => {
      const px = x + this.x * CHUNK_SIZE;
      const py = y;
      const pz = z + this.z * CHUNK_SIZE;
      const hasWaterAbove = getBlockAt(x, y + 1, z) === BLOCKS.WATER;
      const waterHeight = hasWaterAbove ? 1.0 : 0.9;

      if (faceIdx === 2) { // Top (+Y)
        wPositions.push(
          px, py + waterHeight, pz + 1,
          px + 1, py + waterHeight, pz + 1,
          px, py + waterHeight, pz,
          px + 1, py + waterHeight, pz
        );
        wNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      } else if (faceIdx === 3) { // Bottom (-Y)
        wPositions.push(
          px, py, pz,
          px + 1, py, pz,
          px, py, pz + 1,
          px + 1, py, pz + 1
        );
        wNormals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
      } else if (faceIdx === 0) { // Right (+X)
        wPositions.push(
          px + 1, py + waterHeight, pz + 1,
          px + 1, py, pz + 1,
          px + 1, py + waterHeight, pz,
          px + 1, py, pz
        );
        wNormals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
      } else if (faceIdx === 1) { // Left (-X)
        wPositions.push(
          px, py + waterHeight, pz,
          px, py, pz,
          px, py + waterHeight, pz + 1,
          px, py, pz + 1
        );
        wNormals.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
      } else if (faceIdx === 4) { // Front (+Z)
        wPositions.push(
          px, py + waterHeight, pz + 1,
          px, py, pz + 1,
          px + 1, py + waterHeight, pz + 1,
          px + 1, py, pz + 1
        );
        wNormals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
      } else if (faceIdx === 5) { // Back (-Z)
        wPositions.push(
          px + 1, py + waterHeight, pz,
          px + 1, py, pz,
          px, py + waterHeight, pz,
          px, py, pz
        );
        wNormals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
      } else {
        return;
      }

      wUvs.push(0, 1, 0, 0, 1, 1, 1, 0);
      wIndices.push(
        wIdxOffset, wIdxOffset + 1, wIdxOffset + 2,
        wIdxOffset + 2, wIdxOffset + 1, wIdxOffset + 3
      );
      wIdxOffset += 4;
    };

    // Cross billboard for flowers / foliage
    const addFoliage = (x: number, y: number, z: number, blockId: number) => {
      const def = BLOCK_DEFS[blockId];
      if (!def) return;
      const tex = def.textures.side;
      
      const uvInset = 0.5 / (ATLAS_SIZE * 64);
      const step = 1.0 / ATLAS_SIZE;
      const u = tex[0] / ATLAS_SIZE;
      const v = 1.0 - (tex[1] + 1) / ATLAS_SIZE;
      const u0 = u + uvInset;
      const u1 = u + step - uvInset;
      const v0 = v + uvInset;
      const v1 = v + step - uvInset;

      const px = x + this.x * CHUNK_SIZE;
      const py = y;
      const pz = z + this.z * CHUNK_SIZE;

      // Diagonal 1: Top vertices (1.0 wind), Bottom vertices (0.0 wind anchored)
      oPositions.push(
        px, py + 1, pz,
        px, py, pz,
        px + 1, py + 1, pz + 1,
        px + 1, py, pz + 1
      );
      oNormals.push(0.7, 0, 0.7, 0.7, 0, 0.7, 0.7, 0, 0.7, 0.7, 0, 0.7);
      oUvs.push(u0, v1, u0, v0, u1, v1, u1, v0);
      oColors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
      oWindWeights.push(1.0, 0.0, 1.0, 0.0);
      oBlockTypes.push(9.0, 9.0, 9.0, 9.0);
      oIndices.push(oIdxOffset, oIdxOffset + 1, oIdxOffset + 2, oIdxOffset + 2, oIdxOffset + 1, oIdxOffset + 3);
      oIdxOffset += 4;

      // Diagonal 2: Top vertices (1.0 wind), Bottom vertices (0.0 wind anchored)
      oPositions.push(
        px + 1, py + 1, pz,
        px + 1, py, pz,
        px, py + 1, pz + 1,
        px, py, pz + 1
      );
      oNormals.push(-0.7, 0, 0.7, -0.7, 0, 0.7, -0.7, 0, 0.7, -0.7, 0, 0.7);
      oUvs.push(u0, v1, u0, v0, u1, v1, u1, v0);
      oColors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
      oWindWeights.push(1.0, 0.0, 1.0, 0.0);
      oBlockTypes.push(9.0, 9.0, 9.0, 9.0);
      oIndices.push(oIdxOffset, oIdxOffset + 1, oIdxOffset + 2, oIdxOffset + 2, oIdxOffset + 1, oIdxOffset + 3);
      oIdxOffset += 4;
    };

    // Scan blocks
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const blockId = this.getBlock(x, y, z);
          if (blockId === BLOCKS.AIR) continue;

          const def = BLOCK_DEFS[blockId];
          if (def?.isFoliage) {
            addFoliage(x, y, z, blockId);
            continue;
          }

          if (blockId === BLOCKS.WATER) {
            const isWaterPassable = (bx: number, by: number, bz: number) => {
              const nb = getBlockAt(bx, by, bz);
              if (nb === BLOCKS.WATER) return false;
              const nbDef = BLOCK_DEFS[nb];
              return nb === BLOCKS.AIR || !!nbDef?.isFoliage || !!nbDef?.isTransparent;
            };

            // Check all 6 adjacent water faces
            if (isWaterPassable(x + 1, y, z)) addWaterFace(x, y, z, 0);
            if (isWaterPassable(x - 1, y, z)) addWaterFace(x, y, z, 1);
            if (isWaterPassable(x, y + 1, z)) addWaterFace(x, y, z, 2);
            if (isWaterPassable(x, y - 1, z)) addWaterFace(x, y, z, 3);
            if (isWaterPassable(x, y, z + 1)) addWaterFace(x, y, z, 4);
            if (isWaterPassable(x, y, z - 1)) addWaterFace(x, y, z, 5);
            continue;
          }

          // Solid blocks face culling
          const checkSolidFace = (dx: number, dy: number, dz: number, fIdx: number) => {
            const nb = getBlockAt(x + dx, y + dy, z + dz);
            if (nb === blockId && blockId === BLOCKS.OAK_LEAVES) {
              // Cull interior adjacent leaf faces for solid dense foliage canopy
              return;
            }
            const nbDef = BLOCK_DEFS[nb];
            if (nb === BLOCKS.AIR || nb === BLOCKS.WATER || (nbDef?.isTransparent && nb !== blockId) || nbDef?.isFoliage) {
              addOpaqueFace(x, y, z, blockId, fIdx);
            }
          };

          checkSolidFace(1, 0, 0, 0);
          checkSolidFace(-1, 0, 0, 1);
          checkSolidFace(0, 1, 0, 2);
          checkSolidFace(0, -1, 0, 3);
          checkSolidFace(0, 0, 1, 4);
          checkSolidFace(0, 0, -1, 5);
        }
      }
    }

    // Build Opaque Geometry
    if (oPositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(oPositions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(oNormals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(oUvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(oColors, 3));
      geo.setAttribute('aWind', new THREE.Float32BufferAttribute(oWindWeights, 1));
      geo.setAttribute('aBlockType', new THREE.Float32BufferAttribute(oBlockTypes, 1));
      geo.setIndex(oIndices);

      if (this.opaqueMesh) {
        this.opaqueMesh.geometry.dispose();
        this.opaqueMesh.geometry = geo;
      } else {
        this.opaqueMesh = new THREE.Mesh(geo, opaqueMat);
        this.opaqueMesh.castShadow = true;
        this.opaqueMesh.receiveShadow = true;
        this.opaqueMesh.frustumCulled = true;
      }
    } else if (this.opaqueMesh) {
      this.opaqueMesh.geometry.dispose();
      this.opaqueMesh = undefined;
    }

    // Build Water Geometry
    if (wPositions.length > 0) {
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPositions, 3));
      wGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wNormals, 3));
      wGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUvs, 2));
      wGeo.setIndex(wIndices);

      if (this.waterMesh) {
        this.waterMesh.geometry.dispose();
        this.waterMesh.geometry = wGeo;
      } else {
        this.waterMesh = new THREE.Mesh(wGeo, waterMat);
        this.waterMesh.receiveShadow = true;
        this.waterMesh.frustumCulled = true;
      }
    } else if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh = undefined;
    }

    this.isDirty = false;
  }

  dispose(scene: THREE.Scene) {
    if (this.opaqueMesh) {
      scene.remove(this.opaqueMesh);
      this.opaqueMesh.geometry.dispose();
      this.opaqueMesh = undefined;
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = undefined;
    }
  }
}
