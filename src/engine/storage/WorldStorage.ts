import { getSupabaseClient, isSupabaseConfigured } from '../multiplayer/supabaseClient';
import { GameMode, ItemStack } from '../../store/gameStore';

export interface SavedWorld {
  id: string;
  name: string;
  type: 'singleplayer' | 'multiplayer';
  seed: string;
  gameMode: GameMode;
  createdAt: number;
  lastPlayedAt: number;
  pin?: string;
  isHost?: boolean;
  syncedToCloud?: boolean;

  playerData?: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
  };
  inventory?: {
    hotbar: (ItemStack | null)[];
    backpack: (ItemStack | null)[];
    activeSlot: number;
  };
  modifiedBlocks?: [number, number, number, number][]; // [x, y, z, blockId]
  blockCount?: number;
  timeOfDay?: number;
}

export interface WorldFetchResult {
  worlds: SavedWorld[];
  cloudConnected: boolean;
  needsTableSetup?: boolean;
  error?: string;
}

export interface WorldSaveResult {
  success: boolean;
  cloudSynced: boolean;
  needsTableSetup?: boolean;
  message?: string;
}

export function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const msg = (typeof error === 'string' ? error : (error.message || error.details || error.hint || '')).toLowerCase();
  const code = (error.code || '').toString();
  return (
    code === 'PGRST205' ||
    code === '42P01' || // Postgres undefined_table
    msg.includes("could not find the table 'public.worlds'") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes('relation "public.worlds" does not exist') ||
    msg.includes('relation "worlds" does not exist')
  );
}

const LOCAL_STORAGE_KEY = 'temu_craft_saved_worlds_v2';

