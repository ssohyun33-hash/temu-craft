import { BLOCKS, ITEMS, BLOCK_DEFS, ITEM_DEFS } from './blocks';

// Cache for generated 64x64 data URLs
const iconCache = new Map<number, string>();

/**
 * Generates a high-quality 64x64 pixel-art Data URL for any Block or Item ID.
 */
export function getItemIcon64(id: number): string {
  if (iconCache.has(id)) {
    return iconCache.get(id)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;

  // Clear background (transparent)
  ctx.clearRect(0, 0, 64, 64);

  // Check if it's an Item or a Block
  if (id in ITEM_DEFS) {
    drawItem64(ctx, id);
  } else if (id in BLOCK_DEFS || id === BLOCKS.WATER) {
    drawBlockIsometric64(ctx, id);
  } else {
    // Default fallback square
    ctx.fillStyle = '#888888';
    ctx.fillRect(8, 8, 48, 48);
  }

  const dataUrl = canvas.toDataURL('image/png');
  iconCache.set(id, dataUrl);
  return dataUrl;
}

// Draw 64x64 Isometric 3D Voxel Cube for Blocks
function drawBlockIsometric64(ctx: CanvasRenderingContext2D, id: number) {
  // Isometric cube geometry centered in 64x64 canvas
  // Center top vertex at (32, 10)
  const cx = 32;
  const topY = 10;
  const sideW = 20; // horizontal width of side
  const sideH = 12; // vertical incline of top face
  const cubeH = 24; // height of cube sides

  const pTop = [cx, topY];
  const pRight = [cx + sideW, topY + sideH];
  const pBottom = [cx, topY + sideH * 2];
  const pLeft = [cx - sideW, topY + sideH];

  const pBottomRight = [cx + sideW, topY + sideH + cubeH];
  const pBottomCenter = [cx, topY + sideH * 2 + cubeH];
  const pBottomLeft = [cx - sideW, topY + sideH + cubeH];

  const colors = getBlockIsometricColors(id);

  // 1. Draw Top Face
  ctx.beginPath();
  ctx.moveTo(pTop[0], pTop[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.lineTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pLeft[0], pLeft[1]);
  ctx.closePath();
  ctx.fillStyle = colors.top;
  ctx.fill();

  // Top Face Pattern / Texture overlay
  drawTopTextureDetail(ctx, id, pTop, pRight, pBottom, pLeft);

  // 2. Draw Left Face (Medium Shaded)
  ctx.beginPath();
  ctx.moveTo(pLeft[0], pLeft[1]);
  ctx.lineTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pBottomCenter[0], pBottomCenter[1]);
  ctx.lineTo(pBottomLeft[0], pBottomLeft[1]);
  ctx.closePath();
  ctx.fillStyle = colors.left;
  ctx.fill();

  drawSideTextureDetail(ctx, id, 'left', pLeft, pBottom, pBottomCenter, pBottomLeft);

  // 3. Draw Right Face (Dark Shaded)
  ctx.beginPath();
  ctx.moveTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.lineTo(pBottomRight[0], pBottomRight[1]);
  ctx.lineTo(pBottomCenter[0], pBottomCenter[1]);
  ctx.closePath();
  ctx.fillStyle = colors.right;
  ctx.fill();

  drawSideTextureDetail(ctx, id, 'right', pBottom, pRight, pBottomRight, pBottomCenter);

  // 4. Cube Edges Outline (Dark Bevel)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Outer perimeter
  ctx.moveTo(pTop[0], pTop[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.lineTo(pBottomRight[0], pBottomRight[1]);
  ctx.lineTo(pBottomCenter[0], pBottomCenter[1]);
  ctx.lineTo(pBottomLeft[0], pBottomLeft[1]);
  ctx.lineTo(pLeft[0], pLeft[1]);
  ctx.closePath();
  ctx.stroke();

  // Inner Y-edges
  ctx.beginPath();
  ctx.moveTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pTop[0], pTop[1]);
  ctx.moveTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pLeft[0], pLeft[1]);
  ctx.moveTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pRight[0], pRight[1]);
  ctx.moveTo(pBottom[0], pBottom[1]);
  ctx.lineTo(pBottomCenter[0], pBottomCenter[1]);
  ctx.stroke();
}

