import { useState, useEffect, useRef } from 'react';
import type { TelemetryData } from '../types/telemetry';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { sirenAudio } from '../utils/sirenAudio';

interface SimulationViewportProps {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
}

export function SimulationViewport({ telemetry, connectionStatus }: SimulationViewportProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [followAmbulance, setFollowAmbulance] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [strobeState, setStrobeState] = useState<boolean>(false);
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
  // SUMO 180° (South) -> Canvas 0° (Right / East)
  // SUMO 0° (North)   -> Canvas 180° (Left / West)
  // SUMO 90° (East)    -> Canvas 90° (Down / South)
  // SUMO 270° (West)   -> Canvas 270° (Up / North)
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
            <span className="material-symbols-outlined text-lg">location_city</span>
          </div>
          <div>
            <div className="font-data text-[10px] font-semibold text-primary uppercase tracking-widest leading-tight">
              City Operations View
            </div>
            <div className="font-headline text-base font-bold text-on-surface leading-tight">
              Metropolitan Corridor 04
            </div>
          </div>
        </div>

        {/* Control Buttons (Sound, Follow Camera, Zoom) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Mute/Sound Toggle Button */}
          <button
            onClick={handleToggleAudio}
            className={`px-3 py-2 rounded-xl backdrop-blur-md font-data text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer shadow-md ${
              !isMuted
                ? 'bg-secondary/20 text-secondary border-secondary/40 shadow-secondary/10'
                : 'bg-[#171F33]/80 text-on-surface-variant border-outline-variant/30 hover:bg-[#222A3D]'
            }`}
            title={isMuted ? 'Enable Ambulance Siren Sound' : 'Mute Siren'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {!isMuted ? 'volume_up' : 'volume_off'}
            </span>
            <span>{!isMuted ? 'SIREN ON' : 'MUTED'}</span>
          </button>

          {/* Follow Ambulance Camera Toggle */}
          <button
            onClick={() => setFollowAmbulance(!followAmbulance)}
            className={`px-3 py-2 rounded-xl backdrop-blur-md font-data text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer shadow-md ${
              followAmbulance
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-[#171F33]/80 text-on-surface-variant border-outline-variant/30 hover:bg-[#222A3D]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            <span>{followAmbulance ? 'FOLLOWING AMB-01' : 'FREE CAM'}</span>
          </button>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-[#171F33]/90 backdrop-blur-md rounded-xl p-1 border border-outline-variant/30">
            <button
              onClick={() => setZoom((z) => Math.max(0.75, z - 0.15))}
              className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-surface border-none bg-transparent cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <span className="font-data text-[10px] font-semibold text-on-surface px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.15))}
              className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-surface border-none bg-transparent cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
            <button
              onClick={() => { setZoom(1); setFollowAmbulance(true); }}
              className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-secondary border-none bg-transparent cursor-pointer ml-1"
              title="Reset View"
            >
              <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
            </button>
          </div>

          {/* Live SUMO Telemetry Badge */}
          <div className="bg-[#131B2E]/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 border border-outline-variant/30">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? (isRunning ? 'bg-secondary animate-ping' : 'bg-secondary') : 'bg-error'}`} />
            <span className="font-data text-xs font-semibold text-on-surface tracking-wider uppercase">
              {isConnected ? (isRunning ? 'SUMO LIVE' : isArrived ? 'COMPLETE' : 'CONNECTED') : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive 2.5D City Canvas Engine */}
      <div className="relative flex-1 my-2 flex items-center justify-center z-10 overflow-hidden rounded-xl bg-[#091122]">
        {/* Disconnect Warning Banner */}
        {!isConnected && (
          <div className="absolute inset-0 bg-[#060E20]/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-error-container/30 flex items-center justify-center text-error mb-1">
              <span className="material-symbols-outlined text-2xl">signal_disconnected</span>
            </div>
            <div className="font-headline text-lg font-bold text-on-surface">
              SUMO TELEMETRY DISCONNECTED
            </div>
            <div className="font-data text-xs text-on-surface-variant max-w-md">
              Run <code className="bg-surface-container-highest px-2 py-1 rounded text-primary">python telemetry_server.py</code> in terminal. React will automatically reconnect when online.
            </div>
          </div>
        )}

        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${panOffsetX}px, 0px)`,
          }}
        >
          <svg className="w-full h-full max-h-[500px]" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Emergency Lighting Filters */}
              <filter id="ambulance-red-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="ambulance-blue-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="priority-green-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Building Facade Patterns */}
              <pattern id="building-windows-1" width="10" height="15" patternUnits="userSpaceOnUse">
                <rect width="10" height="15" fill="#131B2E" />
                <rect x="2" y="3" width="6" height="8" fill="#DAE2FD" opacity="0.15" />
              </pattern>
              <pattern id="building-windows-active" width="12" height="18" patternUnits="userSpaceOnUse">
                <rect width="12" height="18" fill="#171F33" />
                <rect x="2" y="3" width="8" height="10" fill="#FFB95F" opacity="0.4" />
              </pattern>
            </defs>

            {/* ─── CITY ENVIRONMENT & BUILDINGS ─────────────────────────────── */}
            {/* North City Blocks (Top of Boulevard) */}
            <g id="city-north-blocks">
              <rect x="40" y="30" width="200" height="110" rx="8" fill="#131B2E" stroke="#222A3D" strokeWidth="2" />
              <rect x="50" y="40" width="180" height="90" fill="url(#building-windows-1)" />
              <rect x="60" y="50" width="60" height="40" fill="#171F33" stroke="#2D3449" />
              <text x="70" y="75" fill="#E4BEBA" fontSize="10" fontFamily="Inter">TECH PARK A</text>

              <rect x="320" y="30" width="160" height="110" rx="8" fill="#171F33" stroke="#2D3449" strokeWidth="2" />
              <rect x="330" y="40" width="140" height="90" fill="url(#building-windows-active)" />
              <text x="350" y="75" fill="#FFB95F" fontSize="10" fontWeight="600" fontFamily="Inter">COMMERCIAL PLAZA</text>

              <rect x="540" y="30" width="220" height="110" rx="8" fill="#131B2E" stroke="#222A3D" strokeWidth="2" />
              <rect x="550" y="40" width="200" height="90" fill="url(#building-windows-1)" />
              <text x="580" y="75" fill="#DAE2FD" fontSize="10" fontFamily="Inter">CIVIC CENTER</text>
            </g>

            {/* South City Blocks (Bottom of Boulevard) */}
            <g id="city-south-blocks">
              <rect x="40" y="310" width="200" height="110" rx="8" fill="#131B2E" stroke="#222A3D" strokeWidth="2" />
              <rect x="50" y="320" width="180" height="90" fill="url(#building-windows-1)" />
              <text x="70" y="360" fill="#E4BEBA" fontSize="10" fontFamily="Inter">RESIDENTIAL DISTRICT</text>

              <rect x="320" y="310" width="160" height="110" rx="8" fill="#171F33" stroke="#2D3449" strokeWidth="2" />
              <rect x="330" y="320" width="140" height="90" fill="url(#building-windows-1)" />
              <text x="350" y="360" fill="#DAE2FD" fontSize="10" fontFamily="Inter">FINANCIAL SECTOR</text>

              {/* HOSPITAL COMPLEX DESTINATION */}
              <g id="hospital-complex" transform="translate(540, 310)">
                <rect x="0" y="0" width="220" height="110" rx="12" fill="#171F33" stroke="#4EDEA3" strokeWidth="3" filter={isArrived ? 'url(#priority-green-glow)' : undefined} />
                <rect x="10" y="10" width="200" height="90" fill="#131B2E" rx="6" />
                
                {/* Emergency Cross Icon & Glowing Header */}
                <circle cx="45" cy="55" r="24" fill="#003824" stroke="#4EDEA3" strokeWidth="2" />
                <path d="M 45,41 V 69 M 31,55 H 59" stroke="#4EDEA3" strokeWidth="6" strokeLinecap="round" />
                
                <text x="80" y="48" fill="#4EDEA3" fontSize="14" fontWeight="700" fontFamily="Inter">CITY GENERAL</text>
                <text x="80" y="65" fill="#DAE2FD" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono">EMERGENCY CENTER</text>

                {/* Helipad Symbol */}
                <circle cx="175" cy="55" r="18" fill="transparent" stroke="#4EDEA3" strokeWidth="2" strokeDasharray="4 4" />
                <text x="175" y="60" fill="#4EDEA3" fontSize="14" fontWeight="700" fontFamily="Inter" textAnchor="middle">H</text>

                <rect x="10" y="85" width="200" height="15" fill="#00A572" opacity="0.2" rx="3" />
                <text x="110" y="96" fill="#4EDEA3" fontSize="9" fontWeight="600" fontFamily="JetBrains Mono" textAnchor="middle">AMBULANCE BAY READY</text>
              </g>
            </g>

            {/* ─── ROAD NETWORK & CORRIDOR ───────────────────────────────────── */}
            <g id="road-network">
              {/* Sidewalk Borders */}
              <rect x="20" y="155" width="760" height="140" fill="#0E1626" rx="4" />
              <rect x="30" y="160" width="740" height="130" fill="#131F37" rx="2" />

              {/* Asphalt Main Boulevard (4 Lanes) */}
              <rect x="30" y="165" width="740" height="120" fill="#182236" />

              {/* Double Yellow Center Line Divider */}
              <line x1="30" y1="224" x2="770" y2="224" stroke="#FFB95F" strokeWidth="2" />
              <line x1="30" y1="226" x2="770" y2="226" stroke="#FFB95F" strokeWidth="2" />

              {/* White Dashed Lane Dividers */}
              <line x1="30" y1="195" x2="770" y2="195" stroke="#DAE2FD" strokeWidth="1.5" strokeDasharray="12 12" opacity="0.5" />
              <line x1="30" y1="255" x2="770" y2="255" stroke="#DAE2FD" strokeWidth="1.5" strokeDasharray="12 12" opacity="0.5" />

              {/* Cross Street 1 (SIG-01 Intersection) */}
              <rect x="260" y="30" width="80" height="390" fill="#182236" />
              <line x1="260" y1="165" x2="260" y2="285" stroke="#DAE2FD" strokeWidth="4" strokeDasharray="6 6" />
              <line x1="340" y1="165" x2="340" y2="285" stroke="#DAE2FD" strokeWidth="4" strokeDasharray="6 6" />

              {/* Cross Street 2 (SIG-02 Intersection) */}
              <rect x="480" y="30" width="80" height="390" fill="#182236" />
              <line x1="480" y1="165" x2="480" y2="285" stroke="#DAE2FD" strokeWidth="4" strokeDasharray="6 6" />
              <line x1="560" y1="165" x2="560" y2="285" stroke="#DAE2FD" strokeWidth="4" strokeDasharray="6 6" />

              {/* Active Emergency Green Wave Corridor Overlay */}
              <path
                d="M 30,225 L 770,225"
                stroke="#4EDEA3"
                strokeWidth="48"
                opacity="0.08"
                strokeLinecap="round"
              />
              <path
                d={`M 30,225 L ${ambPos.x},225`}
                stroke="#FF5451"
                strokeWidth="6"
                opacity="0.6"
                strokeDasharray="8 6"
              />
            </g>

            {/* ─── TRAFFIC SIGNALS & OVERHEAD GANTRIES ────────────────────────── */}
            {/* SIG-01 Gantry */}
            <g id="gantry-sig-01" transform="translate(300, 160)">
              {/* Overhead Steel Structure */}
              <rect x="-35" y="-35" width="70" height="8" fill="#2D3449" rx="2" />
              <line x1="0" y1="-35" x2="0" y2="-5" stroke="#2D3449" strokeWidth="3" />
              
              {/* Traffic Light Housing */}
              <rect x="-16" y="-30" width="32" height="24" rx="4" fill="#060E20" stroke="#5B403E" strokeWidth="1.5" />
              
              {/* 3 Light Bulbs (Red, Yellow, Green) */}
              <circle cx="-8" cy="-18" r="5" fill={sig01Emergency === 'EMERGENCY PRIORITY' ? '#FF5451' : '#690005'} />
              <circle cx="0" cy="-18" r="5" fill={sig01Emergency === 'PREPARING' ? '#FFB95F' : '#472A00'} className={sig01Emergency === 'PREPARING' ? 'animate-pulse' : undefined} />
              <circle cx="8" cy="-18" r="5" fill={sig01Emergency === 'EMERGENCY PRIORITY' ? '#4EDEA3' : '#003824'} filter={sig01Emergency === 'EMERGENCY PRIORITY' ? 'url(#priority-green-glow)' : undefined} />

              {/* Status Callout Badge */}
              <g transform="translate(0, -50)">
                <rect x="-45" y="-12" width="90" height="22" rx="4" fill="#131B2E" stroke={sig01Emergency === 'EMERGENCY PRIORITY' ? '#4EDEA3' : sig01Emergency === 'PREPARING' ? '#FFB95F' : '#AB8986'} strokeWidth="1.5" />
                <text x="0" y="3" fill="#DAE2FD" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono" textAnchor="middle">
                  SIG-01: {sig01Emergency}
                </text>
              </g>
            </g>

            {/* SIG-02 Gantry */}
            <g id="gantry-sig-02" transform="translate(520, 160)">
              {/* Overhead Steel Structure */}
              <rect x="-35" y="-35" width="70" height="8" fill="#2D3449" rx="2" />
              <line x1="0" y1="-35" x2="0" y2="-5" stroke="#2D3449" strokeWidth="3" />
              
              {/* Traffic Light Housing */}
              <rect x="-16" y="-30" width="32" height="24" rx="4" fill="#060E20" stroke="#5B403E" strokeWidth="1.5" />
              
              {/* 3 Light Bulbs */}
              <circle cx="-8" cy="-18" r="5" fill={sig02Emergency === 'EMERGENCY PRIORITY' ? '#FF5451' : '#690005'} />
              <circle cx="0" cy="-18" r="5" fill={sig02Emergency === 'PREPARING' ? '#FFB95F' : '#472A00'} className={sig02Emergency === 'PREPARING' ? 'animate-pulse' : undefined} />
              <circle cx="8" cy="-18" r="5" fill={sig02Emergency === 'EMERGENCY PRIORITY' ? '#4EDEA3' : '#003824'} filter={sig02Emergency === 'EMERGENCY PRIORITY' ? 'url(#priority-green-glow)' : undefined} />

              {/* Status Callout Badge */}
              <g transform="translate(0, -50)">
                <rect x="-45" y="-12" width="90" height="22" rx="4" fill="#131B2E" stroke={sig02Emergency === 'EMERGENCY PRIORITY' ? '#4EDEA3' : sig02Emergency === 'PREPARING' ? '#FFB95F' : '#AB8986'} strokeWidth="1.5" />
                <text x="0" y="3" fill="#DAE2FD" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono" textAnchor="middle">
                  SIG-02: {sig02Emergency}
                </text>
              </g>
            </g>

            {/* ─── NORMAL TRAFFIC VEHICLES (FROM SUMO TELEMETRY) ──────────────── */}
            <g id="normal-vehicles">
              {vehicles
                .filter((v) => v.id !== 'AMB-01')
                .map((v) => {
                  const pt = mapSumoToCanvas(v.x, v.y);
                  const rot = getCanvasRotation(v.angle);
                  const carColor = v.color || '#4EDEA3';

                  return (
                    <g
                      key={v.id}
                      transform={`translate(${pt.x}, ${pt.y}) rotate(${rot})`}
                      style={{ transition: 'transform 0.1s linear' }}
                    >
                      {/* Car Body */}
                      <rect x="-14" y="-7" width="28" height="14" rx="4" fill={carColor} stroke="#060E20" strokeWidth="1.5" />
                      {/* Windshield */}
                      <rect x="-4" y="-5" width="8" height="10" rx="2" fill="#060E20" opacity="0.7" />
                      {/* Headlights */}
                      <circle cx="12" cy="-4" r="2" fill="#FFF" />
                      <circle cx="12" cy="4" r="2" fill="#FFF" />
                      {/* Taillights */}
                      <circle cx="-13" cy="-5" r="1.5" fill="#FF5451" />
                      <circle cx="-13" cy="5" r="1.5" fill="#FF5451" />
                      {/* Vehicle Label */}
                      <text x="0" y="-12" fill="#DAE2FD" fontSize="8" fontWeight="600" fontFamily="JetBrains Mono" textAnchor="middle">
                        {v.id}
                      </text>
                    </g>
                  );
                })}
            </g>

            {/* ─── AMBULANCE (AMB-01) ─────────────────────────────────────────── */}
            <g
              id="ambulance-amb-01"
              transform={`translate(${ambPos.x}, ${ambPos.y}) rotate(${ambRot})`}
              style={{ transition: 'transform 0.1s linear' }}
            >
              {/* Emergency Aura Glow */}
              <circle
                r="30"
                fill={strobeState ? '#FF5451' : '#0066CC'}
                opacity="0.35"
                filter={strobeState ? 'url(#ambulance-red-glow)' : 'url(#ambulance-blue-glow)'}
              />

              {/* Chassis Base */}
              <rect x="-22" y="-12" width="44" height="24" rx="6" fill="#FFFFFF" stroke="#FF5451" strokeWidth="2.5" />
              
              {/* Medical Red Cross on Roof */}
              <path d="M 0,-6 V 6 M -6,0 H 6" stroke="#FF5451" strokeWidth="4" strokeLinecap="round" />
              
              {/* Windshield */}
              <rect x="8" y="-9" width="8" height="18" rx="2" fill="#060E20" opacity="0.8" />
              
              {/* Dual Strobe Lights (Flashing Red / Blue) */}
              <circle cx="2" cy="-10" r="3" fill={strobeState ? '#FF0000' : '#000'} />
              <circle cx="2" cy="10" r="3" fill={!strobeState ? '#0066FF' : '#000'} />

              {/* Headlight Beams */}
              <polygon points="20,-6 45,-15 45,15 20,6" fill="#FFF" opacity="0.25" />

              {/* Dynamic Callout Badge */}
              <g transform="translate(0, -34)">
                <rect x="-40" y="-12" width="80" height="20" rx="4" fill="#060E20" stroke="#FF5451" strokeWidth="1.5" />
                <text x="0" y="2" fill="#FFB3AD" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono" textAnchor="middle">
                  AMB-01 • {amb?.speedKmh ?? 0} km/h
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* Bottom Telemetry Status Bar */}
      <div className="bg-[#131B2E]/95 backdrop-blur-md p-3.5 rounded-xl border border-surface-container-highest grid grid-cols-5 gap-3 z-30 shadow-lg">
        <div>
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
            Active Unit
          </div>
          <div className="font-headline text-base font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">ambulance</span>
            {amb?.id ?? 'AMB-01'}
          </div>
        </div>

        <div>
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
            Unit Speed
          </div>
          <div className="font-data text-base font-semibold text-on-surface">
            {amb?.speedKmh ?? 0} <span className="text-xs text-on-surface-variant font-normal">km/h</span>
          </div>
        </div>

        <div>
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-0.5">
            Next Intersect
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
  );
}
