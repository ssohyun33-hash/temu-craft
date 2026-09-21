export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 24;

export const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  WATER: 6,
  OAK_LOG: 7,
  OAK_LEAVES: 8,
  OAK_PLANKS: 9,
  CRAFTING_TABLE: 10,
  GLASS: 11,
  BRICKS: 12,
  BEDROCK: 13,
  COAL_ORE: 14,
  IRON_ORE: 15,
  GOLD_ORE: 16,
  DIAMOND_ORE: 17,
  EMERALD_ORE: 18,
  LAPIS_ORE: 19,
  REDSTONE_ORE: 20,
  WHITE_WOOL: 21,
  BED: 22,
  SNOW_GRASS: 23,
  CACTUS: 24,
  RED_FLOWER: 25,
  YELLOW_FLOWER: 26,
  TORCH: 27,
  TALL_GRASS: 28,
  FURNACE: 29,
};

export const ITEMS = {
  STICK: 101,
  WOODEN_SHOVEL: 102,
  WOODEN_PICKAXE: 103,
  WOODEN_AXE: 104,
  WOODEN_SWORD: 105,
  STONE_SHOVEL: 106,
  STONE_PICKAXE: 107,
  STONE_AXE: 108,
  STONE_SWORD: 109,
  IRON_INGOT: 110,
  IRON_SHOVEL: 111,
  IRON_PICKAXE: 112,
  IRON_AXE: 113,
  IRON_SWORD: 114,
  DIAMOND_ITEM: 115,
  DIAMOND_SHOVEL: 116,
  DIAMOND_PICKAXE: 117,
  DIAMOND_AXE: 118,
  DIAMOND_SWORD: 119,
  EMERALD_ITEM: 120,
  LAPIS_ITEM: 121,
  REDSTONE_ITEM: 122,
  COAL_ITEM: 123,
  RAW_PORKCHOP: 124,
  RAW_BEEF: 125,
  APPLE: 126,
  WHITE_WOOL_ITEM: 127,
  IRON_NUGGET: 128,
  GOLD_NUGGET: 129,
  GOLD_INGOT: 130,
  COOKED_PORKCHOP: 131,
  COOKED_BEEF: 132,
};

export type ToolType = 'shovel' | 'axe' | 'pickaxe' | 'sword' | 'none';

export interface BlockDefinition {
  id: number;
  name: string;
  isTransparent?: boolean;
  isLiquid?: boolean;
  isFoliage?: boolean;
  isSolid?: boolean;
  isBed?: boolean;
  lightLevel?: number;
  hardness: number; // Base break time in seconds with bare hands
  effectiveTool: ToolType;
  minToolTier?: number; // 0=hand, 1=wood, 2=stone, 3=iron, 4=diamond
  dropItem: number;
  dropCount?: number;
  textures: {
    top: [number, number];
    side: [number, number];
    bottom: [number, number];
  };
}

export interface ItemDefinition {
  id: number;
  name: string;
  isTool?: boolean;
  toolType?: ToolType;
  toolTier?: number; // 1=wood (x2.5), 2=stone (x4.5), 3=iron (x7.0), 4=diamond (x12.0)
  attackDamage?: number;
  isFood?: boolean;
  foodRestore?: number;
  healthRestore?: number;
  maxStack?: number;
  iconColor: string;
}

