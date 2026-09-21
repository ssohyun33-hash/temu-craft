import * as THREE from 'three';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { RemotePlayerMesh } from './RemotePlayerMesh';
import { useGameStore, GraphicsQuality, GameMode } from '../../store/gameStore';
import { World } from '../world/World';
import { ParticleSystem } from '../particles/ParticleSystem';
import { sounds } from '../sound/SoundManager';
import { BLOCKS } from '../blocks';

export interface PlayerPosPayload {
  peerId: string;
  name: string;
  isHost: boolean;
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  heldItem: number;
  isMoving: boolean;
  isSprinting: boolean;
}

export interface BlockChangePayload {
  x: number;
  y: number;
  z: number;
  blockId: number;
  peerId: string;
}

export interface HostSettingsPayload {
  graphicsQuality: GraphicsQuality;
  renderDistance: number;
  timeOfDay: number;
  gameMode: GameMode;
}

export interface SyncResponsePayload {
  targetPeerId: string;
  blocks: { x: number; y: number; z: number; blockId: number }[];
  timeOfDay: number;
  gameMode: GameMode;
  graphicsQuality: GraphicsQuality;
  renderDistance: number;
}

export interface ChatMessagePayload {
  id: string;
  peerId: string;
  name: string;
  isHost: boolean;
  text: string;
  time: string;
}

export class MultiplayerManager {
  peerId: string;
  playerName: string;
  pin: string | null = null;
  isHost = false;
  isConnected = false;

  private scene: THREE.Scene;
  private world: World;
  private particles: ParticleSystem;

  private supabaseChannel: RealtimeChannel | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;

  private remotePlayers = new Map<string, RemotePlayerMesh>();
  private blockHistory = new Map<string, { x: number; y: number; z: number; blockId: number }>();

  private broadcastTimer = 0;
  private isSyncingFromHost = false;

  constructor(scene: THREE.Scene, world: World, particles: ParticleSystem) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;

