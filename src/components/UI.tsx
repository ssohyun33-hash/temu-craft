import React, { useEffect, useState } from 'react';
import { useGameStore, CRAFTING_RECIPES, CraftingRecipe, GraphicsQuality, GameMode, ItemStack } from '../store/gameStore';
import { BLOCKS, BLOCK_DEFS, ITEMS, ITEM_DEFS } from '../engine/blocks';
import { getItemIcon64 } from '../engine/ItemIconGenerator';
import { evaluateGridCrafting } from '../engine/GridCrafting';
import { sounds } from '../engine/sound/SoundManager';
import { Settings, X, Play, Compass, Heart, Drumstick, Moon, Sun, Shield, Sparkles, RefreshCw, Smartphone, Flame, ArrowRight, RotateCcw, Hand, Users, Crown, Copy, Check, MessageSquare, Send, Radio, Globe, Database, Cloud, Save, LogOut } from 'lucide-react';
import { FurnaceModal } from './FurnaceModal';
import { MobileControls } from './MobileControls';
import { MultiplayerModal } from './MultiplayerModal';
import { WorldManagerModal } from './WorldManagerModal';

interface UIProps {
  engine?: any;
  engineStats?: {
    fps: number;
    avgFps: number;
    frameTime: number;
    loadedChunks: number;
    playerPos: { x: number; y: number; z: number };
    isSubmerged: boolean;
    isFlying: boolean;
    breakProgress: number;
  };
  onPlayClick: () => void;
}

