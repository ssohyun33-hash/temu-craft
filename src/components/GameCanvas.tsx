import React, { useEffect, useRef, useState } from 'react';
import { VoxelEngine } from '../engine/VoxelEngine';
import { UI } from './UI';
import { useGameStore } from '../store/gameStore';
import { WorldStorage } from '../engine/storage/WorldStorage';

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const { graphicsQuality, setHasStarted } = useGameStore();

  const [stats, setStats] = useState({
    fps: 60,
    avgFps: 60,
    frameTime: 16.6,
    loadedChunks: 0,
    playerPos: { x: 8, y: 40, z: 8 },
    isSubmerged: false,
    isFlying: false,
    breakProgress: 0,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new VoxelEngine(canvasRef.current);
    engine.start();
    engineRef.current = engine;

    // Load active world if available, otherwise initialize default
    const state = useGameStore.getState();
    const localWorlds = WorldStorage.getLocalWorlds();
    if (localWorlds.length > 0 && !state.currentWorld) {
      state.setCurrentWorld(localWorlds[0]);
      engine.loadSavedWorld(localWorlds[0]);
    }

    // Telemetry polling interval for React UI (10Hz)
    const timer = setInterval(() => {
      if (engineRef.current) {
        const eng = engineRef.current;
        setStats({
          fps: eng.fps,
          avgFps: eng.avgFps,
          frameTime: eng.frameTime,
          loadedChunks: eng.world.getLoadedChunkCount(),
          playerPos: {
            x: eng.player.position.x,
            y: eng.player.position.y,
            z: eng.player.position.z,
          },
          isSubmerged: eng.player.isSubmerged,
          isFlying: eng.player.isFlying,
          breakProgress: eng.breakProgress,
        });
      }
    }, 100);

    return () => {
      clearInterval(timer);
      engine.stop();
      engine.renderer.dispose();
    };
  }, []);

  // Update graphics quality
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.applyQuality(graphicsQuality);
    }
  }, [graphicsQuality]);

  const handlePlayClick = () => {
    const state = useGameStore.getState();
    const eng = engineRef.current;
    
    // Ensure active world exists in state and is saved
    if (eng && !state.currentWorld) {
      const defaultWorld = WorldStorage.createDefaultWorld(
        state.multiplayerMode === 'offline' ? 'singleplayer' : 'multiplayer',
        state.multiplayerMode === 'offline' ? 'Survival World' : `Room #${state.roomPin || 'Multiplayer'}`,
        eng.world.generator.seed || 'seed_default',
        state.gameMode,
        state.roomPin || undefined
      );
      state.setCurrentWorld(defaultWorld);
      WorldStorage.saveWorld(defaultWorld).catch(() => {});
    }

    state.setHasStarted(true);
    state.setPaused(false);

    if (canvasRef.current && !state.isMobileControls) {
      try {
        const promise = canvasRef.current.requestPointerLock();
        if (promise && typeof (promise as any).catch === 'function') {
          (promise as any).catch(() => {
            // pointer lock error ignored
          });
        }
      } catch (err) {
        // pointer lock not allowed or supported
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block touch-none cursor-crosshair"
        onContextMenu={(e) => e.preventDefault()}
      />
      <UI engineStats={stats} engine={engineRef.current} onPlayClick={handlePlayClick} />
    </div>
  );
};
