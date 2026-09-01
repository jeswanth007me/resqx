import { useState, useEffect, useRef } from 'react';
import type { TelemetryData } from '../types/telemetry';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { sirenAudio } from '../utils/sirenAudio';
import { SimulationViewport3D } from './SimulationViewport3D';

interface SimulationViewportProps {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
}

export function SimulationViewport({ telemetry, connectionStatus }: SimulationViewportProps) {
  const [zoom, setZoom] = useState<number>(1);
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

  // Map SUMO coordinates to canvas viewport space
  // SUMO corridor geometry: N_START (100, 300) -> SIG-01 (100, 200) -> SIG-02 (100, 100) -> HOSPITAL (100, 0)
  // In Viewport canvas (800x450):
  // N_START: X=80, Y=225
  // SIG-01:  X=300, Y=225
  // SIG-02:  X=520, Y=225
  // HOSPITAL: X=740, Y=225
  const mapSumoToCanvas = (sumoX: number, sumoY: number) => {
    const canvasX = 80 + ((300 - sumoY) / 300) * 660;
    const canvasY = 225 + (sumoX - 100) * 1.5;
    return { x: Math.max(40, Math.min(760, canvasX)), y: Math.max(80, Math.min(370, canvasY)) };
  };

  // Helper to translate SUMO vehicle heading angle to 2D Canvas rotation degrees
  const getCanvasRotation = (sumoAngle: number): number => {
    const norm = ((sumoAngle % 360) + 360) % 360;
    if (Math.abs(norm - 180) < 45) return 0;
    if (Math.abs(norm - 0) < 45 || Math.abs(norm - 360) < 45) return 180;
    if (Math.abs(norm - 90) < 45) return 90;
    if (Math.abs(norm - 270) < 45) return 270;
    return (norm - 180 + 360) % 360;
  };

  const ambPos = amb ? mapSumoToCanvas(amb.x, amb.y) : { x: 80, y: 225 };
  const ambRot = amb ? getCanvasRotation(amb.angle ?? 180) : 0;

  // Calculate pan offset for "Follow Ambulance" mode
  const panOffsetX = followAmbulance ? 400 - ambPos.x : 0;

  // Signal States from telemetry
  const sig01 = telemetry?.signals.find((s) => s.id === 'SIG-01');
  const sig02 = telemetry?.signals.find((s) => s.id === 'SIG-02');

  const sig01Emergency = sig01?.emergencyState ?? 'NORMAL';
  const sig02Emergency = sig02?.emergencyState ?? 'NORMAL';

  // Extract all traffic vehicles from telemetry
  const vehicles = telemetry?.traffic.vehicles ?? [];

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
            linear-gradient(90deg, #DAE2FD 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Top Header Bar — Scenario Name, Connection Status & Camera/Audio Controls */}
      <div className="flex justify-between items-start z-30 pointer-events-none">
        <div className="bg-[#131B2E]/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-xl pointer-events-auto border-l-4 border-l-primary border-y border-r border-outline-variant/30 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-lg">view_in_ar</span>
          </div>
          <div>
            <div className="font-data text-[10px] font-semibold text-primary uppercase tracking-widest leading-tight">
              3D Digital Twin View
            </div>
            <div className="font-headline text-base font-bold text-on-surface leading-tight">
              Metropolitan Corridor 04
            </div>
          </div>
        </div>

        {/* Floating Controls Overlay (2D/3D Mode Switcher, Zoom & Siren Audio) */}
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
                  : 'bg-error shadow-[0_0_8px_#ff5451] animate-pulse'
              }`}
            />
            <span className="font-data text-xs font-semibold text-on-surface">
              {isConnected ? 'SUMO LIVE' : 'DISCONNECTED'}
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
            title={!isMuted ? 'Mute Emergency Siren' : 'Enable Emergency Siren Sound'}
          >
            <span className="material-symbols-outlined text-xl">
              {!isMuted ? 'volume_up' : 'volume_off'}
            </span>
          </button>

          {/* Camera Follow Toggle Button */}
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

          {/* Zoom Controls */}
          <div className="bg-[#131B2E]/90 backdrop-blur-md p-1 rounded-xl shadow-xl border border-outline-variant/30 flex items-center">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.2, 1.8))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">zoom_in</span>
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">zoom_out</span>
            </button>
          </div>
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
          /* 2D Tactical Viewport Fallback */
          <div
            className="w-full h-full relative transition-transform duration-300 ease-out flex items-center justify-center"
            style={{
              transform: `scale(${zoom}) translateX(${panOffsetX}px)`,
            }}
          >
            {/* SVG Corridor Geometry Canvas */}
            <svg viewBox="0 0 800 450" className="w-full h-full max-w-[1000px] max-h-[600px]">
              <defs>
                {/* Asphalt texture pattern */}
                <pattern id="asphalt" width="10" height="10" patternUnits="userSpaceOnUse">
                  <rect width="10" height="10" fill="#121A2B" />
                  <circle cx="2" cy="2" r="0.5" fill="#1E293B" />
                  <circle cx="7" cy="7" r="0.5" fill="#1E293B" />
                </pattern>
                {/* Glowing Green Ribbon Gradient for Active Priority Corridor */}
                <linearGradient id="emergencyCorridorGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4EDEA3" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#4EDEA3" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Cross Street 1 (SIG-01 Intersection) */}
              <rect x="280" y="40" width="40" height="370" fill="url(#asphalt)" rx="4" />
              <line x1="300" y1="40" x2="300" y2="410" stroke="#dae2fd" strokeWidth="1" strokeDasharray="6 6" opacity="0.3" />

              {/* Cross Street 2 (SIG-02 Intersection) */}
              <rect x="500" y="40" width="40" height="370" fill="url(#asphalt)" rx="4" />
              <line x1="520" y1="40" x2="520" y2="410" stroke="#dae2fd" strokeWidth="1" strokeDasharray="6 6" opacity="0.3" />

              {/* MAIN EMERGENCY CORRIDOR ROADWAY */}
              <rect x="60" y="195" width="700" height="60" fill="url(#asphalt)" rx="6" stroke="#2a364f" strokeWidth="2" />
              {/* Double Yellow Center Line */}
              <line x1="60" y1="224" x2="760" y2="224" stroke="#ffb95f" strokeWidth="1.5" />
              <line x1="60" y1="226" x2="760" y2="226" stroke="#ffb95f" strokeWidth="1.5" />

              {/* White Dashed Lane Dividers */}
              <line x1="60" y1="210" x2="760" y2="210" stroke="#dae2fd" strokeWidth="1" strokeDasharray="8 8" opacity="0.4" />
              <line x1="60" y1="240" x2="760" y2="240" stroke="#dae2fd" strokeWidth="1" strokeDasharray="8 8" opacity="0.4" />

              {/* ACTIVE EMERGENCY GREEN WAVE CORRIDOR RIBBON HIGHLIGHT */}
              {isRunning && amb?.status !== 'STAGED' && (
                <rect
                  x={ambPos.x}
                  y="200"
                  width={Math.max(20, (amb?.nextSignal === 'SIG-02' ? 520 : amb?.nextSignal === 'HOSPITAL' ? 740 : 300) - ambPos.x)}
                  height="50"
                  fill="url(#emergencyCorridorGlow)"
                  rx="6"
                  opacity="0.35"
                  className="animate-pulse"
                />
              )}

              {/* STARTING NODE (N_START / FIRE STATION) */}
              <g transform="translate(80, 225)">
                <circle r="22" fill="#131b2e" stroke="#38bdf8" strokeWidth="2" />
                <circle r="6" fill="#38bdf8" />
                <text x="0" y="36" textAnchor="middle" fill="#dae2fd" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  N_START
                </text>
              </g>

              {/* SIGNAL 01 INTERSECTION (SIG-01) */}
              <g transform="translate(300, 225)">
                <rect
                  x="-20"
                  y="-30"
                  width="40"
                  height="60"
                  fill={sig01Emergency === 'EMERGENCY PRIORITY' ? 'rgba(78, 222, 164, 0.25)' : 'none'}
                  stroke={sig01Emergency === 'EMERGENCY PRIORITY' ? '#4edea3' : '#334155'}
                  strokeWidth="2"
                  rx="4"
                />
                <circle
                  r="14"
                  fill={
                    sig01Emergency === 'EMERGENCY PRIORITY'
                      ? '#4edea3'
                      : sig01Emergency === 'PREPARING'
                      ? '#ffb95f'
                      : '#ff5451'
                  }
                  className={sig01Emergency === 'EMERGENCY PRIORITY' ? 'shadow-[0_0_20px_#4edea3]' : ''}
                />
                <text x="0" y="-36" textAnchor="middle" fill="#dae2fd" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  SIG-01
                </text>
                <text x="0" y="46" textAnchor="middle" fill={sig01Emergency === 'EMERGENCY PRIORITY' ? '#4edea3' : '#94a3b8'} fontSize="9" fontFamily="monospace">
                  {sig01Emergency}
                </text>
              </g>

              {/* SIGNAL 02 INTERSECTION (SIG-02) */}
              <g transform="translate(520, 225)">
                <rect
                  x="-20"
                  y="-30"
                  width="40"
                  height="60"
                  fill={sig02Emergency === 'EMERGENCY PRIORITY' ? 'rgba(78, 222, 164, 0.25)' : 'none'}
                  stroke={sig02Emergency === 'EMERGENCY PRIORITY' ? '#4edea3' : '#334155'}
                  strokeWidth="2"
                  rx="4"
                />
                <circle
                  r="14"
                  fill={
                    sig02Emergency === 'EMERGENCY PRIORITY'
                      ? '#4edea3'
                      : sig02Emergency === 'PREPARING'
                      ? '#ffb95f'
                      : '#ff5451'
                  }
                  className={sig02Emergency === 'EMERGENCY PRIORITY' ? 'shadow-[0_0_20px_#4edea3]' : ''}
                />
                <text x="0" y="-36" textAnchor="middle" fill="#dae2fd" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  SIG-02
                </text>
                <text x="0" y="46" textAnchor="middle" fill={sig02Emergency === 'EMERGENCY PRIORITY' ? '#4edea3' : '#94a3b8'} fontSize="9" fontFamily="monospace">
                  {sig02Emergency}
                </text>
              </g>

              {/* DESTINATION HOSPITAL NODE */}
              <g transform="translate(740, 225)">
                <rect x="-24" y="-24" width="48" height="48" rx="8" fill="#131b2e" stroke="#4edea3" strokeWidth="2.5" />
                <path d="M-8 0 H8 M0 -8 V8" stroke="#4edea3" strokeWidth="4" strokeLinecap="round" />
                <text x="0" y="38" textAnchor="middle" fill="#4edea3" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  HOSPITAL
                </text>
              </g>

              {/* NORMAL CITY TRAFFIC VEHICLES (CAR-01 to CAR-04) */}
              {vehicles
                .filter((v) => v.id !== 'AMB-01')
                .map((v) => {
                  const pos = mapSumoToCanvas(v.x, v.y);
                  const rot = getCanvasRotation(v.angle);
                  return (
                    <g key={v.id} transform={`translate(${pos.x}, ${pos.y}) rotate(${rot})`} className="transition-all duration-300 ease-linear">
                      <rect x="-8" y="-4" width="16" height="8" rx="2" fill={v.color || '#4edea3'} stroke="#060e20" strokeWidth="1" />
                      <circle cx="6" cy="-2" r="1" fill="#ffffff" />
                      <circle cx="6" cy="2" r="1" fill="#ffffff" />
                      <text x="0" y="-8" textAnchor="middle" fill="#dae2fd" fontSize="8" fontFamily="monospace">
                        {v.id}
                      </text>
                    </g>
                  );
                })}

              {/* EMERGENCY VEHICLE (AMB-01) */}
              {amb && (
                <g transform={`translate(${ambPos.x}, ${ambPos.y}) rotate(${ambRot})`} className="transition-all duration-200 ease-linear">
                  {/* Flashing Siren Aura Ring */}
                  {isRunning && (
                    <circle
                      r="28"
                      fill={strobeState ? 'rgba(255, 84, 81, 0.25)' : 'rgba(0, 102, 255, 0.25)'}
                      className="animate-ping"
                    />
                  )}
                  {/* Vehicle Body */}
                  <rect x="-14" y="-7" width="28" height="14" rx="3" fill="#ffffff" stroke="#ff5451" strokeWidth="2" />
                  {/* Red Side Stripe */}
                  <rect x="-14" y="-2" width="28" height="4" fill="#ff5451" />
                  {/* Roof Strobe Lights */}
                  <circle cx="0" cy="-4" r="2.5" fill={strobeState ? '#ff0000' : '#002266'} />
                  <circle cx="0" cy="4" r="2.5" fill={!strobeState ? '#0066ff' : '#660000'} />
                  {/* Forward Spotlight Beam */}
                  {isRunning && <polygon points="14,-6 45,-16 45,16 14,6" fill="rgba(255, 255, 255, 0.2)" />}
                  {/* HUD Speed Label */}
                  <text x="0" y="-12" textAnchor="middle" fill="#ff5451" fontSize="10" fontFamily="monospace" fontWeight="bold">
                    AMB-01 ({amb.speedKmh} km/h)
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* BOTTOM TELEMETRY METRICS BANNER */}
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
              {amb?.currentRoad ?? 'E_CORRIDOR_1'}
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
    </div>
  );
}
