import React from 'react';
import { useGameStore, ItemStack } from '../store/gameStore';
import { ITEM_DEFS, BLOCK_DEFS, BLOCKS, ITEMS } from '../engine/blocks';
import { getItemIcon64 } from '../engine/ItemIconGenerator';
import { Flame, X, ArrowRight, Sparkles, ChefHat } from 'lucide-react';
import { sounds } from '../engine/sound/SoundManager';

export const FurnaceModal: React.FC = () => {
  const {
    isFurnaceOpen,
    setFurnaceOpen,
    furnaceInput,
    furnaceFuel,
    furnaceOutput,
    setFurnaceSlot,
    smeltFurnace,
    hotbar,
    backpack,
    addToInventory
  } = useGameStore();

  if (!isFurnaceOpen) return null;

  const getItemName = (id: number) => {
    if (id in ITEM_DEFS) return ITEM_DEFS[id].name;
    if (id in BLOCK_DEFS) return BLOCK_DEFS[id].name;
    return 'Item';
  };

  const handleSmeltClick = () => {
    const success = smeltFurnace();
    if (success) {
      sounds.playClick();
    }
  };

  const handleTakeOutput = () => {
    if (!furnaceOutput) return;
    const added = addToInventory(furnaceOutput.id, furnaceOutput.count);
    if (added) {
      sounds.playClick();
      setFurnaceSlot('output', null);
    }
  };

  // Helper to place item from inventory into Input or Fuel slot
  const handleInventoryItemClick = (stack: ItemStack, isFromHotbar: boolean, index: number) => {
    // If it's a fuel item (Coal, Wood, Planks, Stick) and fuel slot is empty, put in fuel
    const isFuel = stack.id === ITEMS.COAL_ITEM || stack.id === BLOCKS.OAK_LOG || stack.id === BLOCKS.OAK_PLANKS || stack.id === ITEMS.STICK;

    if (!furnaceInput) {
      setFurnaceSlot('input', { id: stack.id, count: stack.count });
      useGameStore.getState().setSlotItem(isFromHotbar ? 'hotbar' : 'backpack', index, null);
      sounds.playClick();
    } else if (isFuel && !furnaceFuel) {
      setFurnaceSlot('fuel', { id: stack.id, count: stack.count });
      useGameStore.getState().setSlotItem(isFromHotbar ? 'hotbar' : 'backpack', index, null);
      sounds.playClick();
    } else {
      // Swap input slot
      const prevInput = furnaceInput;
      setFurnaceSlot('input', { id: stack.id, count: stack.count });
      useGameStore.getState().setSlotItem(isFromHotbar ? 'hotbar' : 'backpack', index, prevInput);
      sounds.playClick();
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4 z-40">
      <div className="max-w-2xl w-full bg-stone-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="font-extrabold text-xl bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-500 animate-pulse" />
            <span>FURNACE & SMELTER</span>
          </div>
          <button
            onClick={() => setFurnaceOpen(false)}
            className="p-1.5 hover:bg-stone-800 rounded-xl text-stone-400 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Furnace Chamber & Cooking Slots */}
        <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-around gap-6 shadow-inner">
          {/* Left: Input & Fuel */}
          <div className="flex flex-col items-center gap-4">
            {/* Input Slot */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">INPUT (Ores / Meat)</span>
              <div
                onClick={() => {
                  if (furnaceInput) {
                    addToInventory(furnaceInput.id, furnaceInput.count);
                    setFurnaceSlot('input', null);
                    sounds.playClick();
                  }
                }}
                className="w-16 h-16 rounded-2xl bg-stone-900 border-2 border-stone-700 hover:border-amber-400 flex flex-col items-center justify-center cursor-pointer relative shadow-lg transition-all"
              >
                {furnaceInput ? (
                  <>
                    <img
                      src={getItemIcon64(furnaceInput.id)}
                      width={64}
                      height={64}
                      className="w-10 h-10 object-contain pixelated drop-shadow-md"
                      alt={getItemName(furnaceInput.id)}
                    />
                    <span className="text-xs font-bold text-white mt-1">{getItemName(furnaceInput.id)}</span>
                    <span className="absolute bottom-1 right-1.5 text-xs font-extrabold text-amber-300 bg-black/80 px-1 rounded">
                      x{furnaceInput.count}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-stone-600 font-bold">EMPTY</span>
                )}
              </div>
            </div>

            {/* Fire Flame Icon */}
            <Flame className={`w-6 h-6 ${furnaceFuel ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-stone-700'}`} />

            {/* Fuel Slot */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">FUEL (Coal / Wood)</span>
              <div
                onClick={() => {
                  if (furnaceFuel) {
                    addToInventory(furnaceFuel.id, furnaceFuel.count);
                    setFurnaceSlot('fuel', null);
                    sounds.playClick();
                  }
                }}
                className="w-16 h-16 rounded-2xl bg-stone-900 border-2 border-stone-700 hover:border-amber-400 flex flex-col items-center justify-center cursor-pointer relative shadow-lg transition-all"
              >
                {furnaceFuel ? (
                  <>
                    <img
                      src={getItemIcon64(furnaceFuel.id)}
                      width={64}
                      height={64}
                      className="w-10 h-10 object-contain pixelated drop-shadow-md"
                      alt={getItemName(furnaceFuel.id)}
                    />
                    <span className="text-[10px] font-bold text-white mt-1 truncate max-w-[50px]">{getItemName(furnaceFuel.id)}</span>
                    <span className="absolute bottom-1 right-1.5 text-xs font-extrabold text-amber-300 bg-black/80 px-1 rounded">
                      x{furnaceFuel.count}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-stone-600 font-bold">EMPTY</span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Smelt Action Button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleSmeltClick}
              disabled={!furnaceInput || !furnaceFuel}
              className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl transition-all ${
                furnaceInput && furnaceFuel
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 hover:scale-105 active:scale-95 cursor-pointer'
                  : 'bg-stone-800 text-stone-600 cursor-not-allowed'
              }`}
            >
              <ChefHat className="w-5 h-5" />
              <span>IGNITE & SMELT</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-stone-400 font-medium max-w-[180px] text-center">
              Melt Iron/Gold Nuggets into Ingots or Cook Raw Meats!
            </span>
          </div>

          {/* Right: Output Slot */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">RESULT (Ingots / Food)</span>
            <div
              onClick={handleTakeOutput}
              className="w-20 h-20 rounded-2xl bg-stone-900 border-2 border-emerald-500/50 hover:border-emerald-400 flex flex-col items-center justify-center cursor-pointer relative shadow-2xl transition-all"
            >
              {furnaceOutput ? (
                <>
                  <img
                    src={getItemIcon64(furnaceOutput.id)}
                    width={64}
                    height={64}
                    className="w-12 h-12 object-contain pixelated drop-shadow-xl animate-bounce"
                    alt={getItemName(furnaceOutput.id)}
                  />
                  <span className="text-xs font-bold text-emerald-300 mt-1">{getItemName(furnaceOutput.id)}</span>
                  <span className="absolute bottom-1 right-1.5 text-xs font-extrabold text-emerald-200 bg-black/80 px-1.5 rounded">
                    x{furnaceOutput.count}
                  </span>
                </>
              ) : (
                <Sparkles className="w-6 h-6 text-stone-700" />
              )}
            </div>
          </div>
        </div>

        {/* Quick Click Inventory Grid */}
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">
            Click Item from Inventory to Load Furnace:
          </span>
          <div className="grid grid-cols-9 gap-1.5 bg-stone-950/80 p-3 rounded-2xl border border-stone-800 max-h-40 overflow-y-auto">
            {hotbar.map((stack, i) =>
              stack ? (
                <div
                  key={`hotbar-${i}`}
                  onClick={() => handleInventoryItemClick(stack, true, i)}
                  className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-400 flex items-center justify-center cursor-pointer transition-all hover:scale-105 relative"
                  title={getItemName(stack.id)}
                >
                  <img
                    src={getItemIcon64(stack.id)}
                    width={64}
                    height={64}
                    className="w-8 h-8 object-contain pixelated drop-shadow"
                    alt={getItemName(stack.id)}
                  />
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-amber-300">
                    {stack.count}
                  </span>
                </div>
              ) : null
            )}
            {backpack.map((stack, i) =>
              stack ? (
                <div
                  key={`backpack-${i}`}
                  onClick={() => handleInventoryItemClick(stack, false, i)}
                  className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-400 flex items-center justify-center cursor-pointer transition-all hover:scale-105 relative"
                  title={getItemName(stack.id)}
                >
                  <img
                    src={getItemIcon64(stack.id)}
                    width={64}
                    height={64}
                    className="w-8 h-8 object-contain pixelated drop-shadow"
                    alt={getItemName(stack.id)}
                  />
                  <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-amber-300">
                    {stack.count}
                  </span>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
