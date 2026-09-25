import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Crosshair, Map, Box } from 'lucide-react';
import type { TelemetryData } from '../types/telemetry';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { sirenAudio } from '../utils/sirenAudio';
import { SimulationViewport3D } from './SimulationViewport3D';
import { TacticalCommandView2D } from './TacticalCommandView2D';

interface SimulationViewportProps {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
}

export function SimulationViewport({ telemetry, connectionStatus }: SimulationViewportProps) {
  const [followAmbulance, setFollowAmbulance] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [strobeState, setStrobeState] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const containerRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus === 'CONNECTED';
  const amb = telemetry?.ambulance;
  const isRunning = telemetry?.simulation.running ?? false;
  const isArrived = amb?.status === 'ARRIVED';

  // Toggle audio siren
  const handleToggleAudio = () => {
    const muted = sirenAudio.toggleMute();
    setIsMuted(muted);
    if (!muted && isRunning) {
      sirenAudio.startSiren();
    }
  };

  // Start siren when simulation runs and unmuted
  useEffect(() => {
    if (isRunning && !isMuted) {
      sirenAudio.startSiren();
    } else if (!isRunning || isArrived) {
      sirenAudio.stopSiren();
    }
  }, [isRunning, isArrived, isMuted]);

  // Emergency Strobe Flash Effect (4 Hz)
  useEffect(() => {
    const interval = setInterval(() => {
      setStrobeState((prev) => !prev);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative bg-gray-900 border border-gray-800 rounded overflow-hidden flex flex-col justify-between select-none min-h-[460px] shadow-sm"
    >
      {/* ── TOP HEADER CONTROLS BAR ─────────────────────────────────── */}
      <div className="h-10 px-4 bg-gray-950/90 border-b border-gray-800 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold tracking-widest text-gray-100 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Corridor Digital Twin
          </span>
          <span className="font-mono text-[10px] text-gray-500 hidden sm:inline">
            Tactical Urban Traffic Replication
          </span>
        </div>

        {/* View Mode Switcher + Audio + Camera Controls */}
        <div className="flex items-center gap-2 font-mono">
          {/* 2D vs 3D Toggle */}
          <div className="flex items-center bg-gray-950 p-0.5 rounded border border-gray-800">
            <button
              onClick={() => setViewMode('2D')}
              className={`px-2.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer font-bold flex items-center gap-1 ${
                viewMode === '2D'
                  ? 'bg-gray-800 text-gray-100 shadow-xs border border-gray-700'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Map className="w-3 h-3" />
              2D Tactical
            </button>
            <button
              onClick={() => setViewMode('3D')}
              className={`px-2.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer font-bold flex items-center gap-1 ${
                viewMode === '3D'
                  ? 'bg-gray-800 text-gray-100 shadow-xs border border-gray-700'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Box className="w-3 h-3" />
              3D Twin
            </button>
          </div>

          <div className="h-3.5 w-px bg-gray-800" />

          {/* Audio Siren Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer border ${
              !isMuted
                ? 'bg-red-950/60 border-red-700 text-red-400 animate-pulse'
                : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300'
            }`}
            title={!isMuted ? 'Mute emergency siren' : 'Unmute emergency siren'}
          >
            {!isMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* 3D Follow Cam Toggle */}
          {viewMode === '3D' && (
            <button
              onClick={() => setFollowAmbulance(!followAmbulance)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                followAmbulance
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                  : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              {followAmbulance ? 'Lock Amb' : 'Free Cam'}
            </button>
          )}
        </div>
      </div>

      {/* ── VIEWPORT CANVAS (2D Tactical Map by default, 3D WebGL optionally) ── */}
      <div className="relative flex-1 w-full h-full bg-[#0a0d14] overflow-hidden flex items-center justify-center">
        {viewMode === '2D' ? (
          <TacticalCommandView2D
            telemetry={telemetry}
            connectionStatus={connectionStatus}
          />
        ) : (
          <SimulationViewport3D
            telemetry={telemetry}
            followAmbulance={followAmbulance}
            strobeState={strobeState}
          />
        )}
      </div>

      {/* ── BOTTOM FOOTNOTE TELEMETRY OVERLAY ── */}
      <div className="h-7 px-4 bg-gray-950/90 border-t border-gray-800 flex items-center justify-between text-gray-500 font-mono text-[10px] shrink-0">
        <div className="flex items-center gap-4">
          <span>GRID: RES-100m</span>
          <span>CORRIDOR: 4-LANE ARTERIAL (4 JUNCTIONS)</span>
          <span className="hidden sm:inline">SPEED LIMIT: 60 KM/H</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
            {isConnected ? 'TraCI HARD SYNC' : 'SIMULATOR ACTIVE'}
          </span>
        </div>
      </div>
    </div>
  );
}
