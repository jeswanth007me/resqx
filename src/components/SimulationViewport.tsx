import { useState, useEffect, useRef } from 'react';
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
      className="flex-1 relative bg-[#171717] overflow-hidden rounded border border-[#242424] flex flex-col justify-between select-none min-h-[460px]"
    >
      {/* ── TOP HEADER CONTROLS BAR ─────────────────────────────────── */}
      <div className="h-10 px-4 bg-[#141414] border-b border-[#242424] flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold tracking-widest text-[#F5F5F5] uppercase">
            CORRIDOR DIGITAL TWIN
          </span>
          <span className="font-mono text-[10px] text-[#737373] hidden sm:inline">
            LIVE URBAN TRAFFIC REPLICATION
          </span>
        </div>

        {/* View Mode Switcher + Audio + Camera Controls */}
        <div className="flex items-center gap-2.5">
          {/* 2D vs 3D Toggle */}
          <div className="flex items-center bg-[#1e1e1e] p-0.5 rounded border border-[#2a2a2a]">
            <button
              onClick={() => setViewMode('2D')}
              className={`px-3 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                viewMode === '2D'
                  ? 'bg-[#111111] text-[#F5F5F5] font-bold shadow-xs border border-[#333333]'
                  : 'text-[#737373] hover:text-[#F5F5F5]'
              }`}
            >
              2D MAP
            </button>
            <button
              onClick={() => setViewMode('3D')}
              className={`px-3 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                viewMode === '3D'
                  ? 'bg-[#111111] text-[#F5F5F5] font-bold shadow-xs border border-[#333333]'
                  : 'text-[#737373] hover:text-[#F5F5F5]'
              }`}
            >
              3D TWIN
            </button>
          </div>

          <div className="h-3.5 w-px bg-[#262626]" />

          {/* Audio Siren Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer border ${
              !isMuted
                ? 'bg-[#d04848]/20 border-[#d04848] text-[#d04848] animate-pulse'
                : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#737373] hover:text-[#F5F5F5]'
            }`}
            title={!isMuted ? 'Mute emergency siren' : 'Unmute emergency siren'}
          >
            <span className="material-symbols-outlined text-[15px]">
              {!isMuted ? 'volume_up' : 'volume_off'}
            </span>
          </button>

          {/* 3D Follow Cam Toggle */}
          {viewMode === '3D' && (
            <button
              onClick={() => setFollowAmbulance(!followAmbulance)}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                followAmbulance
                  ? 'bg-[#38a169]/15 border-[#38a169]/40 text-[#38a169]'
                  : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#737373] hover:text-[#F5F5F5]'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">my_location</span>
              {followAmbulance ? 'LOCK AMB' : 'FREE CAM'}
            </button>
          )}
        </div>
      </div>

      {/* ── VIEWPORT CANVAS (2D Tactical Map by default, 3D WebGL optionally) ── */}
      <div className="relative flex-1 w-full h-full bg-[#0c0c0c] overflow-hidden flex items-center justify-center">
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
      <div className="h-7 px-4 bg-[#141414] border-t border-[#242424] flex items-center justify-between text-[#737373] font-mono text-[10px] shrink-0">
        <div className="flex items-center gap-4">
          <span>GRID: RES-100m</span>
          <span>CORRIDOR: 4-LANE ARTERIAL (4 JUNCTIONS)</span>
          <span className="hidden sm:inline">SPEED LIMIT: 60 KM/H</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#38a169]' : 'bg-[#d97706]'}`} />
          <span className={isConnected ? 'text-[#38a169] font-semibold' : 'text-[#d97706]'}>
            {isConnected ? 'TraCI HARD SYNC' : 'SIMULATOR ACTIVE'}
          </span>
        </div>
      </div>
    </div>
  );
}