export const BLOCK_DEFS: Record<number, BlockDefinition> = {
  [BLOCKS.AIR]: {
    id: BLOCKS.AIR,
    name: 'Air',
    isTransparent: true,
    isSolid: false,
    hardness: 0,
    effectiveTool: 'none',
    dropItem: BLOCKS.AIR,
    textures: { top: [0, 0], side: [0, 0], bottom: [0, 0] }
  },
  [BLOCKS.GRASS]: {
    id: BLOCKS.GRASS,
    name: 'Grass Block',
    hardness: 0.6,
    effectiveTool: 'shovel',
    dropItem: BLOCKS.DIRT,
    textures: { top: [0, 0], side: [1, 0], bottom: [2, 0] }
  },
  [BLOCKS.DIRT]: {
    id: BLOCKS.DIRT,
    name: 'Dirt',
    hardness: 0.5,
    effectiveTool: 'shovel',
    dropItem: BLOCKS.DIRT,
    textures: { top: [2, 0], side: [2, 0], bottom: [2, 0] }
  },
  [BLOCKS.STONE]: {
    id: BLOCKS.STONE,
    name: 'Stone',
    hardness: 2.8,
    effectiveTool: 'pickaxe',
    minToolTier: 1,
    dropItem: BLOCKS.COBBLESTONE,
    textures: { top: [3, 0], side: [3, 0], bottom: [3, 0] }
  },
  [BLOCKS.COBBLESTONE]: {
    id: BLOCKS.COBBLESTONE,
    name: 'Cobblestone',
    hardness: 2.5,
    effectiveTool: 'pickaxe',
    minToolTier: 1,
    dropItem: BLOCKS.COBBLESTONE,
    textures: { top: [4, 0], side: [4, 0], bottom: [4, 0] }
  },
  [BLOCKS.SAND]: {
    id: BLOCKS.SAND,
    name: 'Sand',
    hardness: 0.5,
    effectiveTool: 'shovel',
    dropItem: BLOCKS.SAND,
    textures: { top: [5, 0], side: [5, 0], bottom: [5, 0] }
  },
  [BLOCKS.WATER]: {
    id: BLOCKS.WATER,
    name: 'Water',
    isLiquid: true,
    isTransparent: true,
    isSolid: false,
    hardness: 100,
    effectiveTool: 'none',
    dropItem: BLOCKS.AIR,
    textures: { top: [6, 0], side: [6, 0], bottom: [6, 0] }
  },
  [BLOCKS.OAK_LOG]: {
    id: BLOCKS.OAK_LOG,
    name: 'Oak Log (Wood)',
    hardness: 2.0,
    effectiveTool: 'axe',
    dropItem: BLOCKS.OAK_LOG,
    textures: { top: [7, 0], side: [8, 0], bottom: [7, 0] }
  },
  [BLOCKS.OAK_LEAVES]: {
    id: BLOCKS.OAK_LEAVES,
    name: 'Oak Leaves',
    isTransparent: true,
    isSolid: true,
    hardness: 0.2,
    effectiveTool: 'none',
    dropItem: ITEMS.APPLE,
    dropCount: 1,
    textures: { top: [9, 0], side: [9, 0], bottom: [9, 0] }
  },
  [BLOCKS.OAK_PLANKS]: {
    id: BLOCKS.OAK_PLANKS,
    name: 'Oak Planks',
    hardness: 1.8,
    effectiveTool: 'axe',
    dropItem: BLOCKS.OAK_PLANKS,
    textures: { top: [10, 0], side: [10, 0], bottom: [10, 0] }
  },
  [BLOCKS.CRAFTING_TABLE]: {
    id: BLOCKS.CRAFTING_TABLE,
    name: 'Crafting Table',
    hardness: 2.0,
    effectiveTool: 'axe',
    dropItem: BLOCKS.CRAFTING_TABLE,
    textures: { top: [11, 0], side: [12, 0], bottom: [10, 0] }
  },
  [BLOCKS.GLASS]: {
    id: BLOCKS.GLASS,
    name: 'Glass Block',
    isTransparent: true,
    hardness: 0.3,
    effectiveTool: 'none',
    dropItem: BLOCKS.AIR,
    textures: { top: [13, 0], side: [13, 0], bottom: [13, 0] }
  },
  [BLOCKS.BRICKS]: {
    id: BLOCKS.BRICKS,
    name: 'Bricks',
    hardness: 2.6,
    effectiveTool: 'pickaxe',
    minToolTier: 1,
    dropItem: BLOCKS.BRICKS,
    textures: { top: [14, 0], side: [14, 0], bottom: [14, 0] }
  },
  [BLOCKS.BEDROCK]: {
    id: BLOCKS.BEDROCK,
    name: 'Bedrock',
    hardness: 999999, // Unbreakable
    effectiveTool: 'none',
    dropItem: BLOCKS.AIR,
    textures: { top: [15, 0], side: [15, 0], bottom: [15, 0] }
  },
  [BLOCKS.COAL_ORE]: {
    id: BLOCKS.COAL_ORE,
    name: 'Coal Ore',
    hardness: 3.2,
    effectiveTool: 'pickaxe',
    minToolTier: 1,
    dropItem: ITEMS.COAL_ITEM,
    textures: { top: [0, 1], side: [0, 1], bottom: [0, 1] }
  },
  [BLOCKS.IRON_ORE]: {
    id: BLOCKS.IRON_ORE,
    name: 'Iron Ore',
    hardness: 3.8,
    effectiveTool: 'pickaxe',
    minToolTier: 2,
    dropItem: ITEMS.IRON_NUGGET,
    dropCount: 2,
    textures: { top: [1, 1], side: [1, 1], bottom: [1, 1] }
  },
  [BLOCKS.GOLD_ORE]: {
    id: BLOCKS.GOLD_ORE,
    name: 'Gold Ore',
    hardness: 4.2,
    effectiveTool: 'pickaxe',
    minToolTier: 2,
    dropItem: ITEMS.GOLD_NUGGET,
    dropCount: 2,
    textures: { top: [2, 1], side: [2, 1], bottom: [2, 1] }
  },
  [BLOCKS.DIAMOND_ORE]: {
    id: BLOCKS.DIAMOND_ORE,
    name: 'Diamond Ore',
    hardness: 4.8,
    effectiveTool: 'pickaxe',
    minToolTier: 3,
    dropItem: ITEMS.DIAMOND_ITEM,
    textures: { top: [3, 1], side: [3, 1], bottom: [3, 1] }
  },
  [BLOCKS.EMERALD_ORE]: {
    id: BLOCKS.EMERALD_ORE,
    name: 'Emerald Ore',
    hardness: 4.5,
    effectiveTool: 'pickaxe',
    minToolTier: 3,
    dropItem: ITEMS.EMERALD_ITEM,
    textures: { top: [4, 1], side: [4, 1], bottom: [4, 1] }
  },
  [BLOCKS.LAPIS_ORE]: {
    id: BLOCKS.LAPIS_ORE,
    name: 'Lapis Lazuli Ore',
    hardness: 3.5,
    effectiveTool: 'pickaxe',
    minToolTier: 2,
    dropItem: ITEMS.LAPIS_ITEM,
    dropCount: 4,
    textures: { top: [5, 1], side: [5, 1], bottom: [5, 1] }
  },
  [BLOCKS.REDSTONE_ORE]: {
    id: BLOCKS.REDSTONE_ORE,
    name: 'Redstone Ore',
    hardness: 3.6,
    effectiveTool: 'pickaxe',
    minToolTier: 2,
    dropItem: ITEMS.REDSTONE_ITEM,
    dropCount: 4,
    textures: { top: [6, 1], side: [6, 1], bottom: [6, 1] }
  },
  [BLOCKS.WHITE_WOOL]: {
    id: BLOCKS.WHITE_WOOL,
    name: 'White Wool',
    hardness: 0.8,
    effectiveTool: 'none',
    dropItem: BLOCKS.WHITE_WOOL,
    textures: { top: [7, 1], side: [7, 1], bottom: [7, 1] }
  },
  [BLOCKS.BED]: {
    id: BLOCKS.BED,
    name: 'Bed',
    isBed: true,
    hardness: 0.7,
    effectiveTool: 'none',
    dropItem: BLOCKS.BED,
    textures: { top: [8, 1], side: [9, 1], bottom: [10, 0] }
  },
  [BLOCKS.SNOW_GRASS]: {
    id: BLOCKS.SNOW_GRASS,
    name: 'Snow Block',
    hardness: 0.5,
    effectiveTool: 'shovel',
    dropItem: BLOCKS.SNOW_GRASS,
    textures: { top: [10, 1], side: [11, 1], bottom: [2, 0] }
  },
  [BLOCKS.CACTUS]: {
    id: BLOCKS.CACTUS,
    name: 'Cactus',
    hardness: 0.4,
    effectiveTool: 'none',
    dropItem: BLOCKS.CACTUS,
    textures: { top: [12, 1], side: [13, 1], bottom: [12, 1] }
  },
  [BLOCKS.RED_FLOWER]: {
    id: BLOCKS.RED_FLOWER,
    name: 'Poppy Flower',
    isTransparent: true,
    isFoliage: true,
    isSolid: false,
    hardness: 0.1,
    effectiveTool: 'none',
    dropItem: BLOCKS.RED_FLOWER,
    textures: { top: [14, 1], side: [14, 1], bottom: [14, 1] }
  },
  [BLOCKS.YELLOW_FLOWER]: {
    id: BLOCKS.YELLOW_FLOWER,
    name: 'Dandelion',
    isTransparent: true,
    isFoliage: true,
    isSolid: false,
    hardness: 0.1,
    effectiveTool: 'none',
    dropItem: BLOCKS.YELLOW_FLOWER,
    textures: { top: [15, 1], side: [15, 1], bottom: [15, 1] }
  },
  [BLOCKS.TORCH]: {
    id: BLOCKS.TORCH,
    name: 'Torch',
    isTransparent: true,
    isSolid: false,
    lightLevel: 14,
    hardness: 0.1,
    effectiveTool: 'none',
    dropItem: BLOCKS.TORCH,
    textures: { top: [0, 2], side: [0, 2], bottom: [0, 2] }
  },
  [BLOCKS.TALL_GRASS]: {
    id: BLOCKS.TALL_GRASS,
    name: 'Tall Grass',
    isTransparent: true,
    isFoliage: true,
    isSolid: false,
    hardness: 0.1,
    effectiveTool: 'none',
    dropItem: BLOCKS.AIR,
    textures: { top: [1, 2], side: [1, 2], bottom: [1, 2] }
  },
  [BLOCKS.FURNACE]: {
    id: BLOCKS.FURNACE,
    name: 'Furnace',
    hardness: 2.5,
    effectiveTool: 'pickaxe',
    minToolTier: 1,
    dropItem: BLOCKS.FURNACE,
    textures: { top: [4, 0], side: [4, 0], bottom: [4, 0] }
  },
};

