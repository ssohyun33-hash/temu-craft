import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { ChevronUp, ChevronDown, Pickaxe, Box, Eye, Sparkles } from 'lucide-react';

interface MobileControlsProps {
  engine: any;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ engine }) => {
  const { isMobileControls, isViewerMode, isNoclip, toggleNoclip, toggleInventory, hotbar, activeHotbarSlot, setActiveSlot } = useGameStore();

  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  // Interaction mode: 'mine' or 'place'
  const [mobileInteractionMode, setMobileInteractionMode] = useState<'mine' | 'place'>('mine');

  // Long-press breaking radial circle state
  const [breakProgress, setBreakProgress] = useState(0); // 0 to 100
  const [breakPos, setBreakPos] = useState<{ x: number; y: number } | null>(null);
  const breakTimerRef = useRef<any>(null);
  const lastJumpTapRef = useRef<number>(0);

  if (!isMobileControls || isViewerMode) return null;

  // Virtual Joystick Handlers
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.targetTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickCenterRef.current = { x: centerX, y: centerY };
    touchIdRef.current = touch.identifier;
    setIsJoystickActive(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isJoystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    touchIdRef.current = null;
    if (engine?.keys) {
      engine.keys['w'] = false;
      engine.keys['s'] = false;
      engine.keys['a'] = false;
      engine.keys['d'] = false;
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const maxRadius = 45;
    const dx = clientX - joystickCenterRef.current.x;
    const dy = clientY - joystickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);

    let clampX = dx;
    let clampY = dy;
    if (dist > maxRadius) {
      clampX = (dx / dist) * maxRadius;
      clampY = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: clampX, y: clampY });

    if (engine?.keys) {
      const threshold = 12;
      engine.keys['w'] = clampY < -threshold;
      engine.keys['s'] = clampY > threshold;
      engine.keys['a'] = clampX < -threshold;
      engine.keys['d'] = clampX > threshold;
    }
  };

  // Jump & Flight Toggle Button Handler
  const handleJumpPress = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (engine?.keys) {
      engine.keys[' '] = true;
    }

    // Double-tap jump button logic (toggle Flight in Creative Mode / Noclip)
    const now = Date.now();
    if (now - lastJumpTapRef.current < 300) {
      const state = useGameStore.getState();
      if (state.gameMode === 'creative' && engine?.player) {
        engine.player.isFlying = !engine.player.isFlying;
      } else if (engine?.player) {
        engine.player.isFlying = false;
      }
    }
    lastJumpTapRef.current = now;
  };

  const handleJumpRelease = (e: React.TouchEvent) => {
    e.preventDefault();
    if (engine?.keys) {
      engine.keys[' '] = false;
    }
  };

  const handleCrouchPress = (e: React.TouchEvent) => {
    e.preventDefault();
    if (engine?.keys) {
      engine.keys['shift'] = true;
    }
  };

  const handleCrouchRelease = (e: React.TouchEvent) => {
    e.preventDefault();
    if (engine?.keys) {
      engine.keys['shift'] = false;
    }
  };

  // Canvas Long-Press Touch Mining Handler
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.mobile-ui-interactive')) return;

    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };

    if (mobileInteractionMode === 'mine') {
      setBreakPos(pos);
      setBreakProgress(0);

      // Trigger arm swing & target raycast
      if (engine) {
        engine.handleLeftClick();
      }

      let p = 0;
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = setInterval(() => {
        p += 5;
        setBreakProgress(Math.min(100, p));
        if (p >= 100) {
          clearInterval(breakTimerRef.current);
          if (engine) {
            engine.breakTargetBlock();
          }
          setBreakPos(null);
          setBreakProgress(0);
        }
      }, 30);
    } else {
      // Place mode / interact
      if (engine) {
        engine.handleRightClick();
      }
    }
  };

  const handleCanvasTouchEnd = () => {
    clearInterval(breakTimerRef.current);
    setBreakPos(null);
    setBreakProgress(0);
    if (engine) {
      engine.isBreaking = false;
    }
  };

  return (
    <div
      className="absolute inset-0 pointer-events-auto select-none z-20 overflow-hidden"
      onTouchStart={handleCanvasTouchStart}
      onTouchEnd={handleCanvasTouchEnd}
      onTouchCancel={handleCanvasTouchEnd}
    >
      {/* 1. Left Bottom Analog Joystick */}
      <div
        className="mobile-ui-interactive absolute bottom-6 left-6 w-32 h-32 rounded-full bg-black/40 border-2 border-white/30 backdrop-blur-md flex items-center justify-center touch-none shadow-2xl"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
      >
        <div
          className="w-14 h-14 rounded-full bg-amber-400/80 border-2 border-amber-200 shadow-xl transition-transform duration-75"
          style={{
            transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
          }}
        />
      </div>

      {/* 2. Right Bottom Action Buttons (Jump & Crouch/Fly Down) */}
      <div className="mobile-ui-interactive absolute bottom-6 right-6 flex items-end gap-3 touch-none">
        {/* Crouch / Fly Down */}
        <button
          onTouchStart={handleCrouchPress}
          onTouchEnd={handleCrouchRelease}
          onTouchCancel={handleCrouchRelease}
          className="w-14 h-14 rounded-full bg-black/60 border-2 border-white/20 active:bg-amber-500/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl"
        >
          <ChevronDown className="w-8 h-8" />
        </button>

        {/* Jump / Double-Tap Fly Button */}
        <button
          onTouchStart={handleJumpPress}
          onTouchEnd={handleJumpRelease}
          onTouchCancel={handleJumpRelease}
          className="w-20 h-20 rounded-full bg-amber-500/80 border-2 border-amber-300 active:bg-amber-400 backdrop-blur-md flex flex-col items-center justify-center text-stone-950 font-extrabold shadow-2xl"
        >
          <ChevronUp className="w-9 h-9" />
          <span className="text-[10px] tracking-tight font-sans">JUMP</span>
        </button>
      </div>

      {/* 3. Top Mode Toggle Controls (Mine / Place / Noclip) */}
      <div className="mobile-ui-interactive absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setMobileInteractionMode(mobileInteractionMode === 'mine' ? 'place' : 'mine')}
          className={`px-3 py-2 rounded-xl text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 shadow-lg ${
            mobileInteractionMode === 'mine'
              ? 'bg-amber-500/90 text-stone-950 border-amber-300'
              : 'bg-emerald-600/90 text-white border-emerald-400'
          }`}
        >
          {mobileInteractionMode === 'mine' ? (
            <>
              <Pickaxe className="w-4 h-4" />
              <span>MINE MODE</span>
            </>
          ) : (
            <>
              <Box className="w-4 h-4" />
              <span>PLACE MODE</span>
            </>
          )}
        </button>

        <button
          onClick={toggleInventory}
          className="p-2 bg-stone-900/90 text-amber-300 border border-stone-700 rounded-xl backdrop-blur-md shadow-lg"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* 4. Radial Expanding Breaking Circle (Follows touch point during long press) */}
      {breakPos && (
        <div
          className="pointer-events-none fixed z-50 transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: breakPos.x, top: breakPos.y }}
        >
          <svg className="w-20 h-20 overflow-visible">
            {/* Outer faint ring */}
            <circle
              cx="40"
              cy="40"
              r="32"
              className="stroke-white/30 fill-black/20"
              strokeWidth="4"
            />
            {/* Expanding radial progress circle */}
            <circle
              cx="40"
              cy="40"
              r="32"
              className="stroke-amber-400 fill-amber-400/20 transition-all duration-75"
              strokeWidth="6"
              strokeDasharray={201}
              strokeDashoffset={201 - (201 * breakProgress) / 100}
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