function getBlockIsometricColors(id: number) {
  switch (id) {
    case BLOCKS.GRASS:
      return { top: '#579934', left: '#735237', right: '#593f2a' };
    case BLOCKS.SNOW_GRASS:
      return { top: '#f0f5fa', left: '#735237', right: '#593f2a' };
    case BLOCKS.DIRT:
      return { top: '#8a603c', left: '#735032', right: '#5e4027' };
    case BLOCKS.STONE:
      return { top: '#8a8a8a', left: '#737373', right: '#5c5c5c' };
    case BLOCKS.COBBLESTONE:
      return { top: '#787878', left: '#616161', right: '#4a4a4a' };
    case BLOCKS.SAND:
      return { top: '#ebd29b', left: '#d4bb83', right: '#ba9f68' };
    case BLOCKS.WATER:
      return { top: '#3b82f6', left: '#2563eb', right: '#1d4ed8' };
    case BLOCKS.OAK_LOG:
      return { top: '#ad8553', left: '#594027', right: '#422f1c' };
    case BLOCKS.OAK_PLANKS:
      return { top: '#b89058', left: '#9c7744', right: '#826134' };
    case BLOCKS.OAK_LEAVES:
      return { top: '#3e7826', left: '#31611d', right: '#264a17' };
    case BLOCKS.GLASS:
      return { top: 'rgba(186, 230, 253, 0.7)', left: 'rgba(125, 211, 252, 0.6)', right: 'rgba(56, 189, 248, 0.5)' };
    case BLOCKS.BRICKS:
      return { top: '#a34e3b', left: '#8a3f2e', right: '#6e3022' };
    case BLOCKS.COAL_ORE:
      return { top: '#7a7a7a', left: '#636363', right: '#4d4d4d' };
    case BLOCKS.IRON_ORE:
      return { top: '#998a7c', left: '#827468', right: '#6b5e53' };
    case BLOCKS.GOLD_ORE:
      return { top: '#a39870', left: '#8a805c', right: '#736a49' };
    case BLOCKS.DIAMOND_ORE:
      return { top: '#739996', left: '#5f827f', right: '#4a6966' };
    case BLOCKS.EMERALD_ORE:
      return { top: '#639973', left: '#52825f', right: '#3f694d' };
    case BLOCKS.FURNACE:
      return { top: '#6e6e6e', left: '#3a3a3a', right: '#545454' };
    case BLOCKS.CRAFTING_TABLE:
      return { top: '#b38247', left: '#73522c', right: '#5e4120' };
    case BLOCKS.BED:
      return { top: '#cc2929', left: '#e6e6e6', right: '#b32424' };
    case BLOCKS.TORCH:
      return { top: '#ffaa00', left: '#8a603c', right: '#614124' };
    case BLOCKS.RED_FLOWER:
      return { top: '#e62e2e', left: '#2d8a2d', right: '#216621' };
    case BLOCKS.YELLOW_FLOWER:
      return { top: '#f2cc24', left: '#2d8a2d', right: '#216621' };
    default:
      return { top: '#999999', left: '#808080', right: '#666666' };
  }
}

function drawTopTextureDetail(ctx: CanvasRenderingContext2D, id: number, pTop: number[], pRight: number[], pBottom: number[], pLeft: number[]) {
  if (id === BLOCKS.GRASS) {
    // Green grass specks
    ctx.fillStyle = '#6ab83b';
    ctx.fillRect(30, 16, 4, 3);
    ctx.fillRect(24, 20, 3, 3);
    ctx.fillRect(36, 18, 4, 2);
  } else if (id === BLOCKS.CRAFTING_TABLE) {
    // Grid lines on top of crafting table
    ctx.strokeStyle = '#593f21';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, 17); ctx.lineTo(38, 23);
    ctx.moveTo(38, 17); ctx.lineTo(26, 23);
    ctx.stroke();
  } else if (id === BLOCKS.FURNACE) {
    // Furnace top ring
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.arc(32, 22, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === BLOCKS.COAL_ORE || id === BLOCKS.IRON_ORE || id === BLOCKS.GOLD_ORE || id === BLOCKS.DIAMOND_ORE) {
    // Ore spots
    const oreColors: Record<number, string> = {
      [BLOCKS.COAL_ORE]: '#1a1a1a',
      [BLOCKS.IRON_ORE]: '#d6b38a',
      [BLOCKS.GOLD_ORE]: '#f5d438',
      [BLOCKS.DIAMOND_ORE]: '#4bf2e7',
    };
    ctx.fillStyle = oreColors[id] || '#ffffff';
    ctx.fillRect(28, 16, 4, 3);
    ctx.fillRect(34, 21, 3, 3);
  }
}

function drawSideTextureDetail(
  ctx: CanvasRenderingContext2D,
  id: number,
  side: 'left' | 'right',
  pA: number[],
  pB: number[],
  pC: number[],
  pD: number[]
) {
  if (id === BLOCKS.GRASS) {
    // Grass overhang on top of dirt side
    ctx.fillStyle = side === 'left' ? '#579934' : '#457a29';
    ctx.beginPath();
    ctx.moveTo(pA[0], pA[1]);
    ctx.lineTo(pB[0], pB[1]);
    ctx.lineTo(pB[0], pB[1] + 6);
    ctx.lineTo(pA[0], pA[1] + 8);
    ctx.closePath();
    ctx.fill();
  } else if (id === BLOCKS.FURNACE && side === 'right') {
    // Furnace front opening with fiery glow
    ctx.fillStyle = '#111111';
    ctx.fillRect(36, 28, 10, 12);
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(38, 34, 6, 4);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(40, 35, 2, 2);
  }
}

