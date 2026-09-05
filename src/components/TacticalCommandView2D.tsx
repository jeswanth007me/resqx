/**
 * ResQX 2D Tactical Command-Center Digital Twin
 *
 * Professional, dark EOC vector corridor with real-time SUMO/TraCI telemetry:
 * AMB-01 → SIG-01 → SIG-02 → SIG-03 → SIG-04 → HOSPITAL
 */

import { useState, useMemo } from 'react';
import type { TelemetryData } from '../types/telemetry';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { PoliceCoordinator } from '../services/policeCoordinator';
import { getDefaultCityGraph } from '../routing/graph';
import { calculateAmbulanceRoute } from '../routing/engine';
import { calculateAmbulanceEta } from '../routing/eta';
import { planEmergencyCorridor } from '../routing/corridor';
import { validateCorridorPlan } from '../safety/validator';

interface TacticalCommandView2DProps {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
  onSelectSignal?: (signalId: string) => void;
}

const JUNCTIONS = [
  { id: 'SIG-01', name: '4th & Maple Ave', x: 220, sumoY: 230 },
  { id: 'SIG-02', name: '6th & Maple Ave', x: 400, sumoY: 170 },
  { id: 'SIG-03', name: '8th & Maple Ave', x: 580, sumoY: 110 },
  { id: 'SIG-04', name: 'Hospital Way', x: 760, sumoY: 50 },
] as const;