    // Generate unique local peer ID
    this.peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    const savedName = localStorage.getItem('voxel_player_name');
    this.playerName = savedName || 'Player_' + Math.floor(100 + Math.random() * 900);
  }

  setPlayerName(name: string) {
    this.playerName = name.trim() || 'Player';
    localStorage.setItem('voxel_player_name', this.playerName);
  }

  /**
   * Host a world: Generates a 6-digit random PIN and sets current player as Host
   */
  async hostRoom(customPin?: string): Promise<string> {
    const pin = customPin || Math.floor(100000 + Math.random() * 900000).toString();
    this.pin = pin;
    this.isHost = true;
    this.blockHistory.clear();

    const store = useGameStore.getState();
    store.setMultiplayerState({
      mode: 'host',
      pin,
      isHost: true,
      isConnected: true,
    });

    await this.connectChannel(pin);
    return pin;
  }

  /**
   * Join an existing world with a PIN
   */
  async joinRoom(pin: string): Promise<boolean> {
    const cleanPin = pin.trim();
    if (!cleanPin) return false;

    this.pin = cleanPin;
    this.isHost = false;

    const store = useGameStore.getState();
    store.setMultiplayerState({
      mode: 'client',
      pin: cleanPin,
      isHost: false,
      isConnected: true,
    });

    await this.connectChannel(cleanPin);

    // Request initial world state from host
    setTimeout(() => {
      this.sendBroadcast('request_sync', { requesterPeerId: this.peerId });
    }, 500);

    return true;
  }

  private async connectChannel(pin: string) {
    this.cleanup();

    const channelName = `room_${pin}`;
    const supabase = getSupabaseClient();

    // 1. Local Browser Tab Broadcast Channel fallback/co-channel for zero-lag testing
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.localBroadcastChannel = new BroadcastChannel(`temu_craft_${channelName}`);
        this.localBroadcastChannel.onmessage = (event) => {
          this.handleIncomingEvent(event.data.type, event.data.payload);
        };
      }
    } catch {
      // BroadcastChannel not available in environment
    }

    // 2. Realtime Supabase Channel
    if (supabase) {
      this.supabaseChannel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: this.peerId },
        },
      });

      this.supabaseChannel
        .on('broadcast', { event: 'player_pos' }, ({ payload }) => {
          this.handleIncomingEvent('player_pos', payload);
        })
        .on('broadcast', { event: 'block_change' }, ({ payload }) => {
          this.handleIncomingEvent('block_change', payload);
        })
        .on('broadcast', { event: 'host_settings' }, ({ payload }) => {
          this.handleIncomingEvent('host_settings', payload);
        })
        .on('broadcast', { event: 'request_sync' }, ({ payload }) => {
          this.handleIncomingEvent('request_sync', payload);
        })
        .on('broadcast', { event: 'sync_response' }, ({ payload }) => {
          this.handleIncomingEvent('sync_response', payload);
        })
        .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
          this.handleIncomingEvent('chat_message', payload);
        })
        .on('presence', { event: 'sync' }, () => {
          this.updatePresenceList();
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          newPresences.forEach((p: any) => {
            if (p.name && p.key !== this.peerId) {
              sounds.playClick();
              this.addNotification(`${p.name} joined the world!`);
            }
          });
          this.updatePresenceList();
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach((p: any) => {
            if (p.key) {
              this.removeRemotePlayer(p.key);
              if (p.name) this.addNotification(`${p.name} left the game.`);
            }
          });
          this.updatePresenceList();
        });

      await this.supabaseChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          await this.supabaseChannel?.track({
            peerId: this.peerId,
            name: this.playerName,
            isHost: this.isHost,
            joinedAt: Date.now(),
          });
        }
      });
    } else {
      // Local fallback mode
      this.isConnected = true;
      this.updatePresenceList();
    }
  }

  private sendBroadcast(event: string, payload: any) {
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event,
        payload,
      });
    }

    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: event,
          payload,
        });
      } catch {
        // BroadcastChannel send error ignored
      }
    }
  }

  private handleIncomingEvent(type: string, payload: any) {
    if (!payload || payload.peerId === this.peerId) return;

    switch (type) {
      case 'player_pos':
        this.onRemotePlayerPos(payload as PlayerPosPayload);
        break;
      case 'block_change':
        this.onRemoteBlockChange(payload as BlockChangePayload);
        break;
      case 'host_settings':
        this.onRemoteHostSettings(payload as HostSettingsPayload);
        break;
      case 'request_sync':
        this.onRemoteRequestSync(payload);
        break;
      case 'sync_response':
        this.onRemoteSyncResponse(payload as SyncResponsePayload);
        break;
      case 'chat_message':
        this.onRemoteChatMessage(payload as ChatMessagePayload);
        break;
    }
  }

  private onRemotePlayerPos(data: PlayerPosPayload) {
    let playerMesh = this.remotePlayers.get(data.peerId);
    if (!playerMesh) {
      playerMesh = new RemotePlayerMesh(data.name || 'Player', data.isHost);
      this.remotePlayers.set(data.peerId, playerMesh);
      this.scene.add(playerMesh.group);
      this.updatePresenceList();
    }

    playerMesh.targetPosition.set(data.position.x, data.position.y, data.position.z);
    playerMesh.targetYaw = data.yaw;
    playerMesh.targetPitch = data.pitch;
    playerMesh.isMoving = data.isMoving;
    playerMesh.isSprinting = data.isSprinting;
    playerMesh.updateHeldItem(data.heldItem);
  }

  private onRemoteBlockChange(data: BlockChangePayload) {
    const { x, y, z, blockId } = data;
    const key = `${x},${y},${z}`;
    this.blockHistory.set(key, { x, y, z, blockId });

    this.world.setBlockAt(x, y, z, blockId);

    if (blockId === BLOCKS.AIR) {
      sounds.playBlockHit();
      this.particles.spawnBlockBreak(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0x888888);
    } else {
      sounds.playBlockPlace();
    }
  }

  /**
   * Only the host can dictate settings and environment!
   * Non-host clients receive and apply them strictly.
   */
  private onRemoteHostSettings(data: HostSettingsPayload) {
    if (this.isHost) return; // Ignore if local is host

    const store = useGameStore.getState();
    store.setSettings({
      graphicsQuality: data.graphicsQuality,
      renderDistance: data.renderDistance,
      gameMode: data.gameMode,
    });
    store.setTimeOfDay(data.timeOfDay);
  }

  private onRemoteRequestSync(payload: { requesterPeerId: string }) {
    if (!this.isHost) return;

    const store = useGameStore.getState();
    const blocksArray = Array.from(this.blockHistory.values());

    const response: SyncResponsePayload = {
      targetPeerId: payload.requesterPeerId,
      blocks: blocksArray,
      timeOfDay: store.timeOfDay,
      gameMode: store.gameMode,
      graphicsQuality: store.graphicsQuality,
      renderDistance: store.renderDistance,
    };

    this.sendBroadcast('sync_response', response);
  }

  private onRemoteSyncResponse(data: SyncResponsePayload) {
    if (data.targetPeerId !== this.peerId) return;

    this.isSyncingFromHost = true;

    // Apply all blocks modified by the host/world
    for (const b of data.blocks) {
      this.world.setBlockAt(b.x, b.y, b.z, b.blockId);
      this.blockHistory.set(`${b.x},${b.y},${b.z}`, b);
    }

    // Apply host settings & time
    const store = useGameStore.getState();
    store.setSettings({
      graphicsQuality: data.graphicsQuality,
      renderDistance: data.renderDistance,
      gameMode: data.gameMode,
    });
    store.setTimeOfDay(data.timeOfDay);

    this.isSyncingFromHost = false;
    this.addNotification('World synchronized with Host!');
  }

  private onRemoteChatMessage(data: ChatMessagePayload) {
    const store = useGameStore.getState();
    store.addChatMessage(data);
    sounds.playClick();
  }

  /**
   * Called by local player when placing or breaking a block
   */
  broadcastBlockChange(x: number, y: number, z: number, blockId: number) {
    if (!this.pin) return;

    const key = `${x},${y},${z}`;
    this.blockHistory.set(key, { x, y, z, blockId });

    this.sendBroadcast('block_change', {
      x,
      y,
      z,
      blockId,
      peerId: this.peerId,
    });
  }

  /**
   * Called whenever the HOST modifies render distance, quality, time, or gameMode
   */
  broadcastHostSettings(settings: Partial<HostSettingsPayload>) {
    if (!this.isHost || !this.pin) return;

    const store = useGameStore.getState();
    const payload: HostSettingsPayload = {
      graphicsQuality: settings.graphicsQuality ?? store.graphicsQuality,
      renderDistance: settings.renderDistance ?? store.renderDistance,
      timeOfDay: settings.timeOfDay ?? store.timeOfDay,
      gameMode: settings.gameMode ?? store.gameMode,
    };

    this.sendBroadcast('host_settings', payload);
  }

  /**
   * Send a chat message to the room
   */
  sendChatMessage(text: string) {
    if (!text.trim() || !this.pin) return;

    const msg: ChatMessagePayload = {
      id: Math.random().toString(36).substring(2, 9),
      peerId: this.peerId,
      name: this.playerName,
      isHost: this.isHost,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const store = useGameStore.getState();
    store.addChatMessage(msg);
    this.sendBroadcast('chat_message', msg);
  }

  private addNotification(msg: string) {
    const store = useGameStore.getState();
    store.addMultiplayerNotification(msg);
  }

  private updatePresenceList() {
    const list = [
      { id: this.peerId, name: this.playerName, isHost: this.isHost, isLocal: true },
    ];

    this.remotePlayers.forEach((mesh, peerId) => {
      list.push({ id: peerId, name: mesh.name, isHost: mesh.isHost, isLocal: false });
    });

    useGameStore.getState().setConnectedPlayers(list);
  }

  private removeRemotePlayer(peerId: string) {
    const playerMesh = this.remotePlayers.get(peerId);
    if (playerMesh) {
      playerMesh.dispose(this.scene);
      this.remotePlayers.delete(peerId);
      this.updatePresenceList();
    }
  }

  /**
   * Called every frame in VoxelEngine loop
   */
  update(
    dt: number,
    position: THREE.Vector3,
    yaw: number,
    pitch: number,
    heldItem: number,
    isMoving: boolean,
    isSprinting: boolean
  ) {
    // Update all 3D remote player meshes
    this.remotePlayers.forEach((mesh) => {
      mesh.update(dt);
    });

    if (!this.pin) return;

    // Send local position at 25Hz
    this.broadcastTimer += dt;
    if (this.broadcastTimer >= 0.04) {
      this.broadcastTimer = 0;

      const payload: PlayerPosPayload = {
        peerId: this.peerId,
        name: this.playerName,
        isHost: this.isHost,
        position: {
          x: Math.round(position.x * 100) / 100,
          y: Math.round(position.y * 100) / 100,
          z: Math.round(position.z * 100) / 100,
        },
        yaw: Math.round(yaw * 100) / 100,
        pitch: Math.round(pitch * 100) / 100,
        heldItem: heldItem || BLOCKS.AIR,
        isMoving,
        isSprinting,
      };

      this.sendBroadcast('player_pos', payload);
    }
  }

  cleanup() {
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
    if (this.localBroadcastChannel) {
      this.localBroadcastChannel.close();
      this.localBroadcastChannel = null;
    }
    this.remotePlayers.forEach((mesh) => mesh.dispose(this.scene));
    this.remotePlayers.clear();
    this.isConnected = false;
    this.pin = null;
  }
}
