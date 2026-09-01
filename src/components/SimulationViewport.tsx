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
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
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
      className="flex-1 relative bg-[#060E20] overflow-hidden rounded-2xl shadow-2xl border border-surface-container-highest flex flex-col justify-between p-4 select-none"
    >
      {/* City Background Texture & Ambient Glow */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#DAE2FD 1px, transparent 1px),
            linear-gradient(to right, #DAE2FD 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* TOP FLOATING OVERLAY BAR */}
      <div className="flex items-center justify-between z-30 pointer-events-none">
        {/* Scenario and Ambulance Status Badge */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-[#131B2E]/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl border border-outline-variant/30 flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isRunning
                  ? strobeState
                    ? 'bg-error shadow-[0_0_12px_#ff5451]'
                    : 'bg-primary shadow-[0_0_12px_#38bdf8]'
                  : 'bg-on-surface-variant/40'
              }`}
            />
            <div>
              <div className="font-headline text-xs font-bold text-on-surface tracking-wider">
                {amb?.status === 'ARRIVED'
                  ? 'DESTINATION REACHED'
                  : isRunning
                  ? 'EMERGENCY ACTIVE'
                  : 'MISSION READY'}
              </div>
              <div className="font-data text-[10px] text-on-surface-variant uppercase">
                Corridor 04 • Green Wave Priority
              </div>
            </div>
          </div>
        </div>

        {/* Floating Controls Overlay (2D/3D Mode Switcher, Follow Cam & Siren Audio) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 3D vs 2D Toggle Switcher */}
          <div className="bg-[#131B2E]/90 backdrop-blur-md p-1 rounded-xl shadow-xl border border-outline-variant/30 flex items-center gap-1">
            <button
              onClick={() => setViewMode('3D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-data font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === '3D'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-variant/40'
              }`}
            >
              <span className="material-symbols-outlined text-sm">3d_rotation</span>
              3D DIGITAL TWIN
            </button>
            <button
              onClick={() => setViewMode('2D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-data font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === '2D'
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-variant/40'
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              2D TACTICAL
            </button>
          </div>

          {/* Connection Status Badge */}
          <div className="bg-[#131B2E]/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-xl border border-outline-variant/30 flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-tertiary shadow-[0_0_8px_#ffb95f]'
              }`}
            />
            <span className="font-data text-xs font-semibold text-on-surface">
              {isConnected ? 'SUMO LIVE' : 'LOCAL SIMULATION'}
            </span>
          </div>

          {/* Audio Siren Toggle Button */}
          <button
            onClick={handleToggleAudio}
            className={`w-10 h-10 rounded-xl shadow-xl border backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
              !isMuted
                ? 'bg-error/20 border-error text-error shadow-[0_0_12px_rgba(255,84,81,0.4)] animate-pulse'
                : 'bg-[#131B2E]/90 border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/50'
            }`}
            title={!isMuted ? 'Mute emergency siren' : 'Unmute emergency siren'}
          >
            <span className="material-symbols-outlined text-xl">
              {!isMuted ? 'volume_up' : 'volume_off'}
            </span>
          </button>

          {/* Camera Follow Toggle Button (for 3D mode) */}
          {viewMode === '3D' && (
            <button
              onClick={() => setFollowAmbulance(!followAmbulance)}
              className={`px-3 py-2 rounded-xl text-xs font-data font-semibold shadow-xl border backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 ${
                followAmbulance
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-[#131B2E]/90 border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/50'
              }`}
              title="Lock camera to AMB-01 position"
            >
              <span className="material-symbols-outlined text-sm">my_location</span>
              {followAmbulance ? 'FOLLOWING' : 'FREE CAM'}
            </button>
          )}
        </div>
      </div>

      {/* VIEWPORT CANVAS CONTAINER (3D Digital Twin vs 2D Tactical View) */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        {viewMode === '3D' ? (
          /* Real Three.js WebGL 3D Digital Twin Viewport */
          <SimulationViewport3D
            telemetry={telemetry}
            followAmbulance={followAmbulance}
            strobeState={strobeState}
          />
        ) : (
          /* High-Contrast 2D Tactical Command-Center Viewport */
          <TacticalCommandView2D
            telemetry={telemetry}
            connectionStatus={connectionStatus}
          />
        )}
      </div>

      {/* BOTTOM TELEMETRY METRICS BANNER (3D Mode overlay) */}
      {viewMode === '3D' && (
        <div className="bg-[#131B2E]/90 backdrop-blur-md px-5 py-3 rounded-xl shadow-xl z-30 pointer-events-auto border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
                Ambulance Speed
              </div>
              <div className="font-data text-base font-bold text-primary flex items-center gap-1">
                {amb?.speedKmh ?? 0} <span className="text-xs text-on-surface-variant font-normal">km/h</span>
              </div>
            </div>

            <div className="w-px h-8 bg-outline-variant/30" />

            <div>
              <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
                Current Road
              </div>
              <div className="font-data text-sm font-semibold text-on-surface">
                {amb?.currentRoad ?? 'ROAD-01'}
              </div>
            </div>

            <div className="w-px h-8 bg-outline-variant/30" />

            <div>
              <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
                Next Intercept Signal
              </div>
              <div className="font-data text-sm font-semibold text-tertiary">
                {amb?.nextSignal ?? 'SIG-01'}
              </div>
            </div>

            <div>
              <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
                Distance
              </div>
              <div className="font-data text-base font-semibold text-secondary">
                {amb?.distanceToNextSignal ?? 0} <span className="text-xs text-on-surface-variant font-normal">m</span>
              </div>
            </div>

            <div>
              <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
                Time Saved
              </div>
              <div className="font-data text-base font-semibold text-secondary">
                +{telemetry?.mission.timeSaved ?? 0} <span className="text-xs text-on-surface-variant font-normal">sec</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