// Draw 64x64 Detailed Items & Tools
function drawItem64(ctx: CanvasRenderingContext2D, id: number) {
  const item = ITEM_DEFS[id];
  if (!item) return;

  if (item.isTool) {
    drawTool64(ctx, item.toolType!, item.toolTier!, item.iconColor);
    return;
  }

  switch (id) {
    case ITEMS.STICK:
      drawStick64(ctx);
      break;
    case ITEMS.IRON_INGOT:
    case ITEMS.GOLD_INGOT:
      drawIngot64(ctx, id === ITEMS.GOLD_INGOT ? '#ffd700' : '#e0e0e0', id === ITEMS.GOLD_INGOT ? '#b39700' : '#a8a8a8');
      break;
    case ITEMS.IRON_NUGGET:
    case ITEMS.GOLD_NUGGET:
      drawNuggets64(ctx, id === ITEMS.GOLD_NUGGET ? '#ffd700' : '#e0caa8');
      break;
    case ITEMS.DIAMOND_ITEM:
    case ITEMS.EMERALD_ITEM:
    case ITEMS.LAPIS_ITEM:
      drawGem64(ctx, item.iconColor);
      break;
    case ITEMS.REDSTONE_ITEM:
      drawRedstone64(ctx);
      break;
    case ITEMS.COAL_ITEM:
      drawCoal64(ctx);
      break;
    case ITEMS.APPLE:
      drawApple64(ctx);
      break;
    case ITEMS.RAW_PORKCHOP:
    case ITEMS.COOKED_PORKCHOP:
      drawMeat64(ctx, id === ITEMS.COOKED_PORKCHOP);
      break;
    case ITEMS.RAW_BEEF:
    case ITEMS.COOKED_BEEF:
      drawBeef64(ctx, id === ITEMS.COOKED_BEEF);
      break;
    case ITEMS.WHITE_WOOL_ITEM:
      drawWool64(ctx);
      break;
    default:
      // Generic item fallback
      drawGenericItem64(ctx, item.iconColor);
      break;
  }
}

// 1. Tool Renderer (Shovel, Pickaxe, Axe, Sword) in 64x64 diagonal orientation
function drawTool64(ctx: CanvasRenderingContext2D, toolType: string, tier: number, headColor: string) {
  // Diagonal Wooden Handle (Bottom-left to Top-right)
  ctx.strokeStyle = '#5c4028';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 50);
  ctx.lineTo(44, 20);
  ctx.stroke();

  // Handle core highlight
  ctx.strokeStyle = '#8a623c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, 49);
  ctx.lineTo(43, 21);
  ctx.stroke();

  // Head Shading Colors
  let strokeColor = '#222222';
  let highlightColor = '#ffffff';

  if (tier === 1) { // Wood
    strokeColor = '#3d2817';
    highlightColor = '#d9a36c';
  } else if (tier === 2) { // Stone
    strokeColor = '#333333';
    highlightColor = '#b5b5b5';
  } else if (tier === 3) { // Iron
    strokeColor = '#555555';
    highlightColor = '#ffffff';
  } else if (tier === 4) { // Diamond
    strokeColor = '#0b665e';
    highlightColor = '#a8ffff';
  }

  if (toolType === 'pickaxe') {
    // Pickaxe Curved Head at top-right
    ctx.fillStyle = headColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(26, 12);
    ctx.quadraticCurveTo(42, 14, 54, 28);
    ctx.lineTo(48, 32);
    ctx.quadraticCurveTo(38, 22, 28, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Specular Highlight
    ctx.fillStyle = highlightColor;
    ctx.fillRect(40, 16, 8, 3);
  } else if (toolType === 'axe') {
    // Axe Blade Head
    ctx.fillStyle = headColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(38, 12);
    ctx.lineTo(52, 16);
    ctx.lineTo(48, 36);
    ctx.lineTo(34, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sharp Edge Highlight
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(52, 16);
    ctx.lineTo(48, 36);
    ctx.stroke();
  } else if (toolType === 'shovel') {
    // Shovel Blade Head
    ctx.fillStyle = headColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(36, 12);
    ctx.lineTo(50, 22);
    ctx.lineTo(42, 34);
    ctx.lineTo(28, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center crease line
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(38, 18);
    ctx.lineTo(46, 26);
    ctx.stroke();
  } else if (toolType === 'sword') {
    // Sword Guard & Double Blade
    // Guard
    ctx.fillStyle = strokeColor;
    ctx.fillRect(24, 34, 12, 5);

    // Blade
    ctx.fillStyle = headColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(28, 32);
    ctx.lineTo(50, 10);
    ctx.lineTo(54, 14);
    ctx.lineTo(32, 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blade Specular Line
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 31);
    ctx.lineTo(51, 11);
    ctx.stroke();
  }
}

function drawStick64(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#5c4028';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 50);
  ctx.lineTo(50, 14);
  ctx.stroke();

  ctx.strokeStyle = '#8a623c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(15, 49);
  ctx.lineTo(49, 15);
  ctx.stroke();
}

function drawIngot64(ctx: CanvasRenderingContext2D, baseColor: string, shadowColor: string) {
  // 3D Metallic Bar
  ctx.fillStyle = shadowColor;
  ctx.fillRect(16, 24, 32, 20);

  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.moveTo(20, 20);
  ctx.lineTo(44, 20);
  ctx.lineTo(48, 28);
  ctx.lineTo(16, 28);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = baseColor;
  ctx.fillRect(16, 28, 32, 12);

  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 20, 32, 20);

  // Specular Reflection
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(22, 22, 16, 3);
}

function drawNuggets64(ctx: CanvasRenderingContext2D, color: string) {
  // 3 Metallic Nuggets Cluster
  const nuggets = [
    { x: 22, y: 32, r: 8 },
    { x: 38, y: 36, r: 7 },
    { x: 32, y: 22, r: 9 },
  ];

  for (const n of nuggets) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(n.x - 2, n.y - 4, 3, 3);
  }
}