export function TacticalCommandView2D({
  telemetry,
  connectionStatus,
}: TacticalCommandView2DProps) {
  const [selectedJunctionId, setSelectedJunctionId] = useState<string>('SIG-02');
  const coordinator = useMemo(() => new PoliceCoordinator(), []);

  const isConnected = connectionStatus === 'CONNECTED';
  const amb = telemetry?.ambulance;
  const isRunning = telemetry?.simulation.running ?? false;
  const isArrived = amb?.status === 'ARRIVED';

  // Compute live single source of truth for corridor & safety validation
  const { etaResult, safetyResult, policeAssignments } = useMemo(() => {
    const defaultGraph = getDefaultCityGraph();
    const route = calculateAmbulanceRoute(defaultGraph);
    const eta = calculateAmbulanceEta({
      routeResult: route,
      ambulance: {
        speedKmh: amb?.speedKmh ?? 50,
        currentRoadId: amb?.currentRoad ?? 'ROAD-01',
        progressOnCurrentRoad: 0,
        status: amb?.status ?? 'EN_ROUTE',
      },
      signals: [
        { id: 'SIG-01', name: 'North Gate', road: 'ROAD-01', position: { x: 300, y: 150 } },
        { id: 'SIG-02', name: 'Central Intersection', road: 'ROAD-01', position: { x: 300, y: 275 } },
        { id: 'SIG-03', name: 'Hospital Approach', road: 'ROAD-03', position: { x: 300, y: 400 } },
        { id: 'SIG-04', name: 'South Corridor', road: 'ROAD-03', position: { x: 300, y: 525 } },
      ],
    });
    const corridor = planEmergencyCorridor(eta);
    const safety = validateCorridorPlan(corridor);
    const assignments = coordinator.assignOfficersForCorridor(
      corridor,
      amb?.id ?? 'AMB-01',
      telemetry?.simulation.elapsedTime ?? 0
    );

    return {
      etaResult: eta,
      safetyResult: safety,
      policeAssignments: assignments,
    };
  }, [coordinator, amb?.speedKmh, amb?.currentRoad, amb?.status, amb?.id, telemetry?.simulation.elapsedTime]);

  // Selected junction data for inspector
  const selectedAssignment = policeAssignments.find((a) => a.signalId === selectedJunctionId);
  const selectedSignalState = telemetry?.signals.find((s) => s.id === selectedJunctionId);

  // Exact SUMO Y -> 2D SVG X progress mapping (corridor length: Start 70 -> Hospital 910)
  // SUMO Y starts at 300 (North Start) and reaches 0 (Hospital)
  const ambProgress = useMemo(() => {
    if (!amb || !Number.isFinite(amb.y)) return 0.05;
    return Math.max(0, Math.min(1, (300 - amb.y) / 300));
  }, [amb]);

  const ambX = 70 + ambProgress * 840;
  const ambY = 195;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0c0c0c] text-[#F5F5F5] overflow-hidden select-none">
      {/* ── 1. TACTICAL STATUS BAR (DARK EOC HEADER) ────────────────── */}
      <div className="h-9 px-4 bg-[#141414] border-b border-[#242424] flex items-center justify-between gap-4 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38a169] animate-pulse" />
            <span className="font-mono text-[10px] font-bold text-[#F5F5F5] tracking-widest uppercase">
              2D TACTICAL DIGITAL TWIN
            </span>
          </div>
          <div className="h-3 w-px bg-[#262626]" />
          <span className="text-[10px] font-mono text-[#A3A3A3]">
            {isConnected ? 'SUMO / TraCI HARD SYNC' : 'STANDBY SIMULATOR'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[#737373] uppercase text-[9px]">CORRIDOR:</span>
            <span className="font-bold text-[#38a169]">
              {isArrived ? 'MISSION COMPLETE' : isRunning ? 'GREEN WAVE ACTIVE' : 'STAGED READY'}
            </span>
          </div>

          <div className="h-3 w-px bg-[#262626]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#737373] uppercase text-[9px]">UNIT:</span>
            <span className="font-bold text-[#d04848]">
              AMB-01 ({amb ? `${Math.round(amb.speedKmh)} km/h` : '0 km/h'})
            </span>
          </div>

          <div className="h-3 w-px bg-[#262626]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#737373] uppercase text-[9px]">ETA:</span>
            <span className="font-bold text-[#F5F5F5]">
              {amb ? `${amb.etaSeconds}s` : etaResult.formattedEta}
            </span>
          </div>

          <div className="h-3 w-px bg-[#262626] hidden md:block" />

          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[#737373] uppercase text-[9px]">SAFETY:</span>
            <span
              className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                safetyResult.decision === 'APPROVED'
                  ? 'bg-[#38a169]/15 text-[#38a169] border border-[#38a169]/30'
                  : 'bg-[#d04848]/15 text-[#d04848] border border-[#d04848]/30'
              }`}
            >
              {safetyResult.decision}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. SVG VECTOR TACTICAL CORRIDOR MAP ──────────────────────── */}
      <div className="relative flex-1 w-full h-full bg-[#0d0d0d] overflow-hidden flex items-center justify-center p-2">
        {/* Subtle EOC Grid Background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(#1a1a1a 1px, transparent 1px),
              linear-gradient(to right, #1a1a1a 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        <svg viewBox="0 0 1020 380" className="w-full h-full max-h-[480px] select-none">
          <defs>
            {/* Green Wave Glow */}
            <filter id="tacGreenGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Ambulance Beacon Glow */}
            <filter id="tacAmbGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Hospital Cross Glow */}
            <filter id="tacHospGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── 2A. CROSS STREETS & PEDESTRIAN ZEBRA CROSSINGS ── */}
          {JUNCTIONS.map((j) => (
            <g key={`cross-${j.id}`}>
              {/* Cross Street Road Base */}
              <rect
                x={j.x - 22}
                y="35"
                width="44"
                height="320"
                fill="#161616"
                stroke="#242424"
                strokeWidth="1"
                rx="2"
              />
              {/* Cross Street Dashed Centerline */}
              <line
                x1={j.x}
                y1="35"
                x2={j.x}
                y2="355"
                stroke="#2a2a2a"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
              {/* Cross Street Stop Line (North approach) */}
              <line
                x1={j.x - 20}
                y1="160"
                x2={j.x + 20}
                y2="160"
                stroke="#444444"
                strokeWidth="2.5"
              />
              {/* Cross Street Stop Line (South approach) */}
              <line
                x1={j.x - 20}
                y1="230"
                x2={j.x + 20}
                y2="230"
                stroke="#444444"
                strokeWidth="2.5"
              />
              {/* Zebra Crossings */}
              <g stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2">
                <line x1={j.x - 16} y1="166" x2={j.x - 6} y2="166" />
                <line x1={j.x + 6} y1="166" x2={j.x + 16} y2="166" />
                <line x1={j.x - 16} y1="224" x2={j.x - 6} y2="224" />
                <line x1={j.x + 6} y1="224" x2={j.x + 16} y2="224" />
              </g>
              {/* Cross-traffic Vehicle Held at Red Light */}
              <rect
                x={j.x - 8}
                y="115"
                width="16"
                height="28"
                rx="3"
                fill="#2c2c2c"
                stroke="#3a3a3a"
                strokeWidth="1"
              />
              <rect
                x={j.x - 8}
                y="245"
                width="16"
                height="28"
                rx="3"
                fill="#262626"
                stroke="#333333"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* ── 2B. MAIN ARTERIAL EMERGENCY CORRIDOR ROADWAY ── */}
          {/* Main Asphalt Foundation */}
          <rect
            x="30"
            y="165"
            width="900"
            height="60"
            fill="#181818"
            stroke="#2a2a2a"
            strokeWidth="1.5"
            rx="3"
          />

          {/* Curbs */}
          <line x1="30" y1="165" x2="930" y2="165" stroke="#333333" strokeWidth="2" />
          <line x1="30" y1="225" x2="930" y2="225" stroke="#333333" strokeWidth="2" />

          {/* Lane Dashed Centerlines */}
          <line
            x1="40"
            y1="180"
            x2="920"
            y2="180"
            stroke="#282828"
            strokeWidth="1.5"
            strokeDasharray="12 10"
          />
          <line
            x1="40"
            y1="210"
            x2="920"
            y2="210"
            stroke="#282828"
            strokeWidth="1.5"
            strokeDasharray="12 10"
          />

          {/* Double Yellow Median */}
          <line
            x1="40"
            y1="194"
            x2="920"
            y2="194"
            stroke="#d97706"
            strokeWidth="1"
            opacity="0.6"
          />
          <line
            x1="40"
            y1="196"
            x2="920"
            y2="196"
            stroke="#d97706"
            strokeWidth="1"
            opacity="0.6"
          />

          {/* Green Wave Preempted Trajectory Line */}
          <line
            x1="60"
            y1="195"
            x2="910"
            y2="195"
            stroke="#38a169"
            strokeWidth="4"
            strokeDasharray="10 6"
            filter="url(#tacGreenGlow)"
            opacity="0.95"
          />

          {/* Traveled Path Highlight (Behind Ambulance) */}
          <line
            x1="60"
            y1="195"
            x2={Math.min(910, ambX)}
            y2="195"
            stroke="#38a169"
            strokeWidth="5"
            opacity="0.9"
          />

          {/* ── 2C. START DISPATCH NODE (NORTH START) ── */}
          <g transform="translate(60, 195)">
            <circle cx="0" cy="0" r="14" fill="#141414" stroke="#444444" strokeWidth="1.5" />
            <text x="0" y="3.5" textAnchor="middle" fill="#A3A3A3" fontSize="8.5" fontFamily="JetBrains Mono" fontWeight="bold">
              START
            </text>
            <text x="0" y="-18" textAnchor="middle" fill="#737373" fontSize="9" fontFamily="JetBrains Mono">
              NORTH GATE (Y:300)
            </text>
          </g>

          {/* ── 2D. 4 TRAFFIC SIGNAL INTERSECTIONS ── */}
          {JUNCTIONS.map((j) => {
            const sig = telemetry?.signals.find((s) => s.id === j.id);
            const sigState = sig?.emergencyState ?? 'NORMAL';

            const isPriority = sigState === 'EMERGENCY PRIORITY' || (sigState as string) === 'PRIORITY';
            const isPreparing = sigState === 'PREPARING';
            const isRestored = sigState === 'RESTORED' || (sigState as string) === 'RESTORING';

            let tagText = 'NORMAL';
            let tagColor = '#d04848';
            let tagBg = 'rgba(208, 72, 72, 0.15)';
            let bulbGreen = '#222222';
            let bulbYellow = '#222222';
            let bulbRed = '#d04848';

            if (isPriority) {
              tagText = 'PRIORITY';
              tagColor = '#38a169';
              tagBg = 'rgba(56, 161, 105, 0.15)';
              bulbGreen = '#38a169';
              bulbYellow = '#222222';
              bulbRed = '#222222';
            } else if (isPreparing) {
              tagText = 'PREPARING';
              tagColor = '#d97706';
              tagBg = 'rgba(217, 119, 6, 0.15)';
              bulbGreen = '#222222';
              bulbYellow = '#d97706';
              bulbRed = '#222222';
            } else if (isRestored) {
              tagText = 'RESTORED';
              tagColor = '#38a169';
              tagBg = 'rgba(56, 161, 105, 0.15)';
              bulbGreen = '#38a169';
              bulbYellow = '#222222';
              bulbRed = '#222222';
            }

            const isSelected = selectedJunctionId === j.id;

            return (
              <g
                key={j.id}
                className="cursor-pointer"
                onClick={() => setSelectedJunctionId(j.id)}
              >
                {/* Intersection Ring Node */}
                <circle
                  cx={j.x}
                  cy="195"
                  r={isSelected ? 16 : 13}
                  fill="#141414"
                  stroke={isSelected ? '#F5F5F5' : tagColor}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <circle cx={j.x} cy="195" r="4" fill={tagColor} />

                {/* Vertical 3-Light Signal Head (Top) */}
                <g transform={`translate(${j.x - 7}, 75)`}>
                  <rect
                    width="14"
                    height="36"
                    rx="3"
                    fill="#111111"
                    stroke="#333333"
                    strokeWidth="1.2"
                  />
                  {/* Red Bulb */}
                  <circle cx="7" cy="7" r="3.5" fill={bulbRed} />
                  {/* Yellow Bulb */}
                  <circle cx="7" cy="18" r="3.5" fill={bulbYellow} />
                  {/* Green Bulb */}
                  <circle cx="7" cy="29" r="3.5" fill={bulbGreen} />
                </g>

                {/* Pole from head to ground */}
                <line x1={j.x} y1="111" x2={j.x} y2="155" stroke="#333333" strokeWidth="2" />

                {/* Floating Signal Identifier & State Tag */}
                <g transform={`translate(${j.x - 44}, 42)`}>
                  <rect
                    width="88"
                    height="22"
                    rx="3"
                    fill={tagBg}
                    stroke={tagColor}
                    strokeWidth="1.2"
                  />
                  {isPriority && (
                    <circle cx="9" cy="11" r="3" fill="#38a169" className="animate-ping" />
                  )}
                  <circle cx="9" cy="11" r="3" fill={tagColor} />
                  <text
                    x="18"
                    y="15"
                    fill="#F5F5F5"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                  >
                    {j.id}
                  </text>
                  <text
                    x="56"
                    y="15"
                    fill={tagColor}
                    fontSize="8"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                  >
                    [{tagText.substring(0, 4)}]
                  </text>
                </g>

                {/* Junction Street Label (Bottom) */}
                <text
                  x={j.x}
                  y="265"
                  textAnchor="middle"
                  fill="#A3A3A3"
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                >
                  {j.name}
                </text>
                <text
                  x={j.x}
                  y="278"
                  textAnchor="middle"
                  fill="#737373"
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                >
                  (Y:{j.sumoY})
                </text>
              </g>
            );
          })}

          {/* ── 2E. CIVILIAN TRAFFIC VEHICLES (REAL SUMO VEHICLES) ── */}
          {(telemetry?.traffic.vehicles ?? []).map((v) => {
            if (v.type === 'emergency' || v.id === 'AMB-01') return null;
            const vy = 195 + (v.id.charCodeAt(v.id.length - 1) % 2 === 0 ? -9 : 9);
            const vProgress = Math.max(0, Math.min(1, (300 - v.y) / 300));
            const vx = 70 + vProgress * 840;

            return (
              <g key={v.id} transform={`translate(${vx}, ${vy})`}>
                <rect
                  x="-8"
                  y="-4"
                  width="16"
                  height="8"
                  rx="2"
                  fill="#444444"
                  stroke="#555555"
                  strokeWidth="0.8"
                />
              </g>
            );
          })}

          {/* ── 2F. REAL AMBULANCE (AMB-01) WITH PULSING BEACON ── */}
          <g transform={`translate(${ambX}, ${ambY})`}>
            {/* Pulsing Beacon Radar Rings */}
            <circle cx="0" cy="0" r="22" fill="none" stroke="#d04848" strokeWidth="1.5" opacity="0.6">
              <animate attributeName="r" values="12;28;12" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.05;0.8" dur="1.2s" repeatCount="indefinite" />
            </circle>

            {/* Ambulance Body (Crisp White & Red High-Vis Chassis) */}
            <rect
              x="-18"
              y="-8"
              width="36"
              height="16"
              rx="3"
              fill="#ffffff"
              stroke="#d04848"
              strokeWidth="1.5"
            />
            {/* Emergency Red Chevron Side Stripe */}
            <rect x="-14" y="-3" width="28" height="6" fill="#d04848" />
            {/* Front Windshield */}
            <rect x="9" y="-6" width="6" height="12" rx="1" fill="#171717" />
            {/* Dual Red Roof Beacons */}
            <circle cx="-6" cy="0" r="3" fill="#d04848" filter="url(#tacAmbGlow)" className="animate-pulse" />
            <circle cx="6" cy="0" r="3" fill="#d04848" filter="url(#tacAmbGlow)" className="animate-pulse" />

            {/* Callsign Tag Floating Above */}
            <g transform="translate(-46, -34)">
              <rect
                width="92"
                height="22"
                rx="3"
                fill="#141414"
                stroke="#d04848"
                strokeWidth="1.5"
              />
              <circle cx="8" cy="11" r="3" fill="#d04848" className="animate-ping" />
              <circle cx="8" cy="11" r="3" fill="#d04848" />
              <text
                x="16"
                y="15"
                fill="#F5F5F5"
                fontSize="9"
                fontFamily="JetBrains Mono"
                fontWeight="bold"
              >
                AMB-01 [{amb ? `${Math.round(amb.speedKmh)}k` : '42k'}]
              </text>
            </g>
          </g>

          {/* ── 2G. METROPOLITAN GENERAL HOSPITAL DESTINATION ── */}
          <g transform="translate(920, 195)">
            {/* Building Base */}
            <rect
              x="-15"
              y="-40"
              width="65"
              height="80"
              rx="4"
              fill="#181818"
              stroke="#d04848"
              strokeWidth="1.8"
            />
            {/* Glowing Red Cross Icon */}
            <g filter="url(#tacHospGlow)" transform="translate(17, -15)">
              <rect x="-4" y="-12" width="8" height="24" rx="1.5" fill="#d04848" />
              <rect x="-12" y="-4" width="24" height="8" rx="1.5" fill="#d04848" />
            </g>
            {/* Hospital Helipad Text */}
            <text
              x="17"
              y="18"
              textAnchor="middle"
              fill="#F5F5F5"
              fontSize="8"
              fontFamily="JetBrains Mono"
              fontWeight="bold"
            >
              HOSPITAL
            </text>
            <text
              x="17"
              y="28"
              textAnchor="middle"
              fill="#d04848"
              fontSize="7"
              fontFamily="JetBrains Mono"
              fontWeight="bold"
            >
              TERMINUS
            </text>
            {/* Billboard Tag */}
            <g transform="translate(-30, -58)">
              <rect
                width="110"
                height="16"
                rx="2"
                fill="#141414"
                stroke="#d04848"
                strokeWidth="1"
              />
              <text
                x="55"
                y="11"
                textAnchor="middle"
                fill="#F5F5F5"
                fontSize="7.5"
                fontFamily="JetBrains Mono"
                fontWeight="bold"
              >
                METRO GENERAL HOSPITAL
              </text>
            </g>
          </g>
        </svg>

        {/* ── 3. INTERACTIVE JUNCTION INSPECTOR (FLOATING BOTTOM LEFT) ── */}
        {selectedJunctionId && (
          <div className="absolute bottom-2.5 left-2.5 w-76 bg-[#141414]/95 border border-[#262626] rounded p-2.5 z-30 font-mono text-[11px] shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#242424]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11px] text-[#F5F5F5] bg-[#222222] px-1.5 py-0.5 rounded border border-[#333333]">
                  {selectedJunctionId}
                </span>
                <span className="text-[11px] font-medium text-[#A3A3A3]">
                  {JUNCTIONS.find((j) => j.id === selectedJunctionId)?.name ?? 'Corridor Junction'}
                </span>
              </div>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  selectedSignalState?.emergencyState === 'EMERGENCY PRIORITY' ||
                  (selectedSignalState?.emergencyState as string) === 'PRIORITY'
                    ? 'bg-[#38a169]/15 text-[#38a169] border border-[#38a169]/30'
                    : selectedSignalState?.emergencyState === 'PREPARING'
                    ? 'bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30'
                    : 'bg-[#222222] text-[#737373] border border-[#333333]'
                }`}
              >
                {selectedSignalState?.emergencyState ?? 'NORMAL'}
              </span>
            </div>

            <div className="space-y-1 text-[#A3A3A3] text-[10px]">
              <div className="flex justify-between">
                <span>Signal Phase:</span>
                <span className="font-bold text-[#F5F5F5]">
                  {selectedSignalState?.state ?? 'rrrrGG'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Predicted Arrival:</span>
                <span className="font-bold text-[#F5F5F5]">
                  {selectedAssignment ? `${selectedAssignment.etaSeconds}s` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Traffic Police Assigned:</span>
                <span className="font-bold text-[#38a169]">
                  {selectedAssignment?.officerName ?? 'Insp. Rajesh Kumar'}
                </span>
              </div>
              {selectedAssignment?.badgeNumber && (
                <div className="flex justify-between text-[9px] text-[#737373]">
                  <span>Badge / Dispatch ID:</span>
                  <span>{selectedAssignment.badgeNumber} ({selectedAssignment.contactIdentifier})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Alert Channel:</span>
                <span className="font-bold text-[#38a169]">
                  REAL NTFY DISPATCH (ACTIVE)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. CORRIDOR PROGRESSION INDICATOR (FLOATING BOTTOM RIGHT) ── */}
        <div className="absolute bottom-2.5 right-2.5 bg-[#141414]/95 border border-[#262626] rounded px-3 py-1.5 z-30 font-mono text-[10px] shadow-lg backdrop-blur-md flex items-center gap-2">
          <span className="text-[#737373] uppercase font-bold text-[9px]">CORRIDOR:</span>
          <span className="font-bold text-[#d04848]">AMB-01</span>
          <span className="text-[#555555]">→</span>
          <span className="font-bold text-[#38a169]">SIG-01</span>
          <span className="text-[#555555]">→</span>
          <span className="font-bold text-[#38a169]">SIG-02</span>
          <span className="text-[#555555]">→</span>
          <span className="font-bold text-[#38a169]">SIG-03</span>
          <span className="text-[#555555]">→</span>
          <span className="font-bold text-[#38a169]">SIG-04</span>
          <span className="text-[#555555]">→</span>
          <span className="font-bold text-[#d04848]">HOSPITAL</span>
        </div>
      </div>
    </div>
  );
}