export const ITEM_DEFS: Record<number, ItemDefinition> = {
  [ITEMS.STICK]: {
    id: ITEMS.STICK,
    name: 'Stick',
    iconColor: '#8a683d',
    attackDamage: 1,
  },
  // Wooden Tools
  [ITEMS.WOODEN_SHOVEL]: {
    id: ITEMS.WOODEN_SHOVEL,
    name: 'Wooden Shovel',
    isTool: true,
    toolType: 'shovel',
    toolTier: 1,
    attackDamage: 2,
    iconColor: '#a87948',
  },
  [ITEMS.WOODEN_PICKAXE]: {
    id: ITEMS.WOODEN_PICKAXE,
    name: 'Wooden Pickaxe',
    isTool: true,
    toolType: 'pickaxe',
    toolTier: 1,
    attackDamage: 2,
    iconColor: '#966d41',
  },
  [ITEMS.WOODEN_AXE]: {
    id: ITEMS.WOODEN_AXE,
    name: 'Wooden Axe',
    isTool: true,
    toolType: 'axe',
    toolTier: 1,
    attackDamage: 3,
    iconColor: '#ad7e49',
  },
  [ITEMS.WOODEN_SWORD]: {
    id: ITEMS.WOODEN_SWORD,
    name: 'Wooden Sword',
    isTool: true,
    toolType: 'sword',
    toolTier: 1,
    attackDamage: 4,
    iconColor: '#b88954',
  },
  // Stone Tools
  [ITEMS.STONE_SHOVEL]: {
    id: ITEMS.STONE_SHOVEL,
    name: 'Stone Shovel',
    isTool: true,
    toolType: 'shovel',
    toolTier: 2,
    attackDamage: 3,
    iconColor: '#8c8c8c',
  },
  [ITEMS.STONE_PICKAXE]: {
    id: ITEMS.STONE_PICKAXE,
    name: 'Stone Pickaxe',
    isTool: true,
    toolType: 'pickaxe',
    toolTier: 2,
    attackDamage: 3,
    iconColor: '#7a7a7a',
  },
  [ITEMS.STONE_AXE]: {
    id: ITEMS.STONE_AXE,
    name: 'Stone Axe',
    isTool: true,
    toolType: 'axe',
    toolTier: 2,
    attackDamage: 4,
    iconColor: '#828282',
  },
  [ITEMS.STONE_SWORD]: {
    id: ITEMS.STONE_SWORD,
    name: 'Stone Sword',
    isTool: true,
    toolType: 'sword',
    toolTier: 2,
    attackDamage: 5,
    iconColor: '#999999',
  },
  // Iron Ingot & Tools
  [ITEMS.IRON_INGOT]: {
    id: ITEMS.IRON_INGOT,
    name: 'Iron Ingot',
    iconColor: '#e0e0e0',
  },
  [ITEMS.IRON_SHOVEL]: {
    id: ITEMS.IRON_SHOVEL,
    name: 'Iron Shovel',
    isTool: true,
    toolType: 'shovel',
    toolTier: 3,
    attackDamage: 4,
    iconColor: '#e8e8e8',
  },
  [ITEMS.IRON_PICKAXE]: {
    id: ITEMS.IRON_PICKAXE,
    name: 'Iron Pickaxe',
    isTool: true,
    toolType: 'pickaxe',
    toolTier: 3,
    attackDamage: 4,
    iconColor: '#d6d6d6',
  },
  [ITEMS.IRON_AXE]: {
    id: ITEMS.IRON_AXE,
    name: 'Iron Axe',
    isTool: true,
    toolType: 'axe',
    toolTier: 3,
    attackDamage: 6,
    iconColor: '#e0e0e0',
  },
  [ITEMS.IRON_SWORD]: {
    id: ITEMS.IRON_SWORD,
    name: 'Iron Sword',
    isTool: true,
    toolType: 'sword',
    toolTier: 3,
    attackDamage: 6,
    iconColor: '#ffffff',
  },
  // Diamond & Tools
  [ITEMS.DIAMOND_ITEM]: {
    id: ITEMS.DIAMOND_ITEM,
    name: 'Diamond',
    iconColor: '#4bf2e7',
  },
  [ITEMS.DIAMOND_SHOVEL]: {
    id: ITEMS.DIAMOND_SHOVEL,
    name: 'Diamond Shovel',
    isTool: true,
    toolType: 'shovel',
    toolTier: 4,
    attackDamage: 5,
    iconColor: '#3be8d9',
  },
  [ITEMS.DIAMOND_PICKAXE]: {
    id: ITEMS.DIAMOND_PICKAXE,
    name: 'Diamond Pickaxe',
    isTool: true,
    toolType: 'pickaxe',
    toolTier: 4,
    attackDamage: 5,
    iconColor: '#2bd4c5',
  },
  [ITEMS.DIAMOND_AXE]: {
    id: ITEMS.DIAMOND_AXE,
    name: 'Diamond Axe',
    isTool: true,
    toolType: 'axe',
    toolTier: 4,
    attackDamage: 7,
    iconColor: '#36ebd9',
  },
  [ITEMS.DIAMOND_SWORD]: {
    id: ITEMS.DIAMOND_SWORD,
    name: 'Diamond Sword',
    isTool: true,
    toolType: 'sword',
    toolTier: 4,
    attackDamage: 7,
    iconColor: '#52fff1',
  },
  // Gems & Minerals
  [ITEMS.EMERALD_ITEM]: {
    id: ITEMS.EMERALD_ITEM,
    name: 'Emerald',
    iconColor: '#17c955',
  },
  [ITEMS.LAPIS_ITEM]: {
    id: ITEMS.LAPIS_ITEM,
    name: 'Lapis Lazuli',
    iconColor: '#214ec7',
  },
  [ITEMS.REDSTONE_ITEM]: {
    id: ITEMS.REDSTONE_ITEM,
    name: 'Redstone Dust',
    iconColor: '#eb1e1e',
  },
  [ITEMS.COAL_ITEM]: {
    id: ITEMS.COAL_ITEM,
    name: 'Coal',
    iconColor: '#2b2b2b',
  },
  // Foods & Materials
  [ITEMS.RAW_PORKCHOP]: {
    id: ITEMS.RAW_PORKCHOP,
    name: 'Raw Porkchop',
    isFood: true,
    foodRestore: 3,
    healthRestore: 1,
    iconColor: '#f28a8a',
  },
  [ITEMS.RAW_BEEF]: {
    id: ITEMS.RAW_BEEF,
    name: 'Raw Beef',
    isFood: true,
    foodRestore: 3,
    healthRestore: 1,
    iconColor: '#ad3232',
  },
  [ITEMS.APPLE]: {
    id: ITEMS.APPLE,
    name: 'Apple',
    isFood: true,
    foodRestore: 4,
    healthRestore: 2,
    iconColor: '#e82525',
  },
  [ITEMS.WHITE_WOOL_ITEM]: {
    id: ITEMS.WHITE_WOOL_ITEM,
    name: 'White Wool',
    iconColor: '#f5f5f5',
  },
  [ITEMS.IRON_NUGGET]: {
    id: ITEMS.IRON_NUGGET,
    name: 'Iron Nuggets',
    iconColor: '#e0caa8',
  },
  [ITEMS.GOLD_NUGGET]: {
    id: ITEMS.GOLD_NUGGET,
    name: 'Gold Nuggets',
    iconColor: '#f5d438',
  },
  [ITEMS.GOLD_INGOT]: {
    id: ITEMS.GOLD_INGOT,
    name: 'Gold Ingot',
    iconColor: '#ffd700',
  },
  [ITEMS.COOKED_PORKCHOP]: {
    id: ITEMS.COOKED_PORKCHOP,
    name: 'Cooked Porkchop',
    isFood: true,
    foodRestore: 8,
    healthRestore: 4,
    iconColor: '#b8593b',
  },
  [ITEMS.COOKED_BEEF]: {
    id: ITEMS.COOKED_BEEF,
    name: 'Cooked Beef',
    isFood: true,
    foodRestore: 8,
    healthRestore: 4,
    iconColor: '#85371f',
  },
};

export const ATLAS_SIZE = 16;
export const TEXTURE_SIZE = 32; // Crisp high-definition texture tile size
