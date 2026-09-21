import * as THREE from 'three';
import { ATLAS_SIZE } from './blocks';

export const TEXTURE_TILE_SIZE = 128; // Ultra-Realistic 128x128 per block face (2048x2048 Total Atlas)

export interface TextureAtlasSet {
  opaqueTexture: THREE.Texture;
  normalTexture: THREE.Texture;
  roughnessTexture: THREE.Texture;
  waterTexture: THREE.Texture;
  waterNormalTexture: THREE.Texture;
}

export function generateTextureAtlas(): TextureAtlasSet {
  const size = ATLAS_SIZE * TEXTURE_TILE_SIZE; // 1024 x 1024
  
  // 1. Albedo Canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;

  // 2. Roughness Canvas
  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rctx = rCanvas.getContext('2d', { willReadFrequently: true })!;
  rctx.fillStyle = '#f5f5f5'; // default roughness ~0.96 (matte, realistic terrain)
  rctx.fillRect(0, 0, size, size);

  // Helper to draw rich procedural tile
  const drawTile = (
    col: number,
    row: number,
    baseHex: string,
    roughnessHex: string,
    painter: (c: CanvasRenderingContext2D, rc: CanvasRenderingContext2D, ox: number, oy: number) => void
  ) => {
    const ox = col * TEXTURE_TILE_SIZE;
    const oy = row * TEXTURE_TILE_SIZE;

    ctx.fillStyle = baseHex;
    ctx.fillRect(ox, oy, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);

    rctx.fillStyle = roughnessHex;
    rctx.fillRect(ox, oy, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);

    painter(ctx, rctx, ox, oy);
  };

  // High-Resolution Sub-pixel Noise & Micro-Texture Generator
  const addMicroNoise = (
    c: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    palette: { chance: number; color: string }[],
    pixelScale: number = 2
  ) => {
    for (let y = 0; y < TEXTURE_TILE_SIZE; y += pixelScale) {
      for (let x = 0; x < TEXTURE_TILE_SIZE; x += pixelScale) {
        const r = Math.random();
        let accum = 0;
        for (const p of palette) {
          accum += p.chance;
          if (r < accum) {
            c.fillStyle = p.color;
            c.fillRect(ox + x, oy + y, pixelScale, pixelScale);
            break;
          }
        }
      }
    }
  };

  // -------------------------------------------------------------
  // ROW 0: Basic Terrain & Structural Materials (64x64 HD)
  // -------------------------------------------------------------

  // (0, 0) Grass Top
  drawTile(0, 0, '#4a822b', '#f8f8f8', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.28, color: '#579934' },
      { chance: 0.24, color: '#3d6e22' },
      { chance: 0.16, color: '#68ab3e' },
      { chance: 0.12, color: '#32591a' },
      { chance: 0.06, color: '#74bf43' },
    ], 2);

    // Fine organic grass blade details
    c.fillStyle = '#68b53d';
    for (let i = 0; i < 40; i++) {
      const gx = ox + Math.floor(Math.random() * (TEXTURE_TILE_SIZE - 2));
      const gy = oy + Math.floor(Math.random() * (TEXTURE_TILE_SIZE - 4));
      c.fillRect(gx, gy, 1, 3);
      c.fillRect(gx + 1, gy + 1, 1, 2);
    }
  });

  // (1, 0) Grass Side
  drawTile(1, 0, '#69472d', '#f2f2f2', (c, rc, ox, oy) => {
    // Dirt base
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#573a24' },
      { chance: 0.22, color: '#785335' },
      { chance: 0.14, color: '#452c1a' },
      { chance: 0.08, color: '#875f3c' },
    ], 2);

    // Rich grass overhang with natural roots
    c.fillStyle = '#4a822b';
    c.fillRect(ox, oy, TEXTURE_TILE_SIZE, 12);
    for (let x = 0; x < TEXTURE_TILE_SIZE; x += 2) {
      const drop = 8 + Math.floor((Math.sin(x * 0.45) + Math.cos(x * 0.8) + 2) * 5);
      c.fillRect(ox + x, oy, 2, drop);
      c.fillStyle = '#68ab3e';
      c.fillRect(ox + x, oy + drop - 2, 2, 2);
      c.fillStyle = '#4a822b';
    }
  });

  // (2, 0) Dirt
  drawTile(2, 0, '#69472d', '#f5f5f5', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#573a24' },
      { chance: 0.22, color: '#7a5436' },
      { chance: 0.14, color: '#452c1a' },
      { chance: 0.08, color: '#8a603e' },
      { chance: 0.04, color: '#3b2414' },
    ], 2);
  });

  // (3, 0) Stone
  drawTile(3, 0, '#6e6e6e', '#d8d8d8', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.28, color: '#7a7a7a' },
      { chance: 0.22, color: '#5e5e5e' },
      { chance: 0.14, color: '#4d4d4d' },
      { chance: 0.10, color: '#878787' },
      { chance: 0.06, color: '#3d3d3d' },
    ], 2);

    // Natural stone cracks and fissures
    c.strokeStyle = '#3a3a3a';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(ox + 8, oy + 12);
    c.lineTo(ox + 24, oy + 18);
    c.lineTo(ox + 38, oy + 14);
    c.lineTo(ox + 52, oy + 28);
    c.stroke();

    c.beginPath();
    c.moveTo(ox + 16, oy + 42);
    c.lineTo(ox + 32, oy + 48);
    c.lineTo(ox + 48, oy + 44);
    c.stroke();
  });

  // (4, 0) Cobblestone
  drawTile(4, 0, '#5e5e5e', '#949494', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.28, color: '#4d4d4d' },
      { chance: 0.24, color: '#707070' },
      { chance: 0.14, color: '#3b3b3b' },
    ], 2);

    // Deep mortar lines between stones
    c.strokeStyle = '#2b2b2b';
    c.lineWidth = 2;
    c.strokeRect(ox + 4, oy + 4, 24, 20);
    c.strokeRect(ox + 32, oy + 6, 28, 18);
    c.strokeRect(ox + 10, oy + 28, 36, 26);
    c.strokeRect(ox + 48, oy + 28, 14, 30);
  });

  // (5, 0) Sand
  drawTile(5, 0, '#d6c487', '#c4c4c4', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#e0d092' },
      { chance: 0.22, color: '#c4b274' },
      { chance: 0.14, color: '#b5a365' },
      { chance: 0.08, color: '#ebdca2' },
      { chance: 0.04, color: '#a69456' },
    ], 2);
  });

  // (6, 0) Water Atlas Reference
  drawTile(6, 0, '#245ec7', '#151515', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.30, color: '#316ee0' },
      { chance: 0.25, color: '#1a4da8' },
      { chance: 0.12, color: '#4d88ff' },
    ], 2);
  });

  // (7, 0) Oak Log Top
  drawTile(7, 0, '#9c7746', '#949494', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.22, color: '#8c6738' },
      { chance: 0.20, color: '#ad8754' },
    ], 2);

    // Natural multi-concentric growth rings
    c.lineWidth = 2;
    c.strokeStyle = '#6b4c24';
    c.strokeRect(ox + 8, oy + 8, TEXTURE_TILE_SIZE - 16, TEXTURE_TILE_SIZE - 16);
    c.strokeStyle = '#573c1a';
    c.strokeRect(ox + 18, oy + 18, TEXTURE_TILE_SIZE - 36, TEXTURE_TILE_SIZE - 36);
    c.strokeStyle = '#472f12';
    c.strokeRect(ox + 26, oy + 26, TEXTURE_TILE_SIZE - 52, TEXTURE_TILE_SIZE - 52);
    
    // Core pith
    c.fillStyle = '#382209';
    c.fillRect(ox + 29, oy + 29, 6, 6);

    // Outer bark rim
    c.strokeStyle = '#331e08';
    c.lineWidth = 4;
    c.strokeRect(ox + 2, oy + 2, TEXTURE_TILE_SIZE - 4, TEXTURE_TILE_SIZE - 4);
  });

  // (8, 0) Oak Log Side
  drawTile(8, 0, '#52381b', '#9e9e9e', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#402911' },
      { chance: 0.22, color: '#634524' },
      { chance: 0.12, color: '#331e0a' },
    ], 2);

    // Vertical textured bark grooves
    c.fillStyle = '#331d08';
    c.fillRect(ox + 10, oy, 4, TEXTURE_TILE_SIZE);
    c.fillRect(ox + 28, oy, 5, TEXTURE_TILE_SIZE);
    c.fillRect(ox + 48, oy, 4, TEXTURE_TILE_SIZE);

    c.fillStyle = '#7a5732';
    c.fillRect(ox + 14, oy, 2, TEXTURE_TILE_SIZE);
    c.fillRect(ox + 33, oy, 2, TEXTURE_TILE_SIZE);
    c.fillRect(ox + 52, oy, 2, TEXTURE_TILE_SIZE);
  });

  // (9, 0) Oak Leaves (Realistic Canopy Foliage with Cutouts & Leaf Clusters)
  ctx.clearRect(9 * TEXTURE_TILE_SIZE, 0, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  rctx.fillStyle = '#9e9e9e'; // Organic matte leaf roughness
  rctx.fillRect(9 * TEXTURE_TILE_SIZE, 0, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);

  const lox = 9 * TEXTURE_TILE_SIZE;
  const loy = 0;

  // Background deep forest canopy base
  ctx.fillStyle = '#1e4712';
  ctx.fillRect(lox, loy, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);

  // Organic leaf clusters with distinct botanical shapes & canopy gaps
  const leafColors = ['#285e18', '#387d22', '#4b9e2f', '#61bf3c', '#173b0d'];
  for (let ly = 0; ly < TEXTURE_TILE_SIZE; ly += 4) {
    for (let lx = 0; lx < TEXTURE_TILE_SIZE; lx += 4) {
      const seed = Math.sin(lx * 12.9898 + ly * 78.233) * 43758.5453;
      const r = seed - Math.floor(seed);
      if (r < 0.14) {
        // Natural foliage aperture cutout / sky gap for realistic translucent canopy
        ctx.clearRect(lox + lx, loy + ly, 4, 4);
        rctx.clearRect(lox + lx, loy + ly, 4, 4);
      } else if (r < 0.38) {
        ctx.fillStyle = leafColors[0];
        ctx.fillRect(lox + lx, loy + ly, 4, 4);
      } else if (r < 0.65) {
        ctx.fillStyle = leafColors[1];
        ctx.fillRect(lox + lx, loy + ly, 4, 4);
      } else if (r < 0.88) {
        ctx.fillStyle = leafColors[2];
        ctx.fillRect(lox + lx, loy + ly, 4, 4);
      } else {
        ctx.fillStyle = leafColors[3];
        ctx.fillRect(lox + lx, loy + ly, 4, 4);
      }
    }
  }

  // Botanical leaf vein structures & sun-dappled foliage highlights
  ctx.fillStyle = '#122e0a';
  for (let i = 4; i < TEXTURE_TILE_SIZE; i += 12) {
    ctx.fillRect(lox + i, loy + (i % 8), 2, 8);
    ctx.fillRect(lox + (i % 8), loy + i, 8, 2);
  }
  ctx.fillStyle = '#78e048';
  for (let i = 6; i < TEXTURE_TILE_SIZE; i += 10) {
    ctx.fillRect(lox + i, loy + (i % 12), 3, 2);
  }

  // (10, 0) Oak Planks
  drawTile(10, 0, '#a87f4a', '#8a8a8a', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.22, color: '#b58c54' },
      { chance: 0.20, color: '#99703d' },
    ], 2);

    // 4 Horizontal plank bevels
    c.fillStyle = '#5c3e1b';
    c.fillRect(ox, oy + 15, TEXTURE_TILE_SIZE, 2);
    c.fillRect(ox, oy + 31, TEXTURE_TILE_SIZE, 2);
    c.fillRect(ox, oy + 47, TEXTURE_TILE_SIZE, 2);
    c.fillRect(ox, oy + 63, TEXTURE_TILE_SIZE, 1);

    // Vertical plank joints & nails
    c.fillRect(ox + 22, oy, 2, 15);
    c.fillRect(ox + 44, oy + 16, 2, 15);
    c.fillRect(ox + 16, oy + 32, 2, 15);
    c.fillRect(ox + 50, oy + 48, 2, 15);

    // Iron nails
    c.fillStyle = '#291b0c';
    c.fillRect(ox + 4, oy + 7, 2, 2);
    c.fillRect(ox + 18, oy + 7, 2, 2);
    c.fillRect(ox + 26, oy + 23, 2, 2);
    c.fillRect(ox + 40, oy + 23, 2, 2);
  });

  // (11, 0) Crafting Table Top
  drawTile(11, 0, '#9c713a', '#858585', (c, rc, ox, oy) => {
    c.fillStyle = '#52381a';
    c.fillRect(ox + 4, oy + 4, TEXTURE_TILE_SIZE - 8, TEXTURE_TILE_SIZE - 8);
    c.fillStyle = '#ab8048';
    c.fillRect(ox + 8, oy + 8, TEXTURE_TILE_SIZE - 16, TEXTURE_TILE_SIZE - 16);

    // 3x3 crafting grid
    c.fillStyle = '#3d250d';
    c.fillRect(ox + 22, oy + 8, 2, TEXTURE_TILE_SIZE - 16);
    c.fillRect(ox + 40, oy + 8, 2, TEXTURE_TILE_SIZE - 16);
    c.fillRect(ox + 8, oy + 22, TEXTURE_TILE_SIZE - 16, 2);
    c.fillRect(ox + 8, oy + 40, TEXTURE_TILE_SIZE - 16, 2);
  });

  // (12, 0) Crafting Table Side
  drawTile(12, 0, '#ab8048', '#8a8a8a', (c, rc, ox, oy) => {
    c.fillStyle = '#5c3e1b';
    c.fillRect(ox, oy + 16, TEXTURE_TILE_SIZE, 3);
    c.fillRect(ox, oy + 44, TEXTURE_TILE_SIZE, 3);

    // Hanging tools (saw & pliers)
    c.fillStyle = '#333333';
    c.fillRect(ox + 12, oy + 12, 8, 28);
    c.fillStyle = '#d1d1d1';
    c.fillRect(ox + 36, oy + 10, 12, 32);
    c.fillRect(ox + 40, oy + 6, 4, 8);
  });

  // (13, 0) Glass
  ctx.clearRect(13 * TEXTURE_TILE_SIZE, 0, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  ctx.fillStyle = 'rgba(215, 245, 255, 0.32)';
  ctx.fillRect(13 * TEXTURE_TILE_SIZE, 0, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(13 * TEXTURE_TILE_SIZE, 0, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);

  // High-sheen glass diagonal specular streaks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(13 * TEXTURE_TILE_SIZE + 8, 8, 14, 3);
  ctx.fillRect(13 * TEXTURE_TILE_SIZE + 12, 12, 14, 3);
  ctx.fillRect(13 * TEXTURE_TILE_SIZE + 36, 36, 16, 3);
  rctx.fillStyle = '#0a0a0a'; // Glass ultra smooth
  rctx.fillRect(13 * TEXTURE_TILE_SIZE, 0, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);

  // (14, 0) Bricks
  drawTile(14, 0, '#9c4531', '#949494', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#ad503b' },
      { chance: 0.22, color: '#873926' },
      { chance: 0.12, color: '#732e1d' },
    ], 2);

    // Mortar lines
    c.fillStyle = '#d6d3ce';
    c.fillRect(ox, oy + 14, TEXTURE_TILE_SIZE, 3);
    c.fillRect(ox, oy + 30, TEXTURE_TILE_SIZE, 3);
    c.fillRect(ox, oy + 46, TEXTURE_TILE_SIZE, 3);
    c.fillRect(ox, oy + 62, TEXTURE_TILE_SIZE, 2);

    c.fillRect(ox + 30, oy, 3, 14);
    c.fillRect(ox + 14, oy + 17, 3, 13);
    c.fillRect(ox + 46, oy + 17, 3, 13);
    c.fillRect(ox + 30, oy + 33, 3, 13);
    c.fillRect(ox + 14, oy + 49, 3, 13);
  });

  // (15, 0) Bedrock
  drawTile(15, 0, '#1c1c1c', '#4d4d4d', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.35, color: '#0a0a0a' },
      { chance: 0.25, color: '#333333' },
      { chance: 0.15, color: '#454545' },
    ], 2);
  });

  // -------------------------------------------------------------
  // ROW 1: Ores, Gems, Wool & Bed (64x64 HD)
  // -------------------------------------------------------------

  const drawHDOre = (
    col: number,
    row: number,
    crystalHex: string,
    highlightHex: string,
    shadowHex: string,
    roughHex: string,
    isMetal: boolean = false
  ) => {
    drawTile(col, row, '#6e6e6e', '#808080', (c, rc, ox, oy) => {
      // Stone background
      addMicroNoise(c, ox, oy, [
        { chance: 0.28, color: '#7a7a7a' },
        { chance: 0.22, color: '#5e5e5e' },
        { chance: 0.14, color: '#4d4d4d' },
      ], 2);

      // Faceted gemstone clusters with highlights and depth shadows
      const clusters = [
        { x: 10, y: 10, w: 14, h: 14 },
        { x: 36, y: 12, w: 16, h: 14 },
        { x: 14, y: 38, w: 16, h: 16 },
        { x: 40, y: 40, w: 14, h: 14 },
      ];

      for (const cl of clusters) {
        // Deep shadow
        c.fillStyle = shadowHex;
        c.fillRect(ox + cl.x, oy + cl.y, cl.w, cl.h);

        // Core crystal body
        c.fillStyle = crystalHex;
        c.fillRect(ox + cl.x + 2, oy + cl.y + 2, cl.w - 4, cl.h - 4);

        // Specular highlight facet
        c.fillStyle = highlightHex;
        c.fillRect(ox + cl.x + 3, oy + cl.y + 3, Math.max(2, Math.floor(cl.w * 0.4)), Math.max(2, Math.floor(cl.h * 0.4)));

        // Roughness map (smooth crystal / metallic specular reflection)
        rc.fillStyle = roughHex;
        rc.fillRect(ox + cl.x, oy + cl.y, cl.w, cl.h);
      }
    });
  };

  // (0, 1) Coal Ore
  drawHDOre(0, 1, '#242424', '#474747', '#121212', '#303030');

  // (1, 1) Iron Ore
  drawHDOre(1, 1, '#d1b08e', '#f2e5d5', '#8f6f4f', '#252525', true);

  // (2, 1) Gold Ore
  drawHDOre(2, 1, '#f7c520', '#fff385', '#b38600', '#101010', true);

  // (3, 1) Diamond Ore
  drawHDOre(3, 1, '#33e8db', '#c2fffb', '#178a81', '#080808');

  // (4, 1) Emerald Ore
  drawHDOre(4, 1, '#16c952', '#7effad', '#0a6928', '#080808');

  // (5, 1) Lapis Lazuli Ore
  drawHDOre(5, 1, '#184ec7', '#6395ff', '#0b266e', '#181818');

  // (6, 1) Redstone Ore
  drawHDOre(6, 1, '#db1616', '#ff7373', '#780808', '#141414');

  // (7, 1) White Wool
  drawTile(7, 1, '#ebe8e1', '#d6d6d6', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.30, color: '#f5f4ed' },
      { chance: 0.25, color: '#dedad0' },
      { chance: 0.14, color: '#c7c2b5' },
      { chance: 0.08, color: '#ffffff' },
    ], 2);
  });

  // (8, 1) Bed Top
  drawTile(8, 1, '#bd1e1e', '#adadad', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#cf2727' },
      { chance: 0.22, color: '#a31515' },
    ], 2);
    // White pillow
    c.fillStyle = '#f5f5f5';
    c.fillRect(ox + 8, oy + 6, TEXTURE_TILE_SIZE - 16, 18);
    c.fillStyle = '#dedede';
    c.fillRect(ox + 8, oy + 20, TEXTURE_TILE_SIZE - 16, 4);
  });

  // (9, 1) Bed Side
  drawTile(9, 1, '#ab8048', '#8a8a8a', (c, rc, ox, oy) => {
    c.fillStyle = '#63431d';
    c.fillRect(ox, oy + 40, TEXTURE_TILE_SIZE, 24);
    c.fillStyle = '#422a10';
    c.fillRect(ox + 4, oy + 48, 12, 16);
    c.fillRect(ox + TEXTURE_TILE_SIZE - 16, oy + 48, 12, 16);
    c.fillStyle = '#bd1e1e';
    c.fillRect(ox, oy + 16, TEXTURE_TILE_SIZE, 24);
    c.fillStyle = '#f0f0f0';
    c.fillRect(ox, oy + 16, 16, 24);
  });

  // (10, 1) Snow Top
  drawTile(10, 1, '#f2f7fa', '#c7c7c7', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.30, color: '#ffffff' },
      { chance: 0.22, color: '#e4edf5' },
      { chance: 0.12, color: '#d0e0ed' },
    ], 2);
  });

  // (11, 1) Snow Side
  drawTile(11, 1, '#69472d', '#9e9e9e', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#573a24' },
      { chance: 0.22, color: '#785335' },
    ], 2);
    c.fillStyle = '#f2f7fa';
    c.fillRect(ox, oy, TEXTURE_TILE_SIZE, 16);
    for (let x = 0; x < TEXTURE_TILE_SIZE; x += 2) {
      const drop = 12 + Math.floor((Math.sin(x * 0.35) + 1) * 6);
      c.fillRect(ox + x, oy, 2, drop);
    }
  });

  // (12, 1) Cactus Top
  drawTile(12, 1, '#186618', '#8a8a8a', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.26, color: '#227a22' },
      { chance: 0.20, color: '#104d10' },
    ], 2);
  });

  // (13, 1) Cactus Side
  drawTile(13, 1, '#186618', '#8a8a8a', (c, rc, ox, oy) => {
    addMicroNoise(c, ox, oy, [
      { chance: 0.20, color: '#227a22' },
    ], 2);
    c.fillStyle = '#0d420d';
    c.fillRect(ox + 14, oy, 6, TEXTURE_TILE_SIZE);
    c.fillRect(ox + 32, oy, 6, TEXTURE_TILE_SIZE);
    c.fillRect(ox + 50, oy, 6, TEXTURE_TILE_SIZE);

    c.fillStyle = '#d9f0b4';
    for (let y = 6; y < TEXTURE_TILE_SIZE; y += 14) {
      c.fillRect(ox + 8, oy + y, 4, 4);
      c.fillRect(ox + 26, oy + y + 6, 4, 4);
      c.fillRect(ox + 44, oy + y + 2, 4, 4);
    }
  });

  // (14, 1) Poppy Flower
  ctx.clearRect(14 * TEXTURE_TILE_SIZE, 1 * TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  ctx.fillStyle = '#33801f';
  // Green stem all the way to the bottom of the tile (TEXTURE_TILE_SIZE = 128)
  ctx.fillRect(14 * TEXTURE_TILE_SIZE + 56, 1 * TEXTURE_TILE_SIZE + 40, 16, TEXTURE_TILE_SIZE - 40);
  ctx.fillRect(14 * TEXTURE_TILE_SIZE + 40, 1 * TEXTURE_TILE_SIZE + 72, 48, 8);
  ctx.fillStyle = '#d61a1a';
  ctx.fillRect(14 * TEXTURE_TILE_SIZE + 36, 1 * TEXTURE_TILE_SIZE + 16, 56, 52);
  ctx.fillStyle = '#ff4747';
  ctx.fillRect(14 * TEXTURE_TILE_SIZE + 44, 1 * TEXTURE_TILE_SIZE + 24, 40, 36);
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(14 * TEXTURE_TILE_SIZE + 56, 1 * TEXTURE_TILE_SIZE + 32, 16, 16);

  // (15, 1) Dandelion Yellow Flower
  ctx.clearRect(15 * TEXTURE_TILE_SIZE, 1 * TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  ctx.fillStyle = '#33801f';
  // Green stem all the way to the bottom of the tile
  ctx.fillRect(15 * TEXTURE_TILE_SIZE + 56, 1 * TEXTURE_TILE_SIZE + 48, 16, TEXTURE_TILE_SIZE - 48);
  ctx.fillStyle = '#e6b815';
  ctx.fillRect(15 * TEXTURE_TILE_SIZE + 36, 1 * TEXTURE_TILE_SIZE + 20, 56, 44);
  ctx.fillStyle = '#ffeb5c';
  ctx.fillRect(15 * TEXTURE_TILE_SIZE + 44, 1 * TEXTURE_TILE_SIZE + 28, 40, 28);

  // -------------------------------------------------------------
  // ROW 2: Torches & Items
  // -------------------------------------------------------------

  // (0, 2) Torch
  ctx.clearRect(0, 2 * TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  ctx.fillStyle = '#543819';
  ctx.fillRect(52, 2 * TEXTURE_TILE_SIZE + 48, 24, 80);
  ctx.fillStyle = '#171717';
  ctx.fillRect(44, 2 * TEXTURE_TILE_SIZE + 32, 40, 24);
  ctx.fillStyle = '#ff7300';
  ctx.fillRect(44, 2 * TEXTURE_TILE_SIZE + 8, 40, 32);
  ctx.fillStyle = '#ffff66';
  ctx.fillRect(52, 2 * TEXTURE_TILE_SIZE + 16, 24, 16);

  // (1, 2) Tall Grass / Standing Wild Grass Blades
  ctx.clearRect(1 * TEXTURE_TILE_SIZE, 2 * TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE, TEXTURE_TILE_SIZE);
  const gx = 1 * TEXTURE_TILE_SIZE;
  const gy = 2 * TEXTURE_TILE_SIZE;

  // Multiple natural grass stalks and blades extending to tile bottom
  const grassBlades = [
    { x: 20, y: 28, w: 8,  h: TEXTURE_TILE_SIZE - 28, color: '#3b7820', tip: '#5cb833' },
    { x: 32, y: 16, w: 10, h: TEXTURE_TILE_SIZE - 16, color: '#4a942a', tip: '#6dd43f' },
    { x: 46, y: 8,  w: 10, h: TEXTURE_TILE_SIZE - 8,  color: '#3d7a22', tip: '#5cb833' },
    { x: 60, y: 4,  w: 12, h: TEXTURE_TILE_SIZE - 4,  color: '#4da12b', tip: '#72e043' },
    { x: 76, y: 12, w: 10, h: TEXTURE_TILE_SIZE - 12, color: '#3d7a22', tip: '#5cb833' },
    { x: 90, y: 24, w: 10, h: TEXTURE_TILE_SIZE - 24, color: '#4a942a', tip: '#6dd43f' },
    { x: 104, y: 36, w: 8, h: TEXTURE_TILE_SIZE - 36, color: '#366e1e', tip: '#4fa82c' },
  ];

  for (const b of grassBlades) {
    ctx.fillStyle = b.color;
    ctx.fillRect(gx + b.x, gy + b.y, b.w, b.h);
    ctx.fillStyle = b.tip;
    ctx.fillRect(gx + b.x, gy + b.y, b.w, 16);
  }

  // -------------------------------------------------------------
  // 3. High-Precision Sobel Normal Map Generation (Tile-Clamped & Smooth)
  // -------------------------------------------------------------
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nctx = nCanvas.getContext('2d')!;

  const imgData = ctx.getImageData(0, 0, size, size);
  const nData = nctx.createImageData(size, size);
  const data = imgData.data;
  const nd = nData.data;

  // Helper to read luminance strictly clamped within the current 64x64 tile to avoid edge lines
  const getTileLuminance = (x: number, y: number, minX: number, maxX: number, minY: number, maxY: number) => {
    const cx = Math.max(minX, Math.min(maxX, x));
    const cy = Math.max(minY, Math.min(maxY, y));
    const idx = (cy * size + cx) * 4;
    return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
  };

  for (let y = 0; y < size; y++) {
    const tileRow = Math.floor(y / TEXTURE_TILE_SIZE);
    const minY = tileRow * TEXTURE_TILE_SIZE;
    const maxY = minY + TEXTURE_TILE_SIZE - 1;

    for (let x = 0; x < size; x++) {
      const tileCol = Math.floor(x / TEXTURE_TILE_SIZE);
      const minX = tileCol * TEXTURE_TILE_SIZE;
      const maxX = minX + TEXTURE_TILE_SIZE - 1;

      const idx = (y * size + x) * 4;

      const xLeft = getTileLuminance(x - 1, y, minX, maxX, minY, maxY);
      const xRight = getTileLuminance(x + 1, y, minX, maxX, minY, maxY);
      const yUp = getTileLuminance(x, y - 1, minX, maxX, minY, maxY);
      const yDown = getTileLuminance(x, y + 1, minX, maxX, minY, maxY);

      // Smooth organic gradient (scaled down to eliminate specular jitter/broken-screen artifacts)
      const dx = (xRight - xLeft) * 0.65;
      const dy = (yDown - yUp) * 0.65;

      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1.0 / len;

      nd[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }
  nctx.putImageData(nData, 0, 0);

  // Textures creation
  const opaqueTexture = new THREE.CanvasTexture(canvas);
  opaqueTexture.magFilter = THREE.NearestFilter;
  opaqueTexture.minFilter = THREE.NearestFilter;
  opaqueTexture.colorSpace = THREE.SRGBColorSpace;

  const normalTexture = new THREE.CanvasTexture(nCanvas);
  normalTexture.magFilter = THREE.NearestFilter;
  normalTexture.minFilter = THREE.NearestFilter;

  const roughnessTexture = new THREE.CanvasTexture(rCanvas);
  roughnessTexture.magFilter = THREE.NearestFilter;
  roughnessTexture.minFilter = THREE.NearestFilter;

  // -------------------------------------------------------------
  // 4. Realistic Water Textures (Albedo & Dual-Wave Normal Map)
  // -------------------------------------------------------------
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256;
  waterCanvas.height = 256;
  const wctx = waterCanvas.getContext('2d')!;
  const wGrad = wctx.createLinearGradient(0, 0, 256, 256);
  wGrad.addColorStop(0, '#1a5bc4');
  wGrad.addColorStop(0.5, '#2670ed');
  wGrad.addColorStop(1, '#114499');
  wctx.fillStyle = wGrad;
  wctx.fillRect(0, 0, 256, 256);

  const waterTexture = new THREE.CanvasTexture(waterCanvas);
  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.magFilter = THREE.LinearFilter;
  waterTexture.minFilter = THREE.LinearFilter;

  // Water Ripple Normal Map Canvas (for Real-time Screen-Space Reflection & wave refraction)
  const wnCanvas = document.createElement('canvas');
  wnCanvas.width = 256;
  wnCanvas.height = 256;
  const wnctx = wnCanvas.getContext('2d')!;
  const wnData = wnctx.createImageData(256, 256);
  const wnd = wnData.data;

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const waveX = Math.sin(x * 0.08) * Math.cos(y * 0.08);
      const waveY = Math.cos(x * 0.08) * Math.sin(y * 0.08);
      
      const nx = waveX * 0.3;
      const ny = waveY * 0.3;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      wnd[idx] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
      wnd[idx + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
      wnd[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
      wnd[idx + 3] = 255;
    }
  }
  wnctx.putImageData(wnData, 0, 0);

  const waterNormalTexture = new THREE.CanvasTexture(wnCanvas);
  waterNormalTexture.wrapS = THREE.RepeatWrapping;
  waterNormalTexture.wrapT = THREE.RepeatWrapping;
  waterNormalTexture.magFilter = THREE.LinearFilter;
  waterNormalTexture.minFilter = THREE.LinearFilter;

  return {
    opaqueTexture,
    normalTexture,
    roughnessTexture,
    waterTexture,
    waterNormalTexture,
  };
}
