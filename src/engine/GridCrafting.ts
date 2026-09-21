import { BLOCKS, ITEMS } from './blocks';
import { ItemStack } from '../store/gameStore';

export interface GridRecipePattern {
  id: string;
  name: string;
  minGridSize?: number; // 3 for 3x3 table required
  pattern: (number | null)[][];
  result: ItemStack;
}

export const GRID_RECIPES: GridRecipePattern[] = [
  // 1. Oak Planks (x4) - 1 log
  {
    id: 'oak_planks',
    name: 'Oak Planks',
    pattern: [[BLOCKS.OAK_LOG]],
    result: { id: BLOCKS.OAK_PLANKS, count: 4 },
  },
  // 2. Sticks (x4) - 2 planks vertically
  {
    id: 'sticks',
    name: 'Sticks',
    pattern: [[BLOCKS.OAK_PLANKS], [BLOCKS.OAK_PLANKS]],
    result: { id: ITEMS.STICK, count: 4 },
  },
  // 3. Crafting Table - 4 planks in 2x2
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    pattern: [
      [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS],
      [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS],
    ],
    result: { id: BLOCKS.CRAFTING_TABLE, count: 1 },
  },
  // 4. Torch (x4) - 1 coal over 1 stick
  {
    id: 'torch_coal',
    name: 'Torches',
    pattern: [[ITEMS.COAL_ITEM], [ITEMS.STICK]],
    result: { id: BLOCKS.TORCH, count: 4 },
  },
  {
    id: 'torch_coal_ore',
    name: 'Torches',
    pattern: [[BLOCKS.COAL_ORE], [ITEMS.STICK]],
    result: { id: BLOCKS.TORCH, count: 4 },
  },
  // 5. Furnace - 8 cobblestone around 3x3 border
  {
    id: 'furnace',
    name: 'Furnace',
    minGridSize: 3,
    pattern: [
      [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],
      [BLOCKS.COBBLESTONE, null, BLOCKS.COBBLESTONE],
      [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],
    ],
    result: { id: BLOCKS.FURNACE, count: 1 },
  },
  // 6. Bed - 3 white wool on top of 3 oak planks
  {
    id: 'bed',
    name: 'Bed',
    minGridSize: 3,
    pattern: [
      [BLOCKS.WHITE_WOOL, BLOCKS.WHITE_WOOL, BLOCKS.WHITE_WOOL],
      [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS],
    ],
    result: { id: BLOCKS.BED, count: 1 },
  },

  // --- TOOLS: Wooden ---
  {
    id: 'wooden_shovel',
    name: 'Wooden Shovel',
    pattern: [[BLOCKS.OAK_PLANKS], [ITEMS.STICK], [ITEMS.STICK]],
    result: { id: ITEMS.WOODEN_SHOVEL, count: 1 },
  },
  {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    pattern: [[BLOCKS.OAK_PLANKS], [BLOCKS.OAK_PLANKS], [ITEMS.STICK]],
    result: { id: ITEMS.WOODEN_SWORD, count: 1 },
  },
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    minGridSize: 3,
    pattern: [
      [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS],
      [null, ITEMS.STICK, null],
      [null, ITEMS.STICK, null],
    ],
    result: { id: ITEMS.WOODEN_PICKAXE, count: 1 },
  },
  {
    id: 'wooden_axe_left',
    name: 'Wooden Axe',
    pattern: [
      [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS],
      [BLOCKS.OAK_PLANKS, ITEMS.STICK],
      [null, ITEMS.STICK],
    ],
    result: { id: ITEMS.WOODEN_AXE, count: 1 },
  },
  {
    id: 'wooden_axe_right',
    name: 'Wooden Axe',
    pattern: [
      [BLOCKS.OAK_PLANKS, BLOCKS.OAK_PLANKS],
      [ITEMS.STICK, BLOCKS.OAK_PLANKS],
      [ITEMS.STICK, null],
    ],
    result: { id: ITEMS.WOODEN_AXE, count: 1 },
  },

  // --- TOOLS: Stone ---
  {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    pattern: [[BLOCKS.COBBLESTONE], [ITEMS.STICK], [ITEMS.STICK]],
    result: { id: ITEMS.STONE_SHOVEL, count: 1 },
  },
  {
    id: 'stone_sword',
    name: 'Stone Sword',
    pattern: [[BLOCKS.COBBLESTONE], [BLOCKS.COBBLESTONE], [ITEMS.STICK]],
    result: { id: ITEMS.STONE_SWORD, count: 1 },
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    minGridSize: 3,
    pattern: [
      [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],
      [null, ITEMS.STICK, null],
      [null, ITEMS.STICK, null],
    ],
    result: { id: ITEMS.STONE_PICKAXE, count: 1 },
  },
  {
    id: 'stone_axe_left',
    name: 'Stone Axe',
    pattern: [
      [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],
      [BLOCKS.COBBLESTONE, ITEMS.STICK],
      [null, ITEMS.STICK],
    ],
    result: { id: ITEMS.STONE_AXE, count: 1 },
  },
  {
    id: 'stone_axe_right',
    name: 'Stone Axe',
    pattern: [
      [BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],
      [ITEMS.STICK, BLOCKS.COBBLESTONE],
      [ITEMS.STICK, null],
    ],
    result: { id: ITEMS.STONE_AXE, count: 1 },
  },

  // --- TOOLS: Iron (Iron Ingots MUST be smelted from Iron Ore in Furnace) ---
  {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    pattern: [[ITEMS.IRON_INGOT], [ITEMS.STICK], [ITEMS.STICK]],
    result: { id: ITEMS.IRON_SHOVEL, count: 1 },
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    pattern: [[ITEMS.IRON_INGOT], [ITEMS.IRON_INGOT], [ITEMS.STICK]],
    result: { id: ITEMS.IRON_SWORD, count: 1 },
  },
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    minGridSize: 3,
    pattern: [
      [ITEMS.IRON_INGOT, ITEMS.IRON_INGOT, ITEMS.IRON_INGOT],
      [null, ITEMS.STICK, null],
      [null, ITEMS.STICK, null],
    ],
    result: { id: ITEMS.IRON_PICKAXE, count: 1 },
  },
  {
    id: 'iron_axe_left',
    name: 'Iron Axe',
    pattern: [
      [ITEMS.IRON_INGOT, ITEMS.IRON_INGOT],
      [ITEMS.IRON_INGOT, ITEMS.STICK],
      [null, ITEMS.STICK],
    ],
    result: { id: ITEMS.IRON_AXE, count: 1 },
  },

  // --- TOOLS: Diamond ---
  {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    pattern: [[ITEMS.DIAMOND_ITEM], [ITEMS.STICK], [ITEMS.STICK]],
    result: { id: ITEMS.DIAMOND_SHOVEL, count: 1 },
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    pattern: [[ITEMS.DIAMOND_ITEM], [ITEMS.DIAMOND_ITEM], [ITEMS.STICK]],
    result: { id: ITEMS.DIAMOND_SWORD, count: 1 },
  },
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    minGridSize: 3,
    pattern: [
      [ITEMS.DIAMOND_ITEM, ITEMS.DIAMOND_ITEM, ITEMS.DIAMOND_ITEM],
      [null, ITEMS.STICK, null],
      [null, ITEMS.STICK, null],
    ],
    result: { id: ITEMS.DIAMOND_PICKAXE, count: 1 },
  },
  {
    id: 'diamond_axe_left',
    name: 'Diamond Axe',
    pattern: [
      [ITEMS.DIAMOND_ITEM, ITEMS.DIAMOND_ITEM],
      [ITEMS.DIAMOND_ITEM, ITEMS.STICK],
      [null, ITEMS.STICK],
    ],
    result: { id: ITEMS.DIAMOND_AXE, count: 1 },
  },
];

/**
 * Checks a 2D grid of item stacks against defined grid pattern shapes.
 * Returns the resulting ItemStack if a valid recipe matches, or null.
 */
export function evaluateGridCrafting(grid: (ItemStack | null)[][], maxGridSize: number): ItemStack | null {
  const rows = grid.length;
  const cols = grid[0].length;

  let minR = rows, maxR = -1;
  let minC = cols, maxC = -1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] && grid[r][c]!.count > 0) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (maxR === -1) return null; // empty grid

  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  const sub: (number | null)[][] = [];
  for (let r = 0; r < h; r++) {
    sub[r] = [];
    for (let c = 0; c < w; c++) {
      const cell = grid[minR + r][minC + c];
      sub[r][c] = (cell && cell.count > 0) ? cell.id : null;
    }
  }

  for (const recipe of GRID_RECIPES) {
    if (recipe.minGridSize && maxGridSize < recipe.minGridSize) continue;

    const pat = recipe.pattern;
    if (pat.length !== h || pat[0].length !== w) continue;

    let match = true;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (pat[r][c] !== sub[r][c]) {
          match = false;
          break;
        }
      }
      if (!match) break;
    }

    if (match) {
      return { ...recipe.result };
    }
  }

  return null;
}