function drawGem64(ctx: CanvasRenderingContext2D, color: string) {
  // Faceted Diamond / Emerald / Lapis Gem
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(32, 12);
  ctx.lineTo(48, 26);
  ctx.lineTo(32, 52);
  ctx.lineTo(16, 26);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner facets
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.moveTo(32, 12);
  ctx.lineTo(32, 52);
  ctx.lineTo(16, 26);
  ctx.closePath();
  ctx.fill();
}

function drawRedstone64(ctx: CanvasRenderingContext2D) {
  // Redstone Glowing Particles
  ctx.fillStyle = '#e60000';
  ctx.beginPath();
  ctx.arc(32, 32, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff6666';
  ctx.fillRect(28, 28, 8, 8);

  ctx.strokeStyle = '#990000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCoal64(ctx: CanvasRenderingContext2D) {
  // Rough Charcoal Chunk
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.moveTo(22, 18);
  ctx.lineTo(42, 14);
  ctx.lineTo(50, 32);
  ctx.lineTo(38, 48);
  ctx.lineTo(18, 42);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Facet highlights
  ctx.fillStyle = '#444444';
  ctx.fillRect(26, 22, 10, 8);
}

function drawApple64(ctx: CanvasRenderingContext2D) {
  // Red Apple
  ctx.fillStyle = '#e61919';
  ctx.beginPath();
  ctx.arc(26, 34, 12, 0, Math.PI * 2);
  ctx.arc(38, 34, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#800000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Stem & Leaf
  ctx.strokeStyle = '#5c4028';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(32, 22);
  ctx.lineTo(34, 14);
  ctx.stroke();

  ctx.fillStyle = '#47a329';
  ctx.fillRect(34, 14, 6, 4);

  // Specular shine
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(22, 28, 4, 4);
}

function drawMeat64(ctx: CanvasRenderingContext2D, isCooked: boolean) {
  ctx.fillStyle = isCooked ? '#a3472e' : '#f07373';
  ctx.beginPath();
  ctx.ellipse(32, 34, 16, 12, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isCooked ? '#5e2516' : '#a33b3b';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (isCooked) {
    // Grill seared marks
    ctx.strokeStyle = '#3d160c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 28); ctx.lineTo(36, 40);
    ctx.moveTo(28, 24); ctx.lineTo(40, 36);
    ctx.stroke();
  } else {
    // Fat marble strip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 30, 14, 3);
  }
}

function drawBeef64(ctx: CanvasRenderingContext2D, isCooked: boolean) {
  ctx.fillStyle = isCooked ? '#7a2c18' : '#b82323';
  ctx.fillRect(18, 22, 28, 20);

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 22, 28, 20);

  if (isCooked) {
    ctx.fillStyle = '#47180c';
    ctx.fillRect(22, 26, 20, 3);
    ctx.fillRect(22, 34, 20, 3);
  } else {
    ctx.fillStyle = '#f7dede';
    ctx.fillRect(20, 24, 8, 16);
  }
}

function drawWool64(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.arc(32, 32, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawGenericItem64(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(16, 16, 32, 32);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 32, 32);
}