export const UI: React.FC<UIProps> = ({ engine, engineStats, onPlayClick }) => {
  const {
    gameMode,
    isPaused,
    hasStarted,
    isInventoryOpen,
    isCraftingTableOpen,
    isSleeping,
    isDead,
    health,
    hunger,
    oxygen,
    timeOfDay,
    activeHotbarSlot,
    hotbar,
    backpack,
    renderDistance,
    graphicsQuality,
    fpsLimit,
    showDebug,
    isViewerMode,
    isNoclip,
    isMobileControls,
    setMobileControls,
    setGameMode,
    setActiveSlot,
    setSettings,
    toggleInventory,
    toggleViewerMode,
    toggleNoclip,
    setCraftingTableOpen,
    craftRecipe,
    respawn,
    addToInventory,
    multiplayerMode,
    roomPin,
    isHost,
    connectedPlayers,
    chatMessages,
    multiplayerNotifications,
    leaveMultiplayer,
    currentWorld,
    savedWorlds,
    cloudSyncStatus,
    cloudSyncMessage,
    setHasStarted,
    setPaused,
  } = useGameStore();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [showWorldManagerModal, setShowWorldManagerModal] = useState(false);
  const [saveStatusToast, setSaveStatusToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showChatBox, setShowChatBox] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [copiedHudPin, setCopiedHudPin] = useState(false);
  const [creativeTab, setCreativeTab] = useState<'blocks' | 'tools' | 'ores' | 'food'>('blocks');
  const [showViewerBanner, setShowViewerBanner] = useState(false);

  // 2x2 and 3x3 Grid Crafting state
  const [craftingGrid, setCraftingGrid] = useState<(ItemStack | null)[]>(Array(9).fill(null));
  const [heldItem, setHeldItem] = useState<ItemStack | null>(null);
  const [placeSingleMode, setPlaceSingleMode] = useState(false);

  // Mouse & Touch Dragging state
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const lastVisitedSlotRef = React.useRef<number | null>(null);

  // Track global cursor/touch movement for floating item & drag events
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const y = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;
      if (x !== undefined && y !== undefined) {
        setPointerPos({ x, y });
      }
    };

    const handleUp = () => {
      setIsMouseDown(false);
      lastVisitedSlotRef.current = null;
    };

    const handleDown = () => {
      setIsMouseDown(true);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, []);

  // Distribute 1 item into grid cell slotIdx during drag/hover
  const handleCellEnterOrDrag = (slotIdx: number) => {
    if (lastVisitedSlotRef.current === slotIdx) return;
    lastVisitedSlotRef.current = slotIdx;

    setHeldItem((prevHeld) => {
      if (!prevHeld || prevHeld.count <= 0) return null;

      setCraftingGrid((prevGrid) => {
        const nextGrid = [...prevGrid];
        const currentStack = nextGrid[slotIdx];

        if (!currentStack) {
          nextGrid[slotIdx] = { id: prevHeld.id, count: 1 };
          sounds.playBlockPlace();
        } else if (currentStack.id === prevHeld.id && currentStack.count < 64) {
          nextGrid[slotIdx] = { id: currentStack.id, count: currentStack.count + 1 };
          sounds.playBlockPlace();
        }
        return nextGrid;
      });

      const newCount = prevHeld.count - 1;
      return newCount > 0 ? { id: prevHeld.id, count: newCount } : null;
    });
  };

  // Touch swipe drag across grid cells
  const handleGridTouchMove = (e: React.TouchEvent) => {
    if (!heldItem || e.touches.length === 0) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const slotAttr = el.getAttribute('data-craft-slot') || el.parentElement?.getAttribute('data-craft-slot');
    if (slotAttr !== null && slotAttr !== undefined) {
      const idx = parseInt(slotAttr, 10);
      if (!isNaN(idx)) {
        handleCellEnterOrDrag(idx);
      }
    }
  };

  // Helper to return grid items and held items back into inventory
  const clearAndReturnGrid = () => {
    if (heldItem) {
      addToInventory(heldItem.id, heldItem.count);
      setHeldItem(null);
    }
    for (let i = 0; i < 9; i++) {
      if (craftingGrid[i]) {
        addToInventory(craftingGrid[i]!.id, craftingGrid[i]!.count);
      }
    }
    setCraftingGrid(Array(9).fill(null));
    sounds.playClick();
  };

  const handleCloseInventory = () => {
    clearAndReturnGrid();
    toggleInventory();
    setCraftingTableOpen(false);
  };

  // Format active grid into 2D pattern for evaluation
  const currentGridSize = isCraftingTableOpen ? 3 : 2;
  const grid2D: (ItemStack | null)[][] = [];
  if (currentGridSize === 3) {
    for (let r = 0; r < 3; r++) {
      grid2D[r] = [craftingGrid[r * 3], craftingGrid[r * 3 + 1], craftingGrid[r * 3 + 2]];
    }
  } else {
    for (let r = 0; r < 2; r++) {
      grid2D[r] = [craftingGrid[r * 2], craftingGrid[r * 2 + 1]];
    }
  }
  const craftingOutput = evaluateGridCrafting(grid2D, currentGridSize);

  // Handle slot interaction (pick up, place, stack, swap)
  const handleSlotClick = (
    currentStack: ItemStack | null,
    onUpdateSlot: (newStack: ItemStack | null) => void
  ) => {
    sounds.playClick();

    if (!heldItem) {
      if (currentStack) {
        setHeldItem({ ...currentStack });
        onUpdateSlot(null);
      }
      return;
    }

    if (placeSingleMode) {
      if (!currentStack) {
        onUpdateSlot({ id: heldItem.id, count: 1 });
        if (heldItem.count <= 1) setHeldItem(null);
        else setHeldItem({ ...heldItem, count: heldItem.count - 1 });
      } else if (currentStack.id === heldItem.id && currentStack.count < 64) {
        onUpdateSlot({ id: currentStack.id, count: currentStack.count + 1 });
        if (heldItem.count <= 1) setHeldItem(null);
        else setHeldItem({ ...heldItem, count: heldItem.count - 1 });
      }
      return;
    }

    if (!currentStack) {
      onUpdateSlot({ ...heldItem });
      setHeldItem(null);
    } else if (currentStack.id === heldItem.id) {
      const space = 64 - currentStack.count;
      const add = Math.min(space, heldItem.count);
      onUpdateSlot({ id: currentStack.id, count: currentStack.count + add });
      const remaining = heldItem.count - add;
      setHeldItem(remaining > 0 ? { id: heldItem.id, count: remaining } : null);
    } else {
      setHeldItem({ ...currentStack });
      onUpdateSlot({ ...heldItem });
    }
  };

  // Handle taking crafted item from Output slot
  const handleTakeCraftResult = () => {
    if (!craftingOutput) return;

    sounds.playBlockPlace();

    const nextGrid = [...craftingGrid];
    const maxIdx = isCraftingTableOpen ? 9 : 4;
    for (let i = 0; i < maxIdx; i++) {
      if (nextGrid[i] && nextGrid[i]!.count > 0) {
        const nextCount = nextGrid[i]!.count - 1;
        nextGrid[i] = nextCount > 0 ? { id: nextGrid[i]!.id, count: nextCount } : null;
      }
    }
    setCraftingGrid(nextGrid);

    if (!heldItem) {
      setHeldItem({ ...craftingOutput });
    } else if (heldItem.id === craftingOutput.id) {
      setHeldItem({ id: heldItem.id, count: Math.min(64, heldItem.count + craftingOutput.count) });
    } else {
      addToInventory(craftingOutput.id, craftingOutput.count);
    }
  };

  // Auto-hide Viewer Mode banner after 3 seconds for 100% clean UI-free screen
  useEffect(() => {
    if (isViewerMode) {
      setShowViewerBanner(true);
      const timer = setTimeout(() => {
        setShowViewerBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowViewerBanner(false);
    }
  }, [isViewerMode]);

  // Keyboard navigation for slots 1-9, F3 (debug), F4 (viewer mode), V/N (noclip), and E for Inventory
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.key === 't' || e.key === 'T') && !isPaused && !isInventoryOpen && !isDead && roomPin) {
        e.preventDefault();
        setShowChatBox(true);
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      if (e.key >= '1' && e.key <= '9') {
        const slot = parseInt(e.key) - 1;
        setActiveSlot(slot);
        sounds.playClick();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setSettings({ showDebug: !showDebug });
      }
      if (e.key === 'F4' || e.code === 'F4' || ((e.key === '4' || e.code === 'Digit4') && (e.altKey || e.ctrlKey || e.metaKey || (e as any).fnKey))) {
        e.preventDefault();
        sounds.playClick();
        toggleViewerMode();
      }
      if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'n') {
        sounds.playClick();
        toggleNoclip();
      }
      if (e.key.toLowerCase() === 'e') {
        if (!isDead && !isSleeping) {
          e.preventDefault();
          sounds.playClick();
          if (!hasStarted) {
            onPlayClick();
          }
          if (isInventoryOpen || isCraftingTableOpen) {
            toggleInventory();
            if (isCraftingTableOpen) setCraftingTableOpen(false);
            document.querySelector('canvas')?.requestPointerLock();
          } else {
            toggleInventory();
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
          }
        }
      }
      if (e.key === 'Escape') {
        if (isInventoryOpen || isCraftingTableOpen) {
          toggleInventory();
          if (isCraftingTableOpen) setCraftingTableOpen(false);
          document.querySelector('canvas')?.requestPointerLock();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveSlot, showDebug, setSettings, toggleViewerMode, toggleNoclip, isInventoryOpen, isCraftingTableOpen, isDead, isSleeping, hasStarted, toggleInventory, setCraftingTableOpen, onPlayClick]);

  const getItemColor = (id: number) => {
    if (id in ITEM_DEFS) {
      return ITEM_DEFS[id].iconColor;
    }
    switch (id) {
      case BLOCKS.GRASS: return '#5b8c34';
      case BLOCKS.DIRT: return '#79553a';
      case BLOCKS.STONE: return '#757575';
      case BLOCKS.COBBLESTONE: return '#5e5e5e';
      case BLOCKS.SAND: return '#d9cb94';
      case BLOCKS.WATER: return '#2b62d9';
      case BLOCKS.OAK_LOG: return '#533b21';
      case BLOCKS.OAK_LEAVES: return '#3a7d28';
      case BLOCKS.OAK_PLANKS: return '#ad8553';
      case BLOCKS.CRAFTING_TABLE: return '#9c7444';
      case BLOCKS.GLASS: return '#aae0fa';
      case BLOCKS.BRICKS: return '#9e4e3b';
      case BLOCKS.BEDROCK: return '#222222';
      case BLOCKS.COAL_ORE: return '#333333';
      case BLOCKS.IRON_ORE: return '#d4b79b';
      case BLOCKS.GOLD_ORE: return '#ffd033';
      case BLOCKS.DIAMOND_ORE: return '#3be8d9';
      case BLOCKS.EMERALD_ORE: return '#17c955';
      case BLOCKS.LAPIS_ORE: return '#214ec7';
      case BLOCKS.REDSTONE_ORE: return '#eb1e1e';
      case BLOCKS.WHITE_WOOL: return '#f5f5f5';
      case BLOCKS.BED: return '#cc2222';
      case BLOCKS.SNOW_GRASS: return '#eef5fc';
      case BLOCKS.CACTUS: return '#3c8c2e';
      case BLOCKS.TORCH: return '#ff9900';
      case BLOCKS.RED_FLOWER: return '#e02b2b';
      case BLOCKS.YELLOW_FLOWER: return '#f0c422';
      default: return '#888888';
    }
  };

  const getItemName = (id: number) => {
    if (id in ITEM_DEFS) return ITEM_DEFS[id].name;
    if (id in BLOCK_DEFS) return BLOCK_DEFS[id].name;
    return 'Item';
  };

  // Check if player has ingredients to craft
  const canCraft = (recipe: CraftingRecipe) => {
    const allItems = [...hotbar, ...backpack];
    for (const req of recipe.ingredients) {
      let count = 0;
      for (const stack of allItems) {
        if (stack && stack.id === req.id) count += stack.count;
      }
      if (count < req.count) return false;
    }
    return true;
  };

  // Creative mode item catalog
  const creativeBlocks = [
    BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.COBBLESTONE, BLOCKS.SAND,
    BLOCKS.OAK_LOG, BLOCKS.OAK_PLANKS, BLOCKS.OAK_LEAVES, BLOCKS.GLASS,
    BLOCKS.BRICKS, BLOCKS.WHITE_WOOL, BLOCKS.BED, BLOCKS.CRAFTING_TABLE,
    BLOCKS.TORCH, BLOCKS.SNOW_GRASS, BLOCKS.CACTUS, BLOCKS.RED_FLOWER, BLOCKS.YELLOW_FLOWER
  ];
  const creativeTools = [
    ITEMS.WOODEN_SHOVEL, ITEMS.WOODEN_PICKAXE, ITEMS.WOODEN_AXE, ITEMS.WOODEN_SWORD,
    ITEMS.STONE_SHOVEL, ITEMS.STONE_PICKAXE, ITEMS.STONE_AXE, ITEMS.STONE_SWORD,
    ITEMS.IRON_SHOVEL, ITEMS.IRON_PICKAXE, ITEMS.IRON_AXE, ITEMS.IRON_SWORD,
    ITEMS.DIAMOND_SHOVEL, ITEMS.DIAMOND_PICKAXE, ITEMS.DIAMOND_AXE, ITEMS.DIAMOND_SWORD,
    ITEMS.STICK
  ];
  const creativeOres = [
    BLOCKS.COAL_ORE, BLOCKS.IRON_ORE, BLOCKS.GOLD_ORE, BLOCKS.DIAMOND_ORE,
    BLOCKS.EMERALD_ORE, BLOCKS.LAPIS_ORE, BLOCKS.REDSTONE_ORE,
    ITEMS.COAL_ITEM, ITEMS.IRON_INGOT, ITEMS.DIAMOND_ITEM, ITEMS.EMERALD_ITEM,
    ITEMS.LAPIS_ITEM, ITEMS.REDSTONE_ITEM
  ];
  const creativeFood = [
    ITEMS.APPLE, ITEMS.RAW_PORKCHOP, ITEMS.RAW_BEEF
  ];

  if (isViewerMode) {
    if (!showViewerBanner) return null; // 100% CLEAN - ABSOLUTELY ZERO UI ON SCREEN

    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-700 opacity-100">
        <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-amber-400/50 text-xs font-mono text-amber-200 shadow-2xl flex items-center gap-2 animate-pulse">
          <span>🎥 Viewer Mode Active — All UI Disappearing</span>
          <span className="text-[10px] text-stone-300 font-bold bg-stone-800/90 px-2 py-0.5 rounded border border-stone-600">Fn+F4 / F4 to exit</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none font-mono text-white select-none z-10 overflow-hidden">
      
      {/* 1. Crosshair & Circular Mining Indicator */}
      {hasStarted && !isPaused && !isInventoryOpen && !isDead && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <div className="w-5 h-5 relative flex items-center justify-center">
            <div className="w-full h-0.5 bg-white/90 shadow-sm" />
            <div className="h-full w-0.5 bg-white/90 shadow-sm absolute" />
          </div>

          {/* Mining Progress Spinner */}
          {engineStats && engineStats.breakProgress > 0 && (
            <div className="absolute w-12 h-12 rounded-full border-2 border-dashed border-amber-400 animate-spin" />
          )}
        </div>
      )}

      {/* 2. Bed Sleeping Fullscreen Overlay */}
      {isSleeping && (
        <div className="absolute inset-0 bg-stone-950/95 flex flex-col items-center justify-center text-center p-6 space-y-4 z-50 pointer-events-auto transition-opacity duration-700">
          <Moon className="w-16 h-16 text-indigo-300 animate-pulse" />
          <h2 className="text-3xl font-black text-indigo-100 tracking-wider">SLEEPING...</h2>
          <p className="text-sm text-indigo-300 max-w-sm">
            Resting peacefully in bed. Skipping the night until sunrise...
          </p>
          <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
            <Sun className="w-4 h-4 animate-spin" />
            <span>Dawn Approaching</span>
          </div>
        </div>
      )}

      {/* 3. Player Death Screen */}
      {isDead && (
        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-6 z-40 pointer-events-auto">
          <div className="space-y-2">
            <h1 className="text-5xl font-black text-red-500 tracking-widest drop-shadow-lg">YOU DIED!</h1>
            <p className="text-sm text-stone-300">You fell from a high place or ran out of health.</p>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              respawn();
            }}
            className="px-8 py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black rounded-xl text-base tracking-wide flex items-center gap-2 shadow-2xl shadow-red-600/40 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            <span>RESPAWN</span>
          </button>
        </div>
      )}

      {/* 4. F3 Debug & Performance Telemetry */}
      {showDebug && (
        <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/10 text-xs leading-relaxed space-y-1 shadow-2xl pointer-events-auto">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>TEMU CRAFT ENGINE</span>
          </div>
          <div className="text-emerald-400 font-semibold">
            FPS: {engineStats?.fps ?? 60} (avg: {engineStats?.avgFps ?? 60}) | {engineStats?.frameTime ? engineStats.frameTime.toFixed(1) : 16.6} ms
          </div>
          <div className="text-gray-300">
            Chunks Loaded: <span className="text-white font-medium">{engineStats?.loadedChunks ?? 0}</span> | Distance: <span className="text-white font-medium">{renderDistance}</span>
          </div>
          <div className="text-gray-300">
            XYZ: {engineStats?.playerPos ? `${engineStats.playerPos.x.toFixed(1)}, ${engineStats.playerPos.y.toFixed(1)}, ${engineStats.playerPos.z.toFixed(1)}` : '8.0, 40.0, 8.0'}
          </div>
          <div className="text-gray-300">
            Time: <span className="text-amber-200">{timeOfDay < 0.77 ? '☀️ Day (10m)' : '🌙 Night (3m)'}</span> | Preset: <span className="text-cyan-300">{graphicsQuality}</span>
          </div>
          <div className="text-gray-300">
            Mode: <span className="text-purple-300 font-semibold uppercase">{gameMode}</span> | Noclip: <span className={isNoclip ? "text-emerald-400 font-bold" : "text-gray-400"}>{isNoclip ? 'ON (Ghost)' : 'OFF'}</span>
          </div>
          <div className="text-gray-400 text-[10px] pt-1 border-t border-white/10">
            [F3] Overlay | [Fn+F4 / F4] Viewer Mode | [V/N] Go Through Blocks
          </div>
        </div>
      )}

      {/* 5. Survival HUD (Hearts, Food Bar, Oxygen) & Hotbar */}
      {hasStarted && !isDead && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
          
          {/* Selected Item Label Banner */}
          {hotbar[activeHotbarSlot] && (
            <div className="text-xs font-semibold px-3 py-0.5 bg-black/75 backdrop-blur-sm rounded-full text-amber-200 border border-white/15 shadow-lg">
              {getItemName(hotbar[activeHotbarSlot]!.id)}
            </div>
          )}

          {/* Survival Bars (Health, Hunger, Oxygen) */}
          {gameMode === 'survival' && (
            <div className="w-full flex items-center justify-between px-1 text-xs">
              {/* Health Hearts (10 hearts = 20 HP) */}
              <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow">
                {Array.from({ length: 10 }).map((_, i) => {
                  const heartVal = health - i * 2;
                  const isFull = heartVal >= 2;
                  const isHalf = heartVal === 1;
                  return (
                    <Heart
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        isFull
                          ? 'text-red-500 fill-red-500'
                          : isHalf
                          ? 'text-red-400 fill-red-400/50'
                          : 'text-stone-600 fill-stone-800'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Oxygen Bubbles (when submerged) */}
              {oxygen < 10 && (
                <div className="flex items-center gap-0.5 bg-blue-950/80 px-2 py-1 rounded-lg border border-blue-500/30">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < oxygen ? 'bg-cyan-400 border border-cyan-200 animate-pulse' : 'bg-stone-700'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Hunger Drumsticks (10 drumsticks = 20 Hunger) */}
              <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow">
                {Array.from({ length: 10 }).map((_, i) => {
                  const hungerVal = hunger - i * 2;
                  const isFull = hungerVal >= 2;
                  const isHalf = hungerVal === 1;
                  return (
                    <Drumstick
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        isFull
                          ? 'text-amber-500 fill-amber-500'
                          : isHalf
                          ? 'text-amber-400 fill-amber-400/50'
                          : 'text-stone-600 fill-stone-800'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 9 Hotbar Slots + Inventory Button */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 bg-black/65 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-2xl">
              {hotbar.map((stack, i) => {
                const isActive = activeHotbarSlot === i;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setActiveSlot(i);
                      sounds.playClick();
                    }}
                    className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isActive
                        ? 'border-2 border-amber-400 bg-white/25 shadow-lg scale-105'
                        : 'border border-white/15 bg-black/40 hover:bg-white/10'
                    }`}
                  >
                    <span className="absolute top-0.5 left-1 text-[9px] text-gray-400 font-bold">{i + 1}</span>

                    {stack && stack.id !== BLOCKS.AIR && (
                      <>
                        <img
                          src={getItemIcon64(stack.id)}
                          width={64}
                          height={64}
                          className="w-8 h-8 object-contain pixelated drop-shadow"
                          alt={getItemName(stack.id)}
                        />
                        <span className="absolute bottom-0.5 right-1 text-[11px] font-black text-white drop-shadow">
                          {gameMode === 'creative' ? '∞' : stack.count}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Inventory / Crafting Toggle Button (E) */}
            <button
              onClick={() => {
                sounds.playClick();
                toggleInventory();
                if (isInventoryOpen || isCraftingTableOpen) {
                  if (isCraftingTableOpen) setCraftingTableOpen(false);
                  document.querySelector('canvas')?.requestPointerLock();
                } else {
                  if (document.pointerLockElement) {
                    document.exitPointerLock();
                  }
                }
              }}
              className="h-12 px-3.5 bg-black/65 hover:bg-amber-500/20 active:bg-amber-500/40 backdrop-blur-md border border-white/20 hover:border-amber-400/50 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-stone-200 transition-all shadow-xl group cursor-pointer"
              title="Toggle Inventory (E)"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
                <span className="text-[11px] font-black tracking-wider text-amber-300">INV</span>
              </div>
              <span className="text-[9px] font-bold text-stone-400 bg-stone-800 px-1.5 py-0.2 rounded border border-stone-600">E</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Start Screen (Main Menu) */}
      {!hasStarted && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4 z-40 overflow-y-auto">
          <div className="max-w-lg w-full bg-stone-900/95 border border-stone-700 rounded-3xl p-6 shadow-2xl text-center space-y-4 my-auto">
            
            {/* Title & Branding */}
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-black tracking-wider bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                TEMU CRAFT
              </h1>
              <p className="text-xs text-stone-400 font-medium">Realtime Voxel Engine • Supabase Cloud Saves & Multiplayer</p>
            </div>

            {/* Active World Card */}
            <div className="p-3.5 bg-stone-950/90 rounded-2xl border border-amber-500/40 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>Selected World</span>
                </span>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setShowWorldManagerModal(true);
                  }}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase transition-all cursor-pointer ${
                    cloudSyncStatus === 'synced' || currentWorld?.syncedToCloud 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30' 
                      : cloudSyncStatus === 'setup_needed'
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 hover:bg-amber-500/40 animate-pulse'
                        : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                  }`}
                  title={cloudSyncStatus === 'setup_needed' ? "Supabase table setup needed. Click to copy SQL script." : undefined}
                >
                  {cloudSyncStatus === 'synced' || currentWorld?.syncedToCloud 
                    ? '☁️ Supabase Synced' 
                    : cloudSyncStatus === 'setup_needed'
                      ? '⚡ Supabase (Setup SQL)'
                      : '💾 Local Save'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-stone-100 text-base">
                    {currentWorld?.name || (gameMode === 'survival' ? 'Survival World' : 'Creative World')}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Mode: <strong className="text-amber-300 capitalize">{currentWorld?.gameMode || gameMode}</strong> • Seed: <span className="font-mono text-stone-300">{currentWorld?.seed || 'default'}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setShowWorldManagerModal(true);
                  }}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-amber-300 rounded-xl text-xs font-bold border border-stone-700 hover:border-amber-400/50 transition-all cursor-pointer"
                >
                  Change World
                </button>
              </div>
            </div>

            {/* Main Menu Action Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Singleplayer / All Worlds */}
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowWorldManagerModal(true);
                }}
                className="p-3 bg-stone-950/80 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/60 rounded-2xl text-left space-y-1 transition-all group cursor-pointer shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Globe className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">
                    {savedWorlds.filter(w => w.type === 'singleplayer').length} Saved
                  </span>
                </div>
                <div className="font-bold text-stone-200 text-xs">Singleplayer Worlds</div>
                <div className="text-[10px] text-stone-400 leading-tight">Create, load & save worlds in Supabase</div>
              </button>

              {/* Multiplayer */}
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowWorldManagerModal(true);
                }}
                className="p-3 bg-stone-950/80 hover:bg-stone-800 border border-stone-800 hover:border-cyan-500/60 rounded-2xl text-left space-y-1 transition-all group cursor-pointer shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                    {roomPin ? `PIN: ${roomPin}` : 'Realtime'}
                  </span>
                </div>
                <div className="font-bold text-stone-200 text-xs">Multiplayer Worlds</div>
                <div className="text-[10px] text-stone-400 leading-tight">Host or join via PIN with friends</div>
              </button>
            </div>

            {/* Mode Selection */}
            <div className="flex gap-2 p-1 bg-stone-950 rounded-xl border border-stone-800">
              <button
                onClick={() => setGameMode('survival')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  gameMode === 'survival'
                    ? 'bg-amber-500 text-stone-950 shadow'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Survival Mode
              </button>
              <button
                onClick={() => setGameMode('creative')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  gameMode === 'creative'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Creative Mode
              </button>
            </div>

            {/* Controls Preview */}
            <div className="bg-stone-950/80 rounded-xl p-3 text-xs text-stone-300 space-y-1.5 text-left border border-stone-800">
              <div className="font-bold text-amber-300 border-b border-stone-800 pb-1 flex items-center justify-between text-[11px]">
                <span>KEYBOARD CONTROLS</span>
                <span className="text-[10px] text-stone-400">{gameMode === 'survival' ? 'Health & Hunger' : 'Flight & Unlimited Items'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div><span className="text-amber-400 font-bold">W, A, S, D</span> — Move</div>
                <div><span className="text-amber-400 font-bold">SPACE</span> — Jump / Fly Up</div>
                <div><span className="text-amber-400 font-bold">SHIFT</span> — Sprint / Fly Down</div>
                <div><span className="text-amber-400 font-bold">E</span> — Inventory & Crafting</div>
                <div><span className="text-amber-400 font-bold">1 - 9</span> — Hotbar Slots</div>
                <div><span className="text-amber-400 font-bold">V / N</span> — Go Through Blocks</div>
              </div>
            </div>

            {/* Start Playing Button */}
            <button
              onClick={() => {
                sounds.playClick();
                onPlayClick();
              }}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black rounded-2xl text-base tracking-wide flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY WORLD</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Pause Menu (ESC) */}
      {hasStarted && isPaused && !isInventoryOpen && !isDead && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4">
          <div className="max-w-sm w-full bg-stone-900/95 border border-stone-700 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <h2 className="text-2xl font-bold tracking-widest text-stone-100">GAME PAUSED</h2>

            {/* Game Mode Switcher in Pause Menu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                <span className="text-stone-400">
                  Game Mode: {multiplayerMode === 'client' && !isHost ? '(Host Only) 🔒' : ''}
                </span>
                <button
                  disabled={multiplayerMode === 'client' && !isHost}
                  onClick={() => {
                    if (multiplayerMode === 'client' && !isHost) return;
                    sounds.playClick();
                    const nextMode = gameMode === 'survival' ? 'creative' : 'survival';
                    setGameMode(nextMode);
                    if (engine?.player && nextMode === 'survival') {
                      engine.player.isFlying = false;
                      engine.player.inAir = true;
                      engine.player.highestAirY = Math.max(engine.player.highestAirY, engine.player.position.y);
                    }
                    if (engine?.multiplayer && isHost) {
                      engine.multiplayer.broadcastHostSettings({ gameMode: nextMode });
                    }
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    multiplayerMode === 'client' && !isHost ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    gameMode === 'survival' ? 'bg-amber-500 text-stone-950' : 'bg-purple-600 text-white'
                  }`}
                  title={multiplayerMode === 'client' && !isHost ? 'Controlled exclusively by the room Host' : ''}
                >
                  {gameMode.toUpperCase()}
                </button>
              </div>

              {/* Multiplayer Room Status in Pause Menu */}
              {roomPin && (
                <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 text-xs space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 font-bold flex items-center gap-1.5">
                      {isHost ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Users className="w-3.5 h-3.5 text-blue-400" />}
                      <span>ROOM: {roomPin}</span>
                    </span>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setShowMultiplayerModal(true);
                      }}
                      className="text-amber-400 hover:underline text-[11px] font-bold"
                    >
                      Lobby & PIN
                    </button>
                  </div>
                  <div className="text-[11px] text-stone-400 flex items-center justify-between">
                    <span>{connectedPlayers.length || 1} Players Connected</span>
                    <span className="text-emerald-400">● Realtime Sync</span>
                  </div>
                </div>
              )}

              {/* Noclip / Go Through Blocks Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                <span className="text-stone-300 font-medium">Go Through Blocks (Noclip):</span>
                <button
                  onClick={() => {
                    sounds.playClick();
                    toggleNoclip();
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    isNoclip ? 'bg-emerald-500 text-stone-950 shadow' : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {isNoclip ? 'ON (V/N)' : 'OFF (V/N)'}
                </button>
              </div>

              {/* Viewer Mode Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                <span className="text-stone-300 font-medium">Viewer Mode (Hide UI):</span>
                <button
                  onClick={() => {
                    sounds.playClick();
                    toggleViewerMode();
                  }}
                  className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg font-bold border border-amber-500/40"
                >
                  Fn+F4 / F4
                </button>
              </div>

              {/* Mobile Touch Mode Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                <span className="text-stone-300 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Mobile Joystick & Touch Controls:</span>
                </span>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setMobileControls(!isMobileControls);
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    isMobileControls ? 'bg-amber-500 text-stone-950 shadow' : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {isMobileControls ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

            {/* World Persistence Actions */}
            <div className="space-y-2 pt-2 border-t border-stone-800 text-xs">
              <button
                disabled={isSaving}
                onClick={async () => {
                  sounds.playClick();
                  setIsSaving(true);
                  if (engine?.saveCurrentWorld) {
                    const res = await engine.saveCurrentWorld();
                    if (res.needsTableSetup) {
                      setSaveStatusToast('World saved locally 💾 (Supabase table setup needed for Cloud)');
                    } else if (res.cloudSynced) {
                      setSaveStatusToast('World saved & synced to Supabase Cloud ☁️');
                    } else {
                      setSaveStatusToast('World saved locally 💾');
                    }
                    setTimeout(() => setSaveStatusToast(null), 3500);
                  }
                  setIsSaving(false);
                }}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Cloud className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Saving World to Supabase...' : 'Save World to Supabase Cloud'}</span>
              </button>

              {saveStatusToast && (
                <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-center font-bold text-[11px] animate-fadeIn">
                  {saveStatusToast}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    sounds.playClick();
                    setShowWorldManagerModal(true);
                  }}
                  className="py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-all cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>Worlds</span>
                </button>

                <button
                  onClick={async () => {
                    sounds.playClick();
                    if (engine?.saveCurrentWorld) {
                      await engine.saveCurrentWorld();
                    }
                    if (document.pointerLockElement) {
                      document.exitPointerLock();
                    }
                    setPaused(true);
                    setHasStarted(false);
                  }}
                  className="py-2.5 bg-stone-800 hover:bg-red-950/60 text-stone-300 hover:text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Save & Menu</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  onPlayClick();
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
              >
                Back to Game
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  setShowSettingsModal(true);
                }}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium rounded-xl text-xs flex items-center justify-center gap-2 border border-stone-700 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Graphics & Atmosphere Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Settings Modal */}
      {showSettingsModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4 z-30">
          <div className="max-w-md w-full bg-stone-900 border border-stone-700 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <span>SETTINGS & GRAPHICS</span>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Host lock notice for clients */}
              {multiplayerMode === 'client' && !isHost && (
                <div className="p-3 bg-blue-950/70 border border-blue-500/50 rounded-2xl text-blue-200 text-xs flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-cyan-300">Host-Authoritative Settings:</strong> Render distance, graphics quality preset, and celestial time are locked and synchronized directly by the Room Host.
                  </div>
                </div>
              )}

              {/* Render distance */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold text-stone-300">
                  <span>Render Distance {multiplayerMode === 'client' && !isHost ? '(Host Controlled) 🔒' : ''}</span>
                  <span className="text-amber-400 font-bold">{renderDistance} Chunks {renderDistance >= 64 ? '🔥' : ''}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="1024"
                  step="1"
                  disabled={multiplayerMode === 'client' && !isHost}
                  value={renderDistance}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSettings({ renderDistance: val });
                    if (engine?.multiplayer && isHost) {
                      engine.multiplayer.broadcastHostSettings({ renderDistance: val });
                    }
                  }}
                  className={`w-full accent-amber-500 ${multiplayerMode === 'client' && !isHost ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>2 Chunks</span>
                  <span>16</span>
                  <span>64</span>
                  <span>256</span>
                  <span className="text-amber-400 font-bold">1024 Chunks</span>
                </div>
              </div>

              {/* Graphics Quality */}
              <div className="space-y-1.5">
                <label className="font-semibold text-stone-300">
                  Graphics & Realism Preset {multiplayerMode === 'client' && !isHost ? '(Host Controlled) 🔒' : ''}
                </label>
                <select
                  disabled={multiplayerMode === 'client' && !isHost}
                  value={graphicsQuality}
                  onChange={(e) => {
                    const val = e.target.value as GraphicsQuality;
                    setSettings({ graphicsQuality: val });
                    if (engine?.multiplayer && isHost) {
                      engine.multiplayer.broadcastHostSettings({ graphicsQuality: val });
                    }
                  }}
                  className={`w-full bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-200 outline-none ${
                    multiplayerMode === 'client' && !isHost ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="Very Low">Very Low (Max Performance, No Shadows)</option>
                  <option value="Low">Low (Simple Lighting)</option>
                  <option value="Medium">Medium (Soft Shadows & Ambient Occlusion)</option>
                  <option value="High">High (PBR Materials + Raymarched Clouds)</option>
                  <option value="Very High">Very High (High-Res Normal Maps & Soft Shadows)</option>
                  <option value="Ultra">Ultra (4K Shadow Maps & Silver-Lining Clouds)</option>
                  <option value="Cinematic">Cinematic (Max Visual Realism & ACES Filmic Tone Mapping)</option>
                  <option value="Real Life Resolution">💥 Real Life Resolution (2048x2048 Textures, 8K Shadows, RTX 5090 Tier)</option>
                </select>
              </div>

              {/* FPS Limit */}
              <div className="space-y-1.5">
                <label className="font-semibold text-stone-300">Max Framerate</label>
                <select
                  value={fpsLimit}
                  onChange={(e) => setSettings({ fpsLimit: parseInt(e.target.value) })}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-2.5 text-stone-200 outline-none"
                >
                  <option value="0">Unlimited</option>
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                  <option value="120">120 FPS</option>
                  <option value="144">144 FPS</option>
                  <option value="165">165 FPS</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                sounds.playClick();
                setShowSettingsModal(false);
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition-all"
            >
              Done & Save
            </button>
          </div>
        </div>
      )}

      {/* 9. Inventory, Crafting, and Creative Menu (E) */}
      {isInventoryOpen && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4 z-20">
          <div className="max-w-3xl w-full bg-stone-900 border border-stone-700 rounded-3xl p-6 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span>
                  {isCraftingTableOpen
                    ? '3x3 CRAFTING TABLE'
                    : gameMode === 'creative'
                    ? 'CREATIVE ITEM CATALOG'
                    : 'SURVIVAL INVENTORY & 2x2 CRAFTING'}
                </span>
              </div>
              <button
                onClick={handleCloseInventory}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Held Item Floating Bar */}
            {heldItem && (
              <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl p-2.5 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2 font-bold">
                  <img
                    src={getItemIcon64(heldItem.id)}
                    className="w-6 h-6 object-contain pixelated"
                    alt=""
                  />
                  <span>Holding: {heldItem.count}x {getItemName(heldItem.id)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPlaceSingleMode(!placeSingleMode)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      placeSingleMode ? 'bg-amber-400 text-stone-950 border-amber-300' : 'bg-stone-800 text-stone-300 border-stone-700'
                    }`}
                  >
                    {placeSingleMode ? 'Mode: Place 1 per click' : 'Mode: Place All'}
                  </button>
                  <button
                    onClick={() => {
                      addToInventory(heldItem.id, heldItem.count);
                      setHeldItem(null);
                      sounds.playClick();
                    }}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold border border-stone-700"
                  >
                    Put Back
                  </button>
                </div>
              </div>
            )}

            {/* Creative Mode Tabs */}
            {gameMode === 'creative' && !isCraftingTableOpen && (
              <div className="flex gap-2 border-b border-stone-800 pb-2 text-xs">
                {(['blocks', 'tools', 'ores', 'food'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCreativeTab(tab)}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all ${
                      creativeTab === tab ? 'bg-purple-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Left Column: Inventory / Creative Catalog */}
              <div className="space-y-3">
                {gameMode === 'creative' && !isCraftingTableOpen ? (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-stone-400">CLICK ITEM TO ADD TO HOTBAR</div>
                    <div className="grid grid-cols-6 gap-2 bg-stone-950/90 p-3 rounded-2xl border border-stone-800 max-h-56 overflow-y-auto">
                      {(creativeTab === 'blocks'
                        ? creativeBlocks
                        : creativeTab === 'tools'
                        ? creativeTools
                        : creativeTab === 'ores'
                        ? creativeOres
                        : creativeFood
                      ).map((itemId) => (
                        <div
                          key={itemId}
                          onClick={() => {
                            addToInventory(itemId, 64);
                            sounds.playClick();
                          }}
                          className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-400 flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                          title={getItemName(itemId)}
                        >
                          <img
                            src={getItemIcon64(itemId)}
                            width={64}
                            height={64}
                            className="w-9 h-9 object-contain pixelated drop-shadow"
                            alt={getItemName(itemId)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-stone-400">BACKPACK (27 SLOTS)</div>
                    <div className="grid grid-cols-9 gap-1 bg-stone-950/90 p-2.5 rounded-2xl border border-stone-800">
                      {backpack.map((stack, i) => (
                        <div
                          key={i}
                          onClick={() => handleSlotClick(stack, (newStack) => useGameStore.getState().setSlotItem('backpack', i, newStack))}
                          className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-400 flex items-center justify-center relative cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title={stack ? getItemName(stack.id) : 'Empty Slot'}
                        >
                          {stack && (
                            <>
                              <img
                                src={getItemIcon64(stack.id)}
                                width={64}
                                height={64}
                                className="w-7 h-7 object-contain pixelated drop-shadow pointer-events-none"
                                alt={getItemName(stack.id)}
                              />
                              <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white pointer-events-none drop-shadow">
                                {stack.count}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="text-xs font-bold text-stone-400 pt-1">HOTBAR (9 SLOTS)</div>
                    <div className="grid grid-cols-9 gap-1 bg-stone-950/90 p-2.5 rounded-2xl border border-stone-800">
                      {hotbar.map((stack, i) => (
                        <div
                          key={i}
                          onClick={() => handleSlotClick(stack, (newStack) => useGameStore.getState().setSlotItem('hotbar', i, newStack))}
                          className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-400 flex items-center justify-center relative cursor-pointer transition-all hover:scale-105 active:scale-95"
                          title={stack ? getItemName(stack.id) : 'Empty Slot'}
                        >
                          {stack && (
                            <>
                              <img
                                src={getItemIcon64(stack.id)}
                                width={64}
                                height={64}
                                className="w-7 h-7 object-contain pixelated drop-shadow pointer-events-none"
                                alt={getItemName(stack.id)}
                              />
                              <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white pointer-events-none drop-shadow">
                                {stack.count}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: 2x2 or 3x3 Grid Crafting */}
              <div className="space-y-3 bg-stone-950/90 p-4 rounded-2xl border border-stone-800">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>{isCraftingTableOpen ? '3x3 CRAFTING GRID' : '2x2 CRAFTING GRID'}</span>
                  </span>
                  <button
                    onClick={clearAndReturnGrid}
                    className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] flex items-center gap-1 border border-stone-700 transition-all"
                    title="Return grid items to inventory"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Clear Grid</span>
                  </button>
                </div>

                {/* Grid Layout + Arrow + Output Box */}
                <div className="flex items-center justify-center gap-4 py-2">
                  {/* 2x2 or 3x3 Input Grid */}
                  <div
                    onTouchMove={handleGridTouchMove}
                    className={`grid gap-1.5 p-2 bg-stone-900/90 rounded-2xl border border-stone-700 select-none ${
                      isCraftingTableOpen ? 'grid-cols-3' : 'grid-cols-2'
                    }`}
                  >
                    {Array.from({ length: isCraftingTableOpen ? 9 : 4 }).map((_, slotIdx) => {
                      const stack = craftingGrid[slotIdx];
                      return (
                        <div
                          key={slotIdx}
                          data-craft-slot={slotIdx}
                          onClick={() =>
                            handleSlotClick(stack, (newStack) => {
                              const nextGrid = [...craftingGrid];
                              nextGrid[slotIdx] = newStack;
                              setCraftingGrid(nextGrid);
                            })
                          }
                          onMouseEnter={() => {
                            if (heldItem && (isMouseDown || placeSingleMode)) {
                              handleCellEnterOrDrag(slotIdx);
                            }
                          }}
                          onMouseLeave={() => {
                            if (lastVisitedSlotRef.current === slotIdx) {
                              lastVisitedSlotRef.current = null;
                            }
                          }}
                          className="w-12 h-12 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-400 flex items-center justify-center relative cursor-pointer transition-all hover:scale-105 active:scale-95 select-none"
                          title={stack ? getItemName(stack.id) : 'Empty Crafting Cell'}
                        >
                          {stack && (
                            <>
                              <img
                                src={getItemIcon64(stack.id)}
                                width={64}
                                height={64}
                                className="w-8 h-8 object-contain pixelated drop-shadow pointer-events-none"
                                alt={getItemName(stack.id)}
                              />
                              <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white pointer-events-none">
                                {stack.count}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center gap-1 text-stone-500">
                    <ArrowRight className="w-6 h-6 text-amber-400 animate-pulse" />
                  </div>

                  {/* Crafting Result Output Slot */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-stone-400">RESULT</span>
                    <div
                      onClick={handleTakeCraftResult}
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center relative transition-all ${
                        craftingOutput
                          ? 'bg-amber-500/20 border-2 border-amber-400 hover:border-amber-300 shadow-lg shadow-amber-500/20 cursor-pointer scale-105 animate-pulse'
                          : 'bg-stone-950 border border-stone-800 opacity-60 cursor-not-allowed'
                      }`}
                      title={craftingOutput ? `Click to take ${craftingOutput.count}x ${getItemName(craftingOutput.id)}` : 'Arrange items in grid to craft'}
                    >
                      {craftingOutput && (
                        <>
                          <img
                            src={getItemIcon64(craftingOutput.id)}
                            width={64}
                            height={64}
                            className="w-10 h-10 object-contain pixelated drop-shadow"
                            alt={getItemName(craftingOutput.id)}
                          />
                          <span className="absolute bottom-1 right-1.5 text-xs font-black text-amber-300 drop-shadow">
                            {craftingOutput.count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Guidance / Instructions */}
                <div className="text-[10px] text-stone-400 text-center leading-relaxed bg-stone-900/50 p-2 rounded-xl border border-stone-800">
                  💡 <span className="text-amber-300 font-semibold">Grid Crafting:</span> Tap items in Backpack to pick up, then place into grid cells!
                  <br />
                  <span className="text-stone-300">
                    • 1 Log → 4 Planks &nbsp;|&nbsp; 2 Planks vertical → Sticks &nbsp;|&nbsp; 4 Planks → Crafting Table
                    <br />
                    • 8 Cobblestone border → Furnace &nbsp;|&nbsp; 3 Planks + 2 Sticks → Pickaxe
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-stone-400 text-center border-t border-stone-800 pt-2">
              Press [E] or [ESC] to return to the game
            </div>
          </div>
        </div>
      )}

      {/* Furnace Smelting Modal */}
      <FurnaceModal />

      {/* Mobile Touch Joystick and Action Controls */}
      <MobileControls engine={engine} />

      {/* Multiplayer In-Game HUD Header */}
      {roomPin && hasStarted && (
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2 pointer-events-auto z-20 font-mono">
          <div className="bg-stone-900/90 border border-stone-700/80 rounded-2xl px-3.5 py-2 backdrop-blur-md shadow-2xl flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              {isHost ? <Crown className="w-4 h-4 text-amber-400" /> : <Users className="w-4 h-4 text-cyan-400" />}
              <span className="text-stone-200">{connectedPlayers.length || 1} Online</span>
            </div>
            <div className="h-3 w-[1px] bg-stone-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-stone-400 text-[10px] uppercase font-bold">PIN:</span>
              <span className="font-mono font-black text-amber-400 tracking-wider text-sm">{roomPin}</span>
              <button
                onClick={() => {
                  sounds.playClick();
                  navigator.clipboard.writeText(roomPin);
                  setCopiedHudPin(true);
                  setTimeout(() => setCopiedHudPin(false), 2000);
                }}
                title="Copy Room PIN"
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors"
              >
                {copiedHudPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={() => {
                sounds.playClick();
                setShowMultiplayerModal(true);
              }}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-xl text-[10px] font-bold border border-stone-700 transition-colors"
            >
              Lobby
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setShowChatBox((prev) => !prev);
              }}
              title="Open Chat (T)"
              className={`p-1.5 rounded-lg border transition-colors ${
                showChatBox ? 'bg-amber-500 text-stone-950 border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Multiplayer Toast Notifications */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-none">
            {multiplayerNotifications.slice(-4).map((notif, idx) => (
              <div
                key={idx}
                className="bg-stone-900/95 border border-amber-500/40 text-amber-200 px-3 py-1 rounded-xl text-[11px] font-semibold backdrop-blur-md shadow-lg"
              >
                {notif}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-Game Chat Box */}
      {roomPin && showChatBox && hasStarted && (
        <div className="absolute bottom-28 left-4 w-80 bg-stone-950/95 border border-stone-700 rounded-2xl p-3 shadow-2xl backdrop-blur-md pointer-events-auto z-30 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 text-stone-400 font-bold text-[11px]">
            <span className="flex items-center gap-1.5 text-amber-400">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WORLD CHAT</span>
            </span>
            <button
              onClick={() => setShowChatBox(false)}
              className="p-0.5 hover:bg-stone-800 rounded text-stone-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] pr-1">
            {chatMessages.length === 0 ? (
              <div className="text-stone-500 italic py-2 text-center text-[10px]">No messages yet. Say hello!</div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="leading-tight">
                  <span className={`font-bold mr-1 ${msg.isHost ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {msg.isHost ? '👑 ' : ''}{msg.name}:
                  </span>
                  <span className="text-stone-200">{msg.text}</span>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim() || !engine) return;
              engine.multiplayer.sendChatMessage(chatInput.trim());
              setChatInput('');
            }}
            className="flex gap-1 pt-1"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message (Enter)..."
              maxLength={120}
              className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-amber-400"
              autoFocus
            />
            <button
              type="submit"
              className="p-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Multiplayer Setup & Lobby Modal */}
      <MultiplayerModal
        engine={engine}
        isOpen={showMultiplayerModal}
        onClose={() => setShowMultiplayerModal(false)}
        onStartPlaying={() => {
          setShowMultiplayerModal(false);
          onPlayClick();
        }}
      />

      {/* World Manager & Supabase Cloud Saves Modal */}
      <WorldManagerModal
        engine={engine}
        isOpen={showWorldManagerModal}
        onClose={() => setShowWorldManagerModal(false)}
        onStartPlaying={() => {
          setShowWorldManagerModal(false);
          onPlayClick();
        }}
      />

      {/* Floating Held Item attached to mouse/finger cursor during drag & place */}
      {heldItem && pointerPos && (
        <div
          className="fixed pointer-events-none z-[100] flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pointerPos.x}px`, top: `${pointerPos.y}px` }}
        >
          <div className="w-12 h-12 bg-amber-500/30 border-2 border-amber-400 rounded-xl shadow-2xl backdrop-blur-sm flex items-center justify-center relative animate-pulse">
            <img
              src={getItemIcon64(heldItem.id)}
              className="w-9 h-9 object-contain pixelated drop-shadow"
              alt=""
            />
            <span className="absolute bottom-0 right-1 text-xs font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
              {heldItem.count}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
