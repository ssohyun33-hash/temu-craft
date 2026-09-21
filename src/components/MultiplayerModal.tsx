import React, { useState } from 'react';
import { Users, Crown, Copy, Check, Radio, Globe, LogIn, Sparkles, X, Shield, ArrowRight } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { VoxelEngine } from '../engine/VoxelEngine';
import { isSupabaseConfigured, supabaseUrl } from '../engine/multiplayer/supabaseClient';
import { sounds } from '../engine/sound/SoundManager';

interface MultiplayerModalProps {
  engine: VoxelEngine | null;
  isOpen: boolean;
  onClose: () => void;
  onStartPlaying: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  engine,
  isOpen,
  onClose,
  onStartPlaying,
}) => {
  const {
    multiplayerMode,
    roomPin,
    isHost,
    playerName,
    setPlayerName,
    connectedPlayers,
    leaveMultiplayer,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [inputPin, setInputPin] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleCopyPin = (pin: string) => {
    sounds.playClick();
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleHostWorld = async () => {
    if (!engine) return;
    sounds.playClick();
    setIsConnecting(true);
    setErrorMsg('');

    try {
      engine.multiplayer.setPlayerName(playerName);
      const pin = await engine.hostMultiplayer();
      setIsConnecting(false);
      // Ready to play!
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || 'Failed to initialize multiplayer room');
    }
  };

  const handleJoinWorld = async () => {
    if (!engine) return;
    const cleanPin = inputPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMsg('Please enter a valid room PIN (at least 4 digits)');
      return;
    }

    sounds.playClick();
    setIsConnecting(true);
    setErrorMsg('');

    try {
      engine.multiplayer.setPlayerName(playerName);
      const success = await engine.joinMultiplayer(cleanPin);
      setIsConnecting(false);
      if (success) {
        onStartPlaying();
      } else {
        setErrorMsg('Could not join room with PIN: ' + cleanPin);
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || 'Failed to connect to room');
    }
  };

  const handleDisconnect = () => {
    sounds.playClick();
    if (engine) {
      engine.multiplayer.cleanup();
    }
    leaveMultiplayer();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto p-4 z-50 font-mono text-white select-none">
      <div className="max-w-lg w-full bg-stone-900 border border-stone-700 rounded-3xl p-6 shadow-2xl space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Users className="w-6 h-6" />
            <h2 className="text-xl font-black tracking-wider">MULTIPLAYER REALTIME</h2>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supabase Status Banner */}
        <div className={`p-3 rounded-2xl border text-xs flex items-center gap-3 ${
          isConfigured
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
        }`}>
          <div className="relative flex items-center justify-center">
            <Radio className={`w-5 h-5 ${isConfigured ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          </div>
          <div className="flex-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>{isConfigured ? 'Supabase Realtime Cloud Connected' : 'Supabase Multi-Tab / Local Broadcast Ready'}</span>
              <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            </div>
            <p className="text-[11px] opacity-85 mt-0.5">
              {isConfigured
                ? `Connected to Supabase endpoint (${supabaseUrl.replace(/^https?:\/\//, '').substring(0, 18)}...). Real-time broadcasts, peer synchronization & host authority active.`
                : 'Supabase URL & Anon Key can be provided in AI Studio Secrets (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY). Instant tab-to-tab realtime testing is active now!'}
            </p>
          </div>
        </div>

        {/* Player Nickname */}
        <div className="space-y-1.5 bg-stone-950/70 p-3 rounded-2xl border border-stone-800 text-xs">
          <label className="font-bold text-stone-300 flex items-center justify-between">
            <span>Your Player Name</span>
            <span className="text-[10px] text-amber-400">Visible above your 3D avatar</span>
          </label>
          <input
            type="text"
            value={playerName}
            maxLength={18}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g. Steve"
            className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-bold outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        {/* Active Room View if already in room */}
        {roomPin ? (
          <div className="space-y-4 bg-stone-950/90 rounded-2xl p-4 border border-stone-800 text-xs">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">ACTIVE ROOM PIN</span>
                <div className="text-3xl font-black text-amber-400 tracking-widest flex items-center gap-3">
                  <span>{roomPin}</span>
                  <button
                    onClick={() => handleCopyPin(roomPin)}
                    className="p-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-stone-300 hover:text-white transition-colors"
                    title="Copy PIN"
                  >
                    {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                isHost ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                {isHost ? <Crown className="w-4 h-4 text-amber-400" /> : <Users className="w-4 h-4 text-blue-400" />}
                <span>{isHost ? 'YOU ARE HOST' : 'JOINED AS PLAYER'}</span>
              </div>
            </div>

            {/* Host Authority Notice */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 flex items-start gap-2.5 text-stone-300 text-[11px] leading-relaxed">
              <Shield className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                {isHost ? (
                  <span>
                    <strong className="text-amber-300">Host Authority:</strong> As Host, only you can adjust Render Distance, Graphics Quality presets, Time of Day, and Game Mode. Any changes will instantly broadcast and sync to all players!
                  </span>
                ) : (
                  <span>
                    <strong className="text-cyan-300">Host Synchronized:</strong> Render distance, graphics quality, and world time are locked to the Host's authoritative settings.
                  </span>
                )}
              </div>
            </div>

            {/* Connected players list */}
            <div className="space-y-1.5">
              <div className="text-stone-400 font-bold flex justify-between">
                <span>CONNECTED PLAYERS ({connectedPlayers.length || 1})</span>
                <span className="text-emerald-400 font-semibold">● Realtime Sync Active</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {connectedPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-1.5 bg-stone-900 rounded-lg border border-stone-800 text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold">
                      {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      <span className={p.isLocal ? 'text-amber-200' : 'text-stone-200'}>{p.name} {p.isLocal ? '(You)' : ''}</span>
                    </span>
                    <span className="text-[10px] text-stone-500">{p.isHost ? 'Host' : 'Player'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  sounds.playClick();
                  onStartPlaying();
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                <span>ENTER WORLD</span>
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          /* Host vs Join Tabs */
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-stone-950 rounded-xl border border-stone-800 text-xs font-bold">
              <button
                onClick={() => {
                  sounds.playClick();
                  setActiveTab('host');
                }}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'host' ? 'bg-amber-500 text-stone-950 shadow' : 'text-stone-400 hover:text-white'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>Host a World</span>
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setActiveTab('join');
                }}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'join' ? 'bg-amber-500 text-stone-950 shadow' : 'text-stone-400 hover:text-white'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Join with PIN</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-300">
                {errorMsg}
              </div>
            )}

            {activeTab === 'host' ? (
              <div className="space-y-4 bg-stone-950/70 p-4 rounded-2xl border border-stone-800 text-xs">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    <span>Host Authoritative World</span>
                  </h3>
                  <p className="text-stone-400 text-[11px] leading-relaxed">
                    Hosting generates a random 6-digit PIN. Friends can enter this PIN on any device or tab to join your world.
                  </p>
                </div>

                <div className="bg-stone-900/80 p-3 rounded-xl border border-stone-800 space-y-1 text-[11px] text-stone-300">
                  <div className="font-semibold text-amber-200">👑 Host-Only Permissions:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-stone-400 text-[10px]">
                    <li>Render Distance & Graphics Realism Presets</li>
                    <li>Day / Night Celestial Time Progression</li>
                    <li>Game Mode (Survival vs Creative)</li>
                    <li>Real-time Block Placement & Mining synchronization</li>
                  </ul>
                </div>

                <button
                  onClick={handleHostWorld}
                  disabled={isConnecting}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isConnecting ? 'GENERATING PIN...' : 'HOST NEW WORLD (GET PIN)'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 bg-stone-950/70 p-4 rounded-2xl border border-stone-800 text-xs">
                <div className="space-y-1.5">
                  <h3 className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <LogIn className="w-4 h-4" />
                    <span>Join Host's World</span>
                  </h3>
                  <p className="text-stone-400 text-[11px] leading-relaxed">
                    Enter the 6-digit PIN provided by your host to connect and spawn in the same world.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-stone-300">Enter Host Room PIN</label>
                  <input
                    type="text"
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 583921"
                    maxLength={6}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-center text-2xl font-black tracking-widest text-amber-400 outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                <button
                  onClick={handleJoinWorld}
                  disabled={isConnecting || !inputPin}
                  className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isConnecting ? 'CONNECTING...' : 'JOIN WORLD WITH PIN'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
