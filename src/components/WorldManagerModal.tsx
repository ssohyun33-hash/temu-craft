import React, { useState, useEffect } from 'react';
import { useGameStore, GameMode } from '../store/gameStore';
import { SavedWorld, WorldStorage } from '../engine/storage/WorldStorage';
import { sounds } from '../engine/sound/SoundManager';
import { 
  X, Play, Plus, Trash2, Cloud, Database, RefreshCw, 
  Copy, Check, Shield, Globe, Users, Crown, Dices, Edit3, Save, AlertCircle, ExternalLink, Terminal, ChevronDown, ChevronUp 
} from 'lucide-react';
import { isSupabaseConfigured, supabaseUrl } from '../engine/multiplayer/supabaseClient';

interface WorldManagerModalProps {
  engine?: any;
  isOpen: boolean;
  onClose: () => void;
  onStartPlaying: () => void;
}

export const WorldManagerModal: React.FC<WorldManagerModalProps> = ({
  engine,
  isOpen,
  onClose,
  onStartPlaying,
}) => {
  const { 
    currentWorld, 
    savedWorlds, 
    setSavedWorlds, 
    setCurrentWorld, 
    setGameMode,
    playerName, 
    setPlayerName,
    setCloudSyncState,
    cloudSyncStatus,
    cloudSyncMessage,
    needsTableSetup,
    setNeedsTableSetup,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'singleplayer' | 'multiplayer' | 'supabase'>('singleplayer');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldSeed, setNewWorldSeed] = useState('');
  const [newWorldMode, setNewWorldMode] = useState<GameMode>('survival');
  const [newRoomPin, setNewRoomPin] = useState('');
  const [joinPinInput, setJoinPinInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [showSqlCodePreview, setShowSqlCodePreview] = useState(false);

  const cloudConnected = isSupabaseConfigured();

  // Parse Supabase project ref if available for direct link to SQL editor
  const projectRefMatch = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const sqlEditorUrl = projectRefMatch 
    ? `https://supabase.com/dashboard/project/${projectRefMatch[1]}/sql/new` 
    : 'https://supabase.com/dashboard';

  // Refresh worlds on open
  useEffect(() => {
    if (isOpen) {
      handleSyncWorlds();
    }
  }, [isOpen]);

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  const handleSyncWorlds = async () => {
    setIsSyncing(true);
    setCloudSyncState('syncing', 'Syncing worlds with Supabase Cloud...');
    try {
      const res = await WorldStorage.getAllWorlds();
      setSavedWorlds(res.worlds);
      if (res.cloudConnected) {
        if (res.needsTableSetup) {
          setNeedsTableSetup(true);
          setCloudSyncState('setup_needed', "Table 'worlds' not yet created in Supabase");
          showNotification("Supabase connected! Copy & run SQL script to create the worlds table.");
        } else if (res.error) {
          setCloudSyncState('error', `Supabase: ${res.error}`);
          showNotification(`Supabase notice: ${res.error}. (Local worlds intact)`);
        } else {
          setNeedsTableSetup(false);
          setCloudSyncState('synced', 'Synced with Supabase Cloud');
          showNotification('Successfully synced worlds with Supabase Cloud ☁️');
        }
      } else {
        setNeedsTableSetup(false);
        setCloudSyncState('idle', 'Local storage active');
      }
    } catch (e: any) {
      setCloudSyncState('error', e?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateSingleplayerWorld = async () => {
    sounds.playClick();
    const finalName = newWorldName.trim() || `World #${savedWorlds.filter(w => w.type === 'singleplayer').length + 1}`;
    const finalSeed = newWorldSeed.trim() || `seed_${Math.floor(Math.random() * 999999)}`;
    
    const newWorld = WorldStorage.createDefaultWorld('singleplayer', finalName, finalSeed, newWorldMode);
    
    setIsSyncing(true);
    await WorldStorage.saveWorld(newWorld);
    await handleSyncWorlds();
    
    setIsCreatingNew(false);
    setNewWorldName('');
    setNewWorldSeed('');

    // Load and play
    if (engine) {
      engine.loadSavedWorld(newWorld);
    }
    showNotification(`Created "${newWorld.name}"! Starting world...`);
    onStartPlaying();
  };

  const handleCreateMultiplayerWorld = async () => {
    sounds.playClick();
    const pin = newRoomPin.trim() || Math.floor(100000 + Math.random() * 900000).toString();
    const finalName = newWorldName.trim() || `Multiplayer Realm (${pin})`;
    const finalSeed = newWorldSeed.trim() || `room_${pin}`;

    const newWorld = WorldStorage.createDefaultWorld('multiplayer', finalName, finalSeed, newWorldMode, pin);
    newWorld.isHost = true;

    setIsSyncing(true);
    await WorldStorage.saveWorld(newWorld);
    await handleSyncWorlds();

    setIsCreatingNew(false);
    setNewWorldName('');
    setNewRoomPin('');

    if (engine) {
      engine.loadSavedWorld(newWorld);
    }
    showNotification(`Created Multiplayer World PIN: ${pin}!`);
    onStartPlaying();
  };

  const handleJoinMultiplayerWorld = async () => {
    const cleanPin = joinPinInput.trim().replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      showNotification('Please enter a valid 6-digit Room PIN');
      return;
    }

    sounds.playClick();
    const existing = savedWorlds.find(w => w.pin === cleanPin);
    let worldToLoad: SavedWorld;

    if (existing) {
      worldToLoad = existing;
    } else {
      worldToLoad = WorldStorage.createDefaultWorld('multiplayer', `Joined Room #${cleanPin}`, `room_${cleanPin}`, 'survival', cleanPin);
      worldToLoad.isHost = false;
      await WorldStorage.saveWorld(worldToLoad);
      await handleSyncWorlds();
    }

    if (engine) {
      engine.loadSavedWorld(worldToLoad);
    }
    setJoinPinInput('');
    showNotification(`Joined Room PIN: ${cleanPin}!`);
    onStartPlaying();
  };

  const handlePlayWorld = (world: SavedWorld) => {
    sounds.playClick();
    if (engine) {
      engine.loadSavedWorld(world);
    }
    showNotification(`Loading "${world.name}"...`);
    onStartPlaying();
  };

  const handleDeleteWorld = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return;
    }
    sounds.playClick();
    await WorldStorage.deleteWorld(id);
    if (currentWorld?.id === id) {
      setCurrentWorld(null);
    }
    await handleSyncWorlds();
    showNotification(`Deleted "${name}"`);
  };

  const handleSaveEditName = async (world: SavedWorld) => {
    if (!editNameValue.trim()) {
      setEditingWorldId(null);
      return;
    }
    sounds.playClick();
    const updated = { ...world, name: editNameValue.trim() };
    await WorldStorage.saveWorld(updated);
    setEditingWorldId(null);
    await handleSyncWorlds();
    showNotification(`Renamed to "${updated.name}"`);
  };

  const handleManualCloudBackup = async (world: SavedWorld) => {
    sounds.playClick();
    setIsSyncing(true);
    const res = await WorldStorage.saveWorld(world);
    setIsSyncing(false);
    if (res.needsTableSetup) {
      setNeedsTableSetup(true);
      setCloudSyncState('setup_needed', 'Database table "worlds" needed in Supabase');
      showNotification("Saved locally. Supabase 'worlds' table needed - run SQL script to enable cloud backup.");
    } else if (res.cloudSynced) {
      setNeedsTableSetup(false);
      showNotification(`"${world.name}" backed up to Supabase Cloud ☁️`);
      await handleSyncWorlds();
    } else {
      showNotification(res.message || 'Saved locally.');
    }
  };

  if (!isOpen) return null;

  const singleplayerWorlds = savedWorlds.filter(w => w.type === 'singleplayer');
  const multiplayerWorlds = savedWorlds.filter(w => w.type === 'multiplayer');

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 pointer-events-auto select-none">
      <div className="max-w-2xl w-full bg-stone-900 border border-stone-700 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-100 tracking-wide flex items-center gap-2">
                <span>WORLD MANAGER</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SUPABASE
                </span>
              </h2>
              <p className="text-[11px] text-stone-400">Save & load Singleplayer & Multiplayer worlds to Supabase Cloud</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 hover:bg-stone-800 rounded-2xl text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supabase Status Banner */}
        <div className="flex items-center justify-between p-3 bg-stone-950/80 rounded-2xl border border-stone-800 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              cloudConnected 
                ? needsTableSetup 
                  ? 'bg-amber-400 animate-pulse' 
                  : 'bg-emerald-400 animate-pulse' 
                : 'bg-stone-500'
            }`} />
            <span className="font-bold text-stone-200">
              {cloudConnected 
                ? needsTableSetup 
                  ? 'Supabase Connected (Table Setup Needed)' 
                  : 'Supabase Cloud Backed' 
                : 'Local Storage Active'}
            </span>
            <span className="text-[11px] text-stone-400 hidden sm:inline">
              {cloudConnected ? `(${new URL(supabaseUrl).hostname})` : '• Add Supabase in Secrets for automatic cloud sync'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncWorlds}
              disabled={isSyncing}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-xl text-stone-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Pull latest worlds from Supabase & push local saves"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>

            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                needsTableSetup 
                  ? 'bg-amber-500 text-stone-950 border-amber-400 font-extrabold shadow-sm' 
                  : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
              }`}
            >
              {needsTableSetup ? '⚡ Setup SQL' : 'SQL Schema'}
            </button>
          </div>
        </div>

        {/* Table Setup Required Guidance Card */}
        {cloudConnected && needsTableSetup && (
          <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl space-y-2.5 text-xs animate-fadeIn">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl mt-0.5">
                  <Database className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-300 text-xs">
                      1-Step Setup: Initialize "worlds" Table in Supabase
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded-full border border-amber-500/30">
                      Local Saves Safe 💾
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-300 leading-relaxed">
                    Notice: <span className="text-amber-200 font-mono text-[10px]">Could not find the table 'public.worlds' in the schema cache</span>.
                    Your worlds are saved locally without data loss. Run this quick 5-second SQL script once in your Supabase SQL Editor to activate automatic cloud backup!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  navigator.clipboard.writeText(WorldStorage.getSqlSchema());
                  setCopiedSchema(true);
                  showNotification("SQL script copied! Paste it in your Supabase SQL Editor and click 'Run'.");
                  setTimeout(() => setCopiedSchema(false), 3000);
                }}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSchema ? 'COPIED TO CLIPBOARD!' : '1. COPY SQL SCRIPT'}</span>
              </button>

              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sounds.playClick()}
                className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-cyan-300 hover:text-cyan-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-cyan-500/30 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>2. Open Supabase SQL Editor</span>
              </a>

              <button
                onClick={handleSyncWorlds}
                disabled={isSyncing}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md ml-auto"
                title="Re-check if the worlds table was created"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Checking...' : '3. Verify & Sync'}</span>
              </button>
            </div>

            {/* Collapsible SQL code snippet */}
            <div className="pt-1">
              <button
                onClick={() => setShowSqlCodePreview(!showSqlCodePreview)}
                className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              >
                {showSqlCodePreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>{showSqlCodePreview ? 'Hide SQL Code Preview' : 'Show SQL Code Preview'}</span>
              </button>

              {showSqlCodePreview && (
                <div className="mt-1.5 relative">
                  <pre className="p-3 bg-stone-950/90 rounded-xl border border-stone-800 text-[10px] font-mono text-amber-200/90 overflow-x-auto max-h-36 select-all">
                    {WorldStorage.getSqlSchema()}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Toast */}
        {statusNotification && (
          <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Cloud className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{statusNotification}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex gap-1.5 p-1 bg-stone-950 rounded-2xl border border-stone-800 text-xs font-bold">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('singleplayer');
              setIsCreatingNew(false);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'singleplayer' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Singleplayer ({singleplayerWorlds.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('multiplayer');
              setIsCreatingNew(false);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'multiplayer' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multiplayer ({multiplayerWorlds.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('supabase');
              setIsCreatingNew(false);
            }}
            className={`px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'supabase' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Setup</span>
          </button>
        </div>

        {/* Body Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">

          {/* TAB 1: SINGLEPLAYER WORLDS */}
          {activeTab === 'singleplayer' && (
            <div className="space-y-3">
              {/* Create New World Form */}
              {isCreatingNew ? (
                <div className="p-4 bg-stone-950 rounded-2xl border border-amber-500/50 space-y-3">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>CREATE NEW SINGLEPLAYER WORLD</span>
                    <button onClick={() => setIsCreatingNew(false)} className="text-stone-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-1">World Name</label>
                      <input
                        type="text"
                        value={newWorldName}
                        onChange={(e) => setNewWorldName(e.target.value)}
                        placeholder="e.g. My Majestic Fortress"
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-amber-400 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-stone-400 block mb-1">Game Mode</label>
                        <select
                          value={newWorldMode}
                          onChange={(e) => setNewWorldMode(e.target.value as GameMode)}
                          className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-2 text-stone-200 outline-none text-xs"
                        >
                          <option value="survival">Survival (Health & Hunger)</option>
                          <option value="creative">Creative (Fly & Unlimited Items)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-stone-400 block mb-1">World Seed (Optional)</label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newWorldSeed}
                            onChange={(e) => setNewWorldSeed(e.target.value)}
                            placeholder="Random Seed"
                            className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-amber-400 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setNewWorldSeed(`seed_${Math.floor(Math.random() * 999999)}`)}
                            className="p-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-stone-300"
                            title="Generate Random Seed"
                          >
                            <Dices className="w-4 h-4 text-amber-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCreateSingleplayerWorld}
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>CREATE & PLAY WORLD</span>
                      </button>
                      <button
                        onClick={() => setIsCreatingNew(false)}
                        className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    sounds.playClick();
                    setIsCreatingNew(true);
                  }}
                  className="w-full py-3 bg-stone-950/80 hover:bg-stone-800 border border-dashed border-stone-700 hover:border-amber-500/60 rounded-2xl text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>CREATE NEW SINGLEPLAYER WORLD</span>
                </button>
              )}

              {/* Worlds List */}
              {singleplayerWorlds.length === 0 ? (
                <div className="p-8 text-center bg-stone-950/40 rounded-2xl border border-stone-800/80 text-stone-500 space-y-2">
                  <Globe className="w-8 h-8 mx-auto text-stone-600 opacity-60" />
                  <p className="text-xs font-semibold">No saved singleplayer worlds yet.</p>
                  <p className="text-[11px] text-stone-600">Click the button above to create your first world!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {singleplayerWorlds.map((world) => {
                    const isCurrent = currentWorld?.id === world.id;
                    const isEditing = editingWorldId === world.id;

                    return (
                      <div
                        key={world.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-amber-500/10 border-amber-500/60 shadow-lg'
                            : 'bg-stone-950/80 hover:bg-stone-950 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editNameValue}
                                  onChange={(e) => setEditNameValue(e.target.value)}
                                  className="bg-stone-900 border border-amber-400 rounded-lg px-2 py-1 text-xs text-white outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveEditName(world)}
                                  className="p-1 text-emerald-400 hover:text-emerald-300"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-extrabold text-stone-100 text-sm">{world.name}</span>
                                <button
                                  onClick={() => {
                                    setEditingWorldId(world.id);
                                    setEditNameValue(world.name);
                                  }}
                                  className="text-stone-500 hover:text-stone-300 p-0.5"
                                  title="Rename World"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </>
                            )}

                            {isCurrent && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-stone-950">
                                ACTIVE
                              </span>
                            )}
                          </div>

                          {/* World Badges */}
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-400">
                            <span className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                              world.gameMode === 'survival' ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-600/30 text-purple-300'
                            }`}>
                              {world.gameMode}
                            </span>
                            <span className="text-stone-400">
                              Seed: <strong className="font-mono text-stone-300">{world.seed}</strong>
                            </span>
                            <span>•</span>
                            <span className="text-stone-400">
                              {world.blockCount || (world.modifiedBlocks?.length || 0)} blocks modified
                            </span>
                            <span>•</span>
                            <span className="text-stone-500">
                              {new Date(world.lastPlayedAt).toLocaleDateString()} {new Date(world.lastPlayedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {world.syncedToCloud && (
                              <span className="text-cyan-400 flex items-center gap-1 font-bold" title="Backed up to Supabase">
                                <Cloud className="w-3 h-3" />
                                <span>Cloud</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => handleManualCloudBackup(world)}
                            title="Backup World to Supabase Cloud"
                            className="p-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-cyan-300 rounded-xl border border-stone-800 transition-colors"
                          >
                            <Cloud className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteWorld(world.id, world.name)}
                            title="Delete World"
                            className="p-2 bg-stone-900 hover:bg-red-950/60 text-stone-500 hover:text-red-400 rounded-xl border border-stone-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handlePlayWorld(world)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>PLAY</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MULTIPLAYER WORLDS */}
          {activeTab === 'multiplayer' && (
            <div className="space-y-3">
              {/* Host / Join Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Host Card */}
                <div className="p-3.5 bg-stone-950 rounded-2xl border border-amber-500/40 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>HOST MULTIPLAYER WORLD</span>
                  </div>
                  <p className="text-[11px] text-stone-400">Generate a new 6-digit PIN and host a synchronized world for friends.</p>
                  
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      value={newWorldName}
                      onChange={(e) => setNewWorldName(e.target.value)}
                      placeholder="Realm Name (optional)"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-100 outline-none text-xs"
                    />
                    <button
                      onClick={handleCreateMultiplayerWorld}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>HOST NEW WORLD & GET PIN</span>
                    </button>
                  </div>
                </div>

                {/* Join Card */}
                <div className="p-3.5 bg-stone-950 rounded-2xl border border-cyan-500/40 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>JOIN WITH PIN</span>
                  </div>
                  <p className="text-[11px] text-stone-400">Enter a host's 6-digit PIN to join their world and save it to your list.</p>
                  
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      maxLength={6}
                      value={joinPinInput}
                      onChange={(e) => setJoinPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit PIN (e.g. 849201)"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-100 outline-none text-xs font-mono font-bold tracking-widest text-center"
                    />
                    <button
                      onClick={handleJoinMultiplayerWorld}
                      disabled={joinPinInput.length !== 6}
                      className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>CONNECT & JOIN WORLD</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Saved Multiplayer Worlds List */}
              <div className="pt-2">
                <div className="text-stone-400 font-bold text-xs mb-2 flex items-center justify-between">
                  <span>SAVED MULTIPLAYER WORLDS & ROOMS</span>
                  <span className="text-[10px] text-stone-500">{multiplayerWorlds.length} Saved</span>
                </div>

                {multiplayerWorlds.length === 0 ? (
                  <div className="p-8 text-center bg-stone-950/40 rounded-2xl border border-stone-800/80 text-stone-500 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-stone-600 opacity-60" />
                    <p className="text-xs font-semibold">No saved multiplayer worlds yet.</p>
                    <p className="text-[11px] text-stone-600">Host or join a world using a 6-digit PIN above to save it!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {multiplayerWorlds.map((world) => {
                      const isCurrent = currentWorld?.id === world.id;

                      return (
                        <div
                          key={world.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg'
                              : 'bg-stone-950/80 hover:bg-stone-950 border-stone-800 hover:border-stone-700'
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-stone-100 text-sm">{world.name}</span>
                              {world.pin && (
                                <div className="flex items-center gap-1 bg-stone-900 px-2 py-0.5 rounded-lg border border-stone-700">
                                  <span className="text-amber-400 font-mono font-black text-xs">{world.pin}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(world.pin!);
                                      setCopiedPin(world.pin!);
                                      setTimeout(() => setCopiedPin(null), 2000);
                                    }}
                                    className="text-stone-400 hover:text-white"
                                    title="Copy PIN"
                                  >
                                    {copiedPin === world.pin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                world.isHost ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}>
                                {world.isHost ? '👑 HOST' : '👤 GUEST'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-400">
                              <span className="text-stone-400">
                                Seed: <strong className="font-mono text-stone-300">{world.seed}</strong>
                              </span>
                              <span>•</span>
                              <span className="text-stone-400">
                                {world.blockCount || (world.modifiedBlocks?.length || 0)} blocks modified
                              </span>
                              <span>•</span>
                              <span className="text-stone-500">
                                Last played {new Date(world.lastPlayedAt).toLocaleDateString()}
                              </span>
                              {world.syncedToCloud && (
                                <span className="text-cyan-400 flex items-center gap-1 font-bold" title="Backed up to Supabase">
                                  <Cloud className="w-3 h-3" />
                                  <span>Cloud</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                              onClick={() => handleManualCloudBackup(world)}
                              title="Backup to Supabase"
                              className="p-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-cyan-300 rounded-xl border border-stone-800 transition-colors"
                            >
                              <Cloud className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteWorld(world.id, world.name)}
                              title="Delete World"
                              className="p-2 bg-stone-900 hover:bg-red-950/60 text-stone-500 hover:text-red-400 rounded-xl border border-stone-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handlePlayWorld(world)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{world.isHost ? 'HOST' : 'JOIN'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SUPABASE CLOUD SETUP & SQL */}
          {activeTab === 'supabase' && (
            <div className="space-y-4 p-1">
              <div className="p-4 bg-stone-950 rounded-2xl border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-stone-200">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Supabase Cloud Integration Details</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    cloudConnected 
                      ? needsTableSetup 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-stone-800 text-stone-400 border border-stone-700'
                  }`}>
                    {cloudConnected ? (needsTableSetup ? 'TABLE SETUP REQUIRED' : 'CONNECTED & READY') : 'ENV KEYS REQUIRED'}
                  </span>
                </div>

                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Temu Craft automatically connects to your Supabase project using <code className="text-amber-300 bg-stone-900 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="text-amber-300 bg-stone-900 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>.
                  Every singleplayer and multiplayer world (seed, player state, inventory, modified blocks) is synced to table <code className="text-cyan-300 bg-stone-900 px-1 py-0.5 rounded">worlds</code>!
                </p>

                {needsTableSetup && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Why does "Could not find table 'public.worlds' in schema cache" appear?</span>
                    </div>
                    <p className="text-stone-300 text-[11px]">
                      This notice appears because Supabase has connected, but the database table has not been created yet in Postgres. 
                      Run the SQL script below once in your Supabase SQL Editor. Once created, this message disappears and your worlds automatically back up to the cloud!
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 text-[11px] text-stone-300">
                  <div className="font-bold text-stone-200">How to initialize your database in 3 steps:</div>
                  <ol className="list-decimal list-inside space-y-1 text-stone-400 text-[11px]">
                    <li>Click <strong>Copy SQL Script</strong> below.</li>
                    <li>Open your <strong>Supabase Dashboard &gt; SQL Editor</strong> and paste the script.</li>
                    <li>Click <strong>Run</strong> in Supabase, then click <strong>Verify &amp; Sync</strong> here!</li>
                  </ol>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={sqlEditorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sounds.playClick()}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-cyan-300 hover:text-cyan-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-cyan-500/30 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Supabase SQL Editor</span>
                  </a>

                  <button
                    onClick={handleSyncWorlds}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ml-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Verifying...' : 'Verify & Sync Table'}</span>
                  </button>
                </div>
              </div>

              {/* SQL Schema Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-300 text-xs flex items-center gap-1.5">
                    <span>Supabase SQL Script (Table: `worlds`)</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(WorldStorage.getSqlSchema());
                      setCopiedSchema(true);
                      setTimeout(() => setCopiedSchema(false), 2500);
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  >
                    {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSchema ? 'COPIED SQL!' : 'COPY SQL SCRIPT'}</span>
                  </button>
                </div>

                <pre className="p-3.5 bg-stone-950 rounded-2xl border border-stone-800 text-[11px] font-mono text-amber-200/90 overflow-x-auto max-h-56 select-all">
                  {WorldStorage.getSqlSchema()}
                </pre>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-stone-500">
            Temu Craft Cloud Save Engine • Realtime Supabase
          </span>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
