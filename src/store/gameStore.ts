import { create } from 'zustand';
import { BLOCKS, ITEMS } from '../engine/blocks';
import { SavedWorld, WorldStorage } from '../engine/storage/WorldStorage';

export type GameMode = 'survival' | 'creative';
export type GraphicsQuality = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' | 'Ultra' | 'Cinematic' | 'Real Life Resolution';
export type MultiplayerMode = 'offline' | 'host' | 'client';

export interface ConnectedPlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isLocal?: boolean;
}

export interface InGameChatMessage {
  id: string;
  peerId: string;
  name: string;
  isHost: boolean;
  text: string;
  time: string;
}

export interface ItemStack {
  id: number;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  requiresCraftingTable?: boolean;
  grid?: (number | null)[][]; // 2x2 or 3x3
  ingredients: { id: number; count: number }[];
  result: ItemStack;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Basic Wood & Planks
  {
    id: 'oak_planks',
    name: 'Oak Planks (x4)',
    ingredients: [{ id: BLOCKS.OAK_LOG, count: 1 }],
    result: { id: BLOCKS.OAK_PLANKS, count: 4 }
  },
  {
    id: 'sticks',
    name: 'Sticks (x4)',
    ingredients: [{ id: BLOCKS.OAK_PLANKS, count: 2 }],
    result: { id: ITEMS.STICK, count: 4 }
  },
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    ingredients: [{ id: BLOCKS.OAK_PLANKS, count: 4 }],
    result: { id: BLOCKS.CRAFTING_TABLE, count: 1 }
  },
  {
    id: 'furnace',
    name: 'Furnace',
    requiresCraftingTable: true,
    ingredients: [{ id: BLOCKS.COBBLESTONE, count: 8 }],
    result: { id: BLOCKS.FURNACE, count: 1 }
  },
  // Bed: 3 White Wool + 3 Oak Planks
  {
    id: 'bed',
    name: 'Bed',
    requiresCraftingTable: true,
    ingredients: [
      { id: BLOCKS.WHITE_WOOL, count: 3 },
      { id: BLOCKS.OAK_PLANKS, count: 3 }
    ],
    result: { id: BLOCKS.BED, count: 1 }
  },
  // Wooden Tools
  {
    id: 'wooden_shovel',
    name: 'Wooden Shovel',
    ingredients: [
      { id: BLOCKS.OAK_PLANKS, count: 1 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.WOODEN_SHOVEL, count: 1 }
  },
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    requiresCraftingTable: true,
    ingredients: [
      { id: BLOCKS.OAK_PLANKS, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.WOODEN_PICKAXE, count: 1 }
  },
  {
    id: 'wooden_axe',
    name: 'Wooden Axe',
    requiresCraftingTable: true,
    ingredients: [
      { id: BLOCKS.OAK_PLANKS, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.WOODEN_AXE, count: 1 }
  },
  {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    ingredients: [
      { id: BLOCKS.OAK_PLANKS, count: 2 },
      { id: ITEMS.STICK, count: 1 }
    ],
    result: { id: ITEMS.WOODEN_SWORD, count: 1 }
  },
  // Stone Tools
  {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    ingredients: [
      { id: BLOCKS.COBBLESTONE, count: 1 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.STONE_SHOVEL, count: 1 }
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    requiresCraftingTable: true,
    ingredients: [
      { id: BLOCKS.COBBLESTONE, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.STONE_PICKAXE, count: 1 }
  },
  {
    id: 'stone_axe',
    name: 'Stone Axe',
    requiresCraftingTable: true,
    ingredients: [
      { id: BLOCKS.COBBLESTONE, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.STONE_AXE, count: 1 }
  },
  {
    id: 'stone_sword',
    name: 'Stone Sword',
    ingredients: [
      { id: BLOCKS.COBBLESTONE, count: 2 },
      { id: ITEMS.STICK, count: 1 }
    ],
    result: { id: ITEMS.STONE_SWORD, count: 1 }
  },
  // Iron Tools
  {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    ingredients: [
      { id: ITEMS.IRON_INGOT, count: 1 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.IRON_SHOVEL, count: 1 }
  },
  {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    requiresCraftingTable: true,
    ingredients: [
      { id: ITEMS.IRON_INGOT, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.IRON_PICKAXE, count: 1 }
  },
  {
    id: 'iron_axe',
    name: 'Iron Axe',
    requiresCraftingTable: true,
    ingredients: [
      { id: ITEMS.IRON_INGOT, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.IRON_AXE, count: 1 }
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    ingredients: [
      { id: ITEMS.IRON_INGOT, count: 2 },
      { id: ITEMS.STICK, count: 1 }
    ],
    result: { id: ITEMS.IRON_SWORD, count: 1 }
  },
  // Diamond Tools
  {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    ingredients: [
      { id: ITEMS.DIAMOND_ITEM, count: 1 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.DIAMOND_SHOVEL, count: 1 }
  },
  {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    requiresCraftingTable: true,
    ingredients: [
      { id: ITEMS.DIAMOND_ITEM, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.DIAMOND_PICKAXE, count: 1 }
  },
  {
    id: 'diamond_axe',
    name: 'Diamond Axe',
    requiresCraftingTable: true,
    ingredients: [
      { id: ITEMS.DIAMOND_ITEM, count: 3 },
      { id: ITEMS.STICK, count: 2 }
    ],
    result: { id: ITEMS.DIAMOND_AXE, count: 1 }
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    ingredients: [
      { id: ITEMS.DIAMOND_ITEM, count: 2 },
      { id: ITEMS.STICK, count: 1 }
    ],
    result: { id: ITEMS.DIAMOND_SWORD, count: 1 }
  },
  // Miscellaneous
  {
    id: 'torch',
    name: 'Torches (x4)',
    ingredients: [
      { id: ITEMS.COAL_ITEM, count: 1 },
      { id: ITEMS.STICK, count: 1 }
    ],
    result: { id: BLOCKS.TORCH, count: 4 }
  },
  {
    id: 'bricks',
    name: 'Bricks (x4)',
    ingredients: [{ id: BLOCKS.STONE, count: 4 }],
    result: { id: BLOCKS.BRICKS, count: 4 }
  },
  {
    id: 'glass',
    name: 'Glass Block (x2)',
    ingredients: [{ id: BLOCKS.SAND, count: 2 }],
    result: { id: BLOCKS.GLASS, count: 2 }
  }
];

interface GameState {
  // Game & Flow
  gameMode: GameMode;
  isPaused: boolean;
  hasStarted: boolean;
  isInventoryOpen: boolean;
  isCraftingTableOpen: boolean;
  isFurnaceOpen: boolean;
  isSleeping: boolean;
  isDead: boolean;
  isViewerMode: boolean; // Viewer Mode (Hides ALL UI)
  isNoclip: boolean; // Go Through Blocks (Noclip Mode)
  isMobileControls: boolean; // Touch / Mobile Mode
  timeOfDay: number; // 0..1 (0..0.77 Day [10m], 0.77..1.0 Night [3m])

  // Furnace State
  furnaceInput: ItemStack | null;
  furnaceFuel: ItemStack | null;
  furnaceOutput: ItemStack | null;

  // Survival Stats
  health: number; // 0..20
  hunger: number; // 0..20
  oxygen: number; // 0..10
  
  // Settings & Graphics
  fpsLimit: number;
  renderDistance: number;
  graphicsQuality: GraphicsQuality;
  showDebug: boolean;
  volumetricClouds: boolean;

  // Inventory State
  activeHotbarSlot: number;
  hotbar: (ItemStack | null)[];
  backpack: (ItemStack | null)[];

  // Multiplayer state
  multiplayerMode: MultiplayerMode;
  roomPin: string | null;
  isHost: boolean;
  isMultiplayerConnected: boolean;
  connectedPlayers: ConnectedPlayerInfo[];
  chatMessages: InGameChatMessage[];
  multiplayerNotifications: string[];
  playerName: string;

  // World persistence state
  currentWorld: SavedWorld | null;
  savedWorlds: SavedWorld[];
  isCloudSyncing: boolean;
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'setup_needed';
  cloudSyncMessage: string;
  needsTableSetup: boolean;

  // Actions
  setCurrentWorld: (world: SavedWorld | null) => void;
  setSavedWorlds: (worlds: SavedWorld[]) => void;
  setCloudSyncState: (status: 'idle' | 'syncing' | 'synced' | 'error' | 'setup_needed', msg?: string) => void;
  setNeedsTableSetup: (needed: boolean) => void;
  loadWorldStateIntoStore: (world: SavedWorld) => void;
  setMultiplayerState: (state: { mode: MultiplayerMode; pin: string | null; isHost: boolean; isConnected: boolean }) => void;
  setConnectedPlayers: (players: ConnectedPlayerInfo[]) => void;
  addChatMessage: (msg: InGameChatMessage) => void;
  addMultiplayerNotification: (text: string) => void;
  setPlayerName: (name: string) => void;
  leaveMultiplayer: () => void;
  setGameMode: (mode: GameMode) => void;
  setPaused: (p: boolean) => void;
  setHasStarted: (s: boolean) => void;
  toggleInventory: () => void;
  toggleViewerMode: () => void;
  toggleNoclip: () => void;
  setNoclip: (noclip: boolean) => void;
  setCraftingTableOpen: (open: boolean) => void;
  setFurnaceOpen: (open: boolean) => void;
  setFurnaceSlot: (slot: 'input' | 'fuel' | 'output', item: ItemStack | null) => void;
  smeltFurnace: () => boolean;
  setMobileControls: (mobile: boolean) => void;
  setSleeping: (sleeping: boolean) => void;
  setTimeOfDay: (time: number) => void;
  setHealth: (hp: number | ((prev: number) => number)) => void;
  setHunger: (hunger: number | ((prev: number) => number)) => void;
  setOxygen: (oxygen: number | ((prev: number) => number)) => void;
  setIsDead: (dead: boolean) => void;
  respawn: () => void;
  setSettings: (settings: Partial<GameState>) => void;
  setActiveSlot: (slot: number) => void;
  addToInventory: (itemId: number, count?: number) => boolean;
  removeFromHotbar: (slot: number, count?: number) => void;
  setSlotItem: (area: 'hotbar' | 'backpack', index: number, item: ItemStack | null) => void;
  craftRecipe: (recipe: CraftingRecipe) => boolean;
  eatFood: (slotIndex: number) => boolean;
}

const savedRenderDist = localStorage.getItem('voxel_render_distance');
const savedQuality = localStorage.getItem('voxel_graphics_quality') as GraphicsQuality | null;
const savedFps = localStorage.getItem('voxel_fps_limit');
const savedMode = (localStorage.getItem('voxel_game_mode') as GameMode) || 'survival';

export const useGameStore = create<GameState>((set, get) => ({
  gameMode: savedMode,
  isPaused: true,
  hasStarted: false,
  isInventoryOpen: false,
  isCraftingTableOpen: false,
  isFurnaceOpen: false,
  isSleeping: false,
  isDead: false,
  isViewerMode: false,
  isNoclip: false,
  isMobileControls: typeof navigator !== 'undefined' && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window && navigator.maxTouchPoints > 0)),
  timeOfDay: 0.15, // Start in morning (around 8am)

  furnaceInput: null,
  furnaceFuel: null,
  furnaceOutput: null,

  health: 20,
  hunger: 20,
  oxygen: 10,

  fpsLimit: savedFps ? parseInt(savedFps) : 0,
  renderDistance: savedRenderDist ? parseInt(savedRenderDist) : 6,
  graphicsQuality: savedQuality || 'Medium',
  showDebug: true,
  volumetricClouds: true,
  activeHotbarSlot: 0,

  // Multiplayer initial state
  multiplayerMode: 'offline',
  roomPin: null,
  isHost: false,
  isMultiplayerConnected: false,
  connectedPlayers: [],
  chatMessages: [],
  multiplayerNotifications: [],
  playerName: typeof localStorage !== 'undefined' ? (localStorage.getItem('voxel_player_name') || 'Player') : 'Player',

  // World persistence initial state
  currentWorld: null,
  savedWorlds: WorldStorage.getLocalWorlds(),
  isCloudSyncing: false,
  cloudSyncStatus: 'idle',
  cloudSyncMessage: '',
  needsTableSetup: false,

  setCurrentWorld: (world) => set({ currentWorld: world }),
  setSavedWorlds: (worlds) => set({ savedWorlds: worlds }),
  setCloudSyncState: (status, msg = '') => set({ cloudSyncStatus: status, isCloudSyncing: status === 'syncing', cloudSyncMessage: msg }),
  setNeedsTableSetup: (needed) => set({ needsTableSetup: needed }),

  loadWorldStateIntoStore: (world) => {
    set({
      currentWorld: world,
      gameMode: world.gameMode,
      health: world.playerData?.health ?? 20,
      hunger: world.playerData?.hunger ?? 20,
      activeHotbarSlot: world.inventory?.activeSlot ?? 0,
      hotbar: world.inventory?.hotbar || (world.gameMode === 'survival' ? Array(9).fill(null) : [
        { id: BLOCKS.GRASS, count: 64 },
        { id: BLOCKS.DIRT, count: 64 },
        { id: BLOCKS.STONE, count: 64 },
        { id: BLOCKS.OAK_LOG, count: 64 },
        { id: BLOCKS.OAK_PLANKS, count: 64 },
        { id: BLOCKS.GLASS, count: 64 },
        { id: BLOCKS.BRICKS, count: 64 },
        { id: BLOCKS.TORCH, count: 64 },
        { id: BLOCKS.CRAFTING_TABLE, count: 64 },
      ]),
      backpack: world.inventory?.backpack || Array(27).fill(null),
      timeOfDay: world.timeOfDay ?? 0.15,
      roomPin: world.pin || null,
      multiplayerMode: world.type === 'multiplayer' ? (world.isHost ? 'host' : 'client') : 'offline',
      isHost: world.type === 'multiplayer' ? Boolean(world.isHost) : false,
    });
  },

  setMultiplayerState: (newState) => {
    set({
      multiplayerMode: newState.mode,
      roomPin: newState.pin,
      isHost: newState.isHost,
      isMultiplayerConnected: newState.isConnected,
    });
  },

  setConnectedPlayers: (players) => {
    set({ connectedPlayers: players });
  },

  addChatMessage: (msg) => {
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-49), msg],
    }));
  },

  addMultiplayerNotification: (text) => {
    set((state) => ({
      multiplayerNotifications: [...state.multiplayerNotifications.slice(-9), text],
    }));
  },

  setPlayerName: (name) => {
    const clean = name.trim() || 'Player';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('voxel_player_name', clean);
    }
    set({ playerName: clean });
  },

  leaveMultiplayer: () => {
    set({
      multiplayerMode: 'offline',
      roomPin: null,
      isHost: false,
      isMultiplayerConnected: false,
      connectedPlayers: [],
      chatMessages: [],
    });
  },

  // In Survival mode: starts with empty inventory as requested ("survivor starts with no blocks")
  hotbar: savedMode === 'survival' ? Array(9).fill(null) : [
    { id: BLOCKS.GRASS, count: 64 },
    { id: BLOCKS.DIRT, count: 64 },
    { id: BLOCKS.STONE, count: 64 },
    { id: BLOCKS.OAK_LOG, count: 64 },
    { id: BLOCKS.OAK_PLANKS, count: 64 },
    { id: BLOCKS.GLASS, count: 64 },
    { id: BLOCKS.BRICKS, count: 64 },
    { id: BLOCKS.TORCH, count: 64 },
    { id: BLOCKS.CRAFTING_TABLE, count: 64 },
  ],
  backpack: Array(27).fill(null),

  setGameMode: (mode: GameMode) => {
    localStorage.setItem('voxel_game_mode', mode);
    set((state) => {
      if (mode === 'survival' && state.gameMode !== 'survival') {
        return {
          gameMode: mode,
          health: 20,
          hunger: 20,
          oxygen: 10,
          hotbar: Array(9).fill(null),
          backpack: Array(27).fill(null),
        };
      } else if (mode === 'creative' && state.gameMode !== 'creative') {
        return {
          gameMode: mode,
          health: 20,
          hunger: 20,
          hotbar: [
            { id: BLOCKS.GRASS, count: 64 },
            { id: BLOCKS.DIRT, count: 64 },
            { id: BLOCKS.STONE, count: 64 },
            { id: BLOCKS.OAK_LOG, count: 64 },
            { id: BLOCKS.OAK_PLANKS, count: 64 },
            { id: BLOCKS.GLASS, count: 64 },
            { id: BLOCKS.BRICKS, count: 64 },
            { id: BLOCKS.TORCH, count: 64 },
            { id: BLOCKS.CRAFTING_TABLE, count: 64 },
          ]
        };
      }
      return { gameMode: mode };
    });
  },

  setPaused: (isPaused) => set({ isPaused }),
  setHasStarted: (hasStarted) => set({ hasStarted, isPaused: false }),
  toggleInventory: () => set((state) => ({ 
    isInventoryOpen: !state.isInventoryOpen,
    isCraftingTableOpen: false 
  })),
  toggleViewerMode: () => set((state) => ({ isViewerMode: !state.isViewerMode })),
  toggleNoclip: () => set((state) => ({ isNoclip: !state.isNoclip })),
  setNoclip: (isNoclip) => set({ isNoclip }),
  setCraftingTableOpen: (open) => set({ 
    isCraftingTableOpen: open,
    isInventoryOpen: open
  }),
  setFurnaceOpen: (open) => set({
    isFurnaceOpen: open,
  }),
  setFurnaceSlot: (slot, item) => set((state) => {
    if (slot === 'input') return { furnaceInput: item };
    if (slot === 'fuel') return { furnaceFuel: item };
    if (slot === 'output') return { furnaceOutput: item };
    return {};
  }),
  setMobileControls: (isMobileControls) => set({ isMobileControls }),
  smeltFurnace: () => {
    const state = get();
    const { furnaceInput, furnaceFuel, furnaceOutput } = state;
    if (!furnaceInput || furnaceInput.count <= 0) return false;
    if (!furnaceFuel || furnaceFuel.count <= 0) return false;

    // Determine smelt output item
    let resultId: number | null = null;
    if (furnaceInput.id === ITEMS.IRON_NUGGET || furnaceInput.id === BLOCKS.IRON_ORE) {
      resultId = ITEMS.IRON_INGOT;
    } else if (furnaceInput.id === ITEMS.GOLD_NUGGET || furnaceInput.id === BLOCKS.GOLD_ORE) {
      resultId = ITEMS.GOLD_INGOT;
    } else if (furnaceInput.id === ITEMS.RAW_PORKCHOP) {
      resultId = ITEMS.COOKED_PORKCHOP;
    } else if (furnaceInput.id === ITEMS.RAW_BEEF) {
      resultId = ITEMS.COOKED_BEEF;
    } else if (furnaceInput.id === BLOCKS.COBBLESTONE) {
      resultId = BLOCKS.STONE;
    } else if (furnaceInput.id === BLOCKS.SAND) {
      resultId = BLOCKS.GLASS;
    } else if (furnaceInput.id === BLOCKS.OAK_LOG) {
      resultId = ITEMS.COAL_ITEM;
    }

    if (!resultId) return false;

    // Check if output slot is compatible
    if (furnaceOutput && furnaceOutput.id !== resultId) return false;

    // Consume input and fuel
    const newInputCount = furnaceInput.count - 1;
    const newFuelCount = furnaceFuel.count - 1;
    const currentOutCount = furnaceOutput ? furnaceOutput.count : 0;

    set({
      furnaceInput: newInputCount > 0 ? { id: furnaceInput.id, count: newInputCount } : null,
      furnaceFuel: newFuelCount > 0 ? { id: furnaceFuel.id, count: newFuelCount } : null,
      furnaceOutput: { id: resultId, count: currentOutCount + 1 }
    });

    return true;
  },
  setSleeping: (isSleeping) => set({ isSleeping }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  
  setHealth: (hp) => set((state) => {
    const nextVal = typeof hp === 'function' ? hp(state.health) : hp;
    const clamped = Math.max(0, Math.min(20, nextVal));
    return { 
      health: clamped, 
      isDead: clamped <= 0 
    };
  }),

  setHunger: (hunger) => set((state) => {
    const nextVal = typeof hunger === 'function' ? hunger(state.hunger) : hunger;
    return { hunger: Math.max(0, Math.min(20, nextVal)) };
  }),

  setOxygen: (oxygen) => set((state) => {
    const nextVal = typeof oxygen === 'function' ? oxygen(state.oxygen) : oxygen;
    return { oxygen: Math.max(0, Math.min(10, nextVal)) };
  }),

  setIsDead: (isDead) => set({ isDead }),

  respawn: () => set((state) => ({
    isDead: false,
    health: 20,
    hunger: 20,
    oxygen: 10,
    isPaused: false,
    hotbar: state.gameMode === 'survival' ? Array(9).fill(null) : state.hotbar,
  })),

  setSettings: (settings) => {
    set((state) => {
      const next = { ...state, ...settings };
      if (settings.renderDistance !== undefined) {
        localStorage.setItem('voxel_render_distance', settings.renderDistance.toString());
      }
      if (settings.graphicsQuality !== undefined) {
        localStorage.setItem('voxel_graphics_quality', settings.graphicsQuality);
      }
      if (settings.fpsLimit !== undefined) {
        localStorage.setItem('voxel_fps_limit', settings.fpsLimit.toString());
      }
      return next;
    });
  },

  setActiveSlot: (slot) => set({ activeHotbarSlot: slot }),

  addToInventory: (itemId, count = 1) => {
    let placed = false;
    set((state) => {
      const hotbar = [...state.hotbar];
      const backpack = [...state.backpack];

      // 1. Try stacking in hotbar
      for (let i = 0; i < hotbar.length; i++) {
        if (hotbar[i] && hotbar[i]!.id === itemId && hotbar[i]!.count < 64) {
          hotbar[i] = { id: itemId, count: Math.min(64, hotbar[i]!.count + count) };
          placed = true;
          return { hotbar };
        }
      }

      // 2. Try empty slot in hotbar
      for (let i = 0; i < hotbar.length; i++) {
        if (!hotbar[i]) {
          hotbar[i] = { id: itemId, count };
          placed = true;
          return { hotbar };
        }
      }

      // 3. Try stacking in backpack
      for (let i = 0; i < backpack.length; i++) {
        if (backpack[i] && backpack[i]!.id === itemId && backpack[i]!.count < 64) {
          backpack[i] = { id: itemId, count: Math.min(64, backpack[i]!.count + count) };
          placed = true;
          return { backpack };
        }
      }

      // 4. Try empty slot in backpack
      for (let i = 0; i < backpack.length; i++) {
        if (!backpack[i]) {
          backpack[i] = { id: itemId, count };
          placed = true;
          return { backpack };
        }
      }

      return { hotbar, backpack };
    });
    return placed;
  },

  removeFromHotbar: (slot, count = 1) => {
    set((state) => {
      const hotbar = [...state.hotbar];
      if (hotbar[slot]) {
        const nextCount = hotbar[slot]!.count - count;
        if (nextCount <= 0) {
          hotbar[slot] = null;
        } else {
          hotbar[slot] = { id: hotbar[slot]!.id, count: nextCount };
        }
      }
      return { hotbar };
    });
  },

  setSlotItem: (area, index, item) => {
    set((state) => {
      if (area === 'hotbar') {
        const hotbar = [...state.hotbar];
        hotbar[index] = item;
        return { hotbar };
      } else {
        const backpack = [...state.backpack];
        backpack[index] = item;
        return { backpack };
      }
    });
  },

  craftRecipe: (recipe) => {
    const state = get();
    // Check if player has required items
    for (const req of recipe.ingredients) {
      let found = 0;
      for (const item of [...state.hotbar, ...state.backpack]) {
        if (item && item.id === req.id) found += item.count;
      }
      if (found < req.count) return false;
    }

    // Deduct items
    const hotbar = [...state.hotbar];
    const backpack = [...state.backpack];

    for (const req of recipe.ingredients) {
      let remaining = req.count;
      for (let i = 0; i < hotbar.length && remaining > 0; i++) {
        if (hotbar[i] && hotbar[i]!.id === req.id) {
          const take = Math.min(remaining, hotbar[i]!.count);
          hotbar[i]!.count -= take;
          remaining -= take;
          if (hotbar[i]!.count <= 0) hotbar[i] = null;
        }
      }
      for (let i = 0; i < backpack.length && remaining > 0; i++) {
        if (backpack[i] && backpack[i]!.id === req.id) {
          const take = Math.min(remaining, backpack[i]!.count);
          backpack[i]!.count -= take;
          remaining -= take;
          if (backpack[i]!.count <= 0) backpack[i] = null;
        }
      }
    }

    set({ hotbar, backpack });
    get().addToInventory(recipe.result.id, recipe.result.count);
    return true;
  },

  eatFood: (slotIndex) => {
    const state = get();
    const item = state.hotbar[slotIndex];
    if (!item) return false;

    // Check if food
    if (item.id === ITEMS.APPLE || item.id === ITEMS.RAW_PORKCHOP || item.id === ITEMS.RAW_BEEF) {
      if (state.hunger >= 20 && state.health >= 20) return false;

      const restore = item.id === ITEMS.APPLE ? 4 : 3;
      get().setHunger((h) => Math.min(20, h + restore));
      get().setHealth((hp) => Math.min(20, hp + 1));
      get().removeFromHotbar(slotIndex, 1);
      return true;
    }
    return false;
  }
}));