export class WorldStorage {
  // Read local cache immediately
  static getLocalWorlds(): SavedWorld[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse local worlds:', e);
      return [];
    }
  }

  // Save to local cache
  static saveLocalWorlds(worlds: SavedWorld[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(worlds));
    } catch (e) {
      console.warn('Failed to write local worlds:', e);
    }
  }

  // Fetch all worlds with Supabase Cloud Sync
  static async getAllWorlds(): Promise<WorldFetchResult> {
    let localWorlds = this.getLocalWorlds();
    const cloudConnected = isSupabaseConfigured();

    if (!cloudConnected) {
      return { worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt), cloudConnected: false };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt), cloudConnected: false };
    }

    try {
      const { data, error } = await supabase
        .from('worlds')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        const missingTable = isTableMissingError(error);
        if (missingTable) {
          // Informative developer note instead of noisy error warning
          console.info('Supabase notice: "worlds" table not yet created in Supabase. Running in local storage mode until table is created in Supabase SQL editor.');
          return {
            worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
            cloudConnected: true,
            needsTableSetup: true,
            error: "Could not find the table 'public.worlds' in the schema cache",
          };
        }

        console.warn('Supabase fetch worlds notice:', error.message);
        return {
          worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
          cloudConnected: true,
          error: error.message,
        };
      }

      if (data && Array.isArray(data)) {
        const cloudWorldsMap = new Map<string, SavedWorld>();

        for (const row of data) {
          const worldData = (typeof row.data === 'object' && row.data !== null) ? row.data : {};
          const parsedWorld: SavedWorld = {
            id: row.id,
            name: row.name || 'Untitled World',
            type: (row.type === 'multiplayer' ? 'multiplayer' : 'singleplayer'),
            seed: row.seed || 'default_seed',
            gameMode: (row.game_mode === 'creative' ? 'creative' : 'survival'),
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            lastPlayedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
            pin: row.pin || undefined,
            isHost: worldData.isHost ?? (row.type === 'multiplayer'),
            syncedToCloud: true,
            playerData: worldData.playerData,
            inventory: worldData.inventory,
            modifiedBlocks: worldData.modifiedBlocks || [],
            blockCount: worldData.blockCount || (worldData.modifiedBlocks ? worldData.modifiedBlocks.length : 0),
            timeOfDay: worldData.timeOfDay,
          };
          cloudWorldsMap.set(parsedWorld.id, parsedWorld);
        }

        // Merge local & cloud worlds
        const mergedMap = new Map<string, SavedWorld>();

        // Put cloud worlds first
        for (const [id, cw] of cloudWorldsMap.entries()) {
          mergedMap.set(id, cw);
        }

        // Check local worlds
        for (const lw of localWorlds) {
          const cloudVersion = mergedMap.get(lw.id);
          if (!cloudVersion) {
            // Local world not yet in cloud; keep it and attempt to upload
            mergedMap.set(lw.id, { ...lw, syncedToCloud: false });
          } else {
            // Both exist; take the one with higher timestamp
            if (lw.lastPlayedAt > cloudVersion.lastPlayedAt) {
              mergedMap.set(lw.id, { ...lw, syncedToCloud: false });
            }
          }
        }

        const finalWorlds = Array.from(mergedMap.values()).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
        this.saveLocalWorlds(finalWorlds);

        return { worlds: finalWorlds, cloudConnected: true, needsTableSetup: false };
      }

      return { worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt), cloudConnected: true, needsTableSetup: false };
    } catch (err: any) {
      const missingTable = isTableMissingError(err);
      if (missingTable) {
        return {
          worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
          cloudConnected: true,
          needsTableSetup: true,
          error: "Could not find the table 'public.worlds' in the schema cache",
        };
      }
      console.warn('Error querying Supabase worlds:', err);
      return {
        worlds: localWorlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
        cloudConnected: true,
        error: err?.message,
      };
    }
  }

  // Save or update a world (local + Supabase)
  static async saveWorld(
    world: SavedWorld
  ): Promise<WorldSaveResult> {
    world.lastPlayedAt = Date.now();

    // 1. Always update local storage first for zero latency
    const localWorlds = this.getLocalWorlds();
    const existingIdx = localWorlds.findIndex((w) => w.id === world.id);
    if (existingIdx >= 0) {
      localWorlds[existingIdx] = world;
    } else {
      localWorlds.unshift(world);
    }
    this.saveLocalWorlds(localWorlds);

    // 2. Sync to Supabase if configured
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        cloudSynced: false,
        message: 'Saved locally. Add Supabase URL & Key in Settings to enable Cloud World backup.',
      };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: true, cloudSynced: false, message: 'Saved locally (Supabase client not ready).' };
    }

    try {
      const payload = {
        id: world.id,
        name: world.name,
        type: world.type,
        seed: world.seed,
        pin: world.pin || null,
        game_mode: world.gameMode,
        data: {
          playerData: world.playerData,
          inventory: world.inventory,
          modifiedBlocks: world.modifiedBlocks || [],
          blockCount: world.modifiedBlocks ? world.modifiedBlocks.length : 0,
          timeOfDay: world.timeOfDay,
          isHost: world.isHost,
        },
        updated_at: new Date(world.lastPlayedAt).toISOString(),
      };

      const { error } = await supabase.from('worlds').upsert(payload, { onConflict: 'id' });

      if (error) {
        const missingTable = isTableMissingError(error);
        if (missingTable) {
          console.info('Supabase notice: "worlds" table missing. World saved locally.');
          return {
            success: true,
            cloudSynced: false,
            needsTableSetup: true,
            message: 'Saved locally. (Run SQL script in Supabase to enable cloud backup)',
          };
        }

        console.warn('Supabase upsert world warning:', error);
        return {
          success: true,
          cloudSynced: false,
          message: `Saved locally. Cloud sync: ${error.message}`,
        };
      }

      // Mark world as synced in local cache
      world.syncedToCloud = true;
      this.saveLocalWorlds(localWorlds);

      return {
        success: true,
        cloudSynced: true,
        needsTableSetup: false,
        message: 'World saved and backed up to Supabase Cloud ☁️',
      };
    } catch (err: any) {
      const missingTable = isTableMissingError(err);
      if (missingTable) {
        return {
          success: true,
          cloudSynced: false,
          needsTableSetup: true,
          message: 'Saved locally. (Run SQL script in Supabase to enable cloud backup)',
        };
      }
      console.warn('Supabase world save error:', err);
      return {
        success: true,
        cloudSynced: false,
        message: `Saved locally. Cloud sync exception: ${err?.message}`,
      };
    }
  }

  // Delete a world (local + Supabase)
  static async deleteWorld(id: string): Promise<boolean> {
    const localWorlds = this.getLocalWorlds().filter((w) => w.id !== id);
    this.saveLocalWorlds(localWorlds);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('worlds').delete().eq('id', id);
        } catch (e) {
          console.warn('Failed to delete world in Supabase:', e);
        }
      }
    }

    return true;
  }

  // Create a clean new world object
  static createDefaultWorld(
    type: 'singleplayer' | 'multiplayer',
    name?: string,
    seed?: string,
    mode: GameMode = 'survival',
    pin?: string
  ): SavedWorld {
    const timestamp = Date.now();
    const generatedSeed = seed?.trim() || `seed_${Math.floor(Math.random() * 999999)}`;
    const randomPin = pin || (type === 'multiplayer' ? Math.floor(100000 + Math.random() * 900000).toString() : undefined);
    
    let defaultName = name?.trim();
    if (!defaultName) {
      if (type === 'singleplayer') {
        const count = this.getLocalWorlds().filter((w) => w.type === 'singleplayer').length + 1;
        defaultName = `New World #${count}`;
      } else {
        defaultName = `Multiplayer Realm (${randomPin})`;
      }
    }

    return {
      id: type === 'singleplayer' ? `world_${timestamp}_${Math.random().toString(36).substring(2, 7)}` : `room_${randomPin}`,
      name: defaultName,
      type,
      seed: generatedSeed,
      gameMode: mode,
      createdAt: timestamp,
      lastPlayedAt: timestamp,
      pin: randomPin,
      isHost: true,
      syncedToCloud: false,
      blockCount: 0,
      modifiedBlocks: [],
      playerData: {
        x: 8,
        y: 40,
        z: 8,
        yaw: 0,
        pitch: 0,
        health: 20,
        hunger: 20,
      },
    };
  }

  // SQL schema generator string for users to run in Supabase SQL Editor
  static getSqlSchema(): string {
    return `-- ==========================================================
-- Temu Craft: Supabase World Persistence & Sync Schema
-- Run this in your Supabase Dashboard: SQL Editor -> Click "Run"
-- ==========================================================

create table if not exists public.worlds (
  id text primary key,
  name text not null,
  type text not null default 'singleplayer',
  seed text not null,
  pin text,
  game_mode text not null default 'survival',
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
alter table public.worlds enable row level security;

-- Drop previous policies if any exist
drop policy if exists "Public access to worlds" on public.worlds;
drop policy if exists "Allow public read worlds" on public.worlds;
drop policy if exists "Allow public write worlds" on public.worlds;

-- Allow anonymous and authenticated players to read & write their worlds
create policy "Public access to worlds"
on public.worlds for all
to anon, authenticated
using (true)
with check (true);

-- Grant schema permissions to client roles
grant all on table public.worlds to anon, authenticated, service_role;

-- Performance indexes for rapid lookups and sorting
create index if not exists idx_worlds_pin on public.worlds(pin);
create index if not exists idx_worlds_updated_at on public.worlds(updated_at desc);
`;
  }
}
