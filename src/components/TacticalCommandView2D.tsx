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
import { Badge } from './ui/badge';

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
    <div className="relative w-full h-full flex flex-col bg-[#080b12] text-gray-100 overflow-hidden select-none">
      {/* ── 1. TACTICAL STATUS BAR (DARK EOC HEADER) ────────────────── */}
      <div className="h-9 px-4 bg-gray-950/95 border-b border-gray-800 flex items-center justify-between gap-4 z-20 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-200 tracking-widest uppercase">
              2D Tactical Digital Twin
            </span>
          </div>
          <div className="h-3 w-px bg-gray-800" />
          <span className="text-[10px] text-gray-500">
            {isConnected ? 'TraCI Realtime Feed' : 'Simulator Standby'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 uppercase text-[9px]">Corridor:</span>
            <span className="font-bold text-emerald-400">
              {isArrived ? 'MISSION COMPLETE' : isRunning ? 'GREEN WAVE ACTIVE' : 'STAGED READY'}
            </span>
          </div>

          <div className="h-3 w-px bg-gray-800" />

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 uppercase text-[9px]">Unit:</span>
            <span className="font-bold text-red-400">
              AMB-01 ({amb ? `${Math.round(amb.speedKmh)} km/h` : '0 km/h'})
            </span>
          </div>

          <div className="h-3 w-px bg-gray-800" />

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 uppercase text-[9px]">ETA:</span>
            <span className="font-bold text-gray-100">
              {amb ? `${amb.etaSeconds}s` : etaResult.formattedEta}
            </span>
          </div>

          <div className="h-3 w-px bg-gray-800 hidden md:block" />

          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-gray-500 uppercase text-[9px]">Safety Gate:</span>
            <Badge
              variant={safetyResult.decision === 'APPROVED' ? 'success' : 'destructive'}
              className="py-0 px-1.5 text-[9px]"
            >
              {safetyResult.decision}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── 2. SVG VECTOR TACTICAL CORRIDOR MAP ──────────────────────── */}
      <div className="relative flex-1 w-full h-full bg-[#080b12] overflow-hidden flex items-center justify-center p-2">
        {/* Subtle EOC Tactical Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(#1e293b 1px, transparent 1px),
              linear-gradient(to right, #1e293b 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        <svg viewBox="0 0 1020 380" className="w-full h-full max-h-[480px] select-none">
          {/* ── 2A. CROSS STREETS & PEDESTRIAN ZEBRA CROSSINGS ── */}
          {JUNCTIONS.map((j) => (
            <g key={`cross-${j.id}`}>
              {/* Cross Street Road Base */}
              <rect
                x={j.x - 22}
                y="35"
                width="44"
                height="320"
                fill="#111827"
                stroke="#1f2937"
                strokeWidth="1"
                rx="2"
              />
              {/* Cross Street Dashed Centerline */}
              <line
                x1={j.x}
                y1="35"
                x2={j.x}
                y2="355"
                stroke="#374151"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
              {/* Cross Street Stop Line (North approach) */}
              <line
                x1={j.x - 20}
                y1="160"
                x2={j.x + 20}
                y2="160"
                stroke="#6b7280"
                strokeWidth="2.5"
              />
              {/* Cross Street Stop Line (South approach) */}
              <line
                x1={j.x - 20}
                y1="230"
                x2={j.x + 20}
                y2="230"
                stroke="#6b7280"
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
                fill="#1f2937"
                stroke="#374151"
                strokeWidth="1"
              />
              <rect
                x={j.x - 8}
                y="245"
                width="16"
                height="28"
                rx="3"
                fill="#1f2937"
                stroke="#374151"
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
            fill="#111827"
            stroke="#1f2937"
            strokeWidth="1.5"
            rx="3"
          />

          {/* Curbs */}
          <line x1="30" y1="165" x2="930" y2="165" stroke="#374151" strokeWidth="2" />
          <line x1="30" y1="225" x2="930" y2="225" stroke="#374151" strokeWidth="2" />

          {/* Lane Dashed Centerlines */}
          <line
            x1="40"
            y1="180"
            x2="920"
            y2="180"
            stroke="#1f2937"
            strokeWidth="1.5"
            strokeDasharray="12 10"
          />
          <line
            x1="40"
            y1="210"
            x2="920"
            y2="210"
            stroke="#1f2937"
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
            stroke="#10b981"
            strokeWidth="3.5"
            strokeDasharray="10 6"
            opacity="0.9"
          />

          {/* Traveled Path Highlight (Behind Ambulance) */}
          <line
            x1="60"
            y1="195"
            x2={Math.min(910, ambX)}
            y2="195"
            stroke="#10b981"
            strokeWidth="4.5"
            opacity="0.95"
          />

          {/* ── 2C. START DISPATCH NODE (NORTH START) ── */}
          <g transform="translate(60, 195)">
            <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
            <text x="0" y="3.5" textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontFamily="JetBrains Mono" fontWeight="bold">
              START
            </text>
            <text x="0" y="-18" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">
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
            let tagColor = '#ef4444';
            let tagBg = 'rgba(239, 68, 68, 0.15)';
            let bulbGreen = '#1f2937';
            let bulbYellow = '#1f2937';
            let bulbRed = '#ef4444';

            if (isPriority) {
              tagText = 'PRIORITY';
              tagColor = '#10b981';
              tagBg = 'rgba(16, 185, 129, 0.25)';
              bulbGreen = '#10b981';
              bulbYellow = '#1f2937';
              bulbRed = '#1f2937';
            } else if (isPreparing) {
              tagText = 'PREPARING';
              tagColor = '#f59e0b';
              tagBg = 'rgba(245, 158, 11, 0.2)';
              bulbGreen = '#1f2937';
              bulbYellow = '#f59e0b';
              bulbRed = '#1f2937';
            } else if (isRestored) {
              // Dimmed / quieter appearance for restored signals
              tagText = 'RESTORED';
              tagColor = '#38bdf8';
              tagBg = 'rgba(56, 189, 248, 0.1)';
              bulbGreen = '#0ea5e9';
              bulbYellow = '#1f2937';
              bulbRed = '#1f2937';
            }

            const isSelected = selectedJunctionId === j.id;

            return (
              <g
                key={j.id}
                className="cursor-pointer transition-opacity"
                opacity={isRestored ? 0.45 : 1}
                onClick={() => setSelectedJunctionId(j.id)}
              >
                {/* Active Priority Strong Green Emphasis Ring */}
                {isPriority && (
                  <>
                    <circle
                      cx={j.x}
                      cy="195"
                      r="22"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                    <circle
                      cx={j.x}
                      cy="195"
                      r="28"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.5"
                    />
                  </>
                )}

                {/* Intersection Ring Node */}
                <circle
                  cx={j.x}
                  cy="195"
                  r={isSelected ? 16 : 13}
                  fill="#0f172a"
                  stroke={isSelected ? '#f3f4f6' : isPriority ? '#10b981' : tagColor}
                  strokeWidth={isSelected ? 2.5 : isPriority ? 2 : 1.5}
                />
                <circle cx={j.x} cy="195" r="4" fill={isPriority ? '#10b981' : tagColor} />

                {/* Vertical 3-Light Signal Head (Top) */}
                <g transform={`translate(${j.x - 7}, 75)`}>
                  <rect
                    width="14"
                    height="36"
                    rx="3"
                    fill="#030712"
                    stroke="#374151"
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
                <line x1={j.x} y1="111" x2={j.x} y2="155" stroke="#374151" strokeWidth="2" />

                {/* Floating Signal Identifier & State Tag */}
                <g transform={`translate(${j.x - 44}, 42)`}>
                  <rect
                    width="88"
                    height="22"
                    rx="3"
                    fill={tagBg}
                    stroke={tagColor}
                    strokeWidth={isPriority ? 1.8 : 1.2}
                  />
                  <circle cx="9" cy="11" r="3" fill={tagColor} />
                  <text
                    x="18"
                    y="15"
                    fill="#f3f4f6"
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
                  fill="#94a3b8"
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
                  fill="#64748b"
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
                  fill="#374151"
                  stroke="#4b5563"
                  strokeWidth="0.8"
                />
              </g>
            );
          })}

          {/* ── 2F. REAL AMBULANCE (AMB-01) WITH CLEAR SILHOUETTE ── */}
          <g transform={`translate(${ambX}, ${ambY})`}>
            {/* Subtle Beacon Radar Ring */}
            <circle cx="0" cy="0" r="22" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />

            {/* Ambulance Body (Crisp White & Red High-Vis Chassis) */}
            <rect
              x="-18"
              y="-8"
              width="36"
              height="16"
              rx="3"
              fill="#ffffff"
              stroke="#ef4444"
              strokeWidth="1.5"
            />
            {/* Emergency Red Chevron Side Stripe */}
            <rect x="-14" y="-3" width="28" height="6" fill="#ef4444" />
            {/* Front Windshield */}
            <rect x="9" y="-6" width="6" height="12" rx="1" fill="#0f172a" />
            {/* Dual Red Roof Beacons */}
            <circle cx="-6" cy="0" r="3" fill="#ef4444" />
            <circle cx="6" cy="0" r="3" fill="#ef4444" />

            {/* Callsign Tag Floating Above */}
            <g transform="translate(-46, -34)">
              <rect
                width="92"
                height="22"
                rx="3"
                fill="#030712"
                stroke="#ef4444"
                strokeWidth="1.5"
              />
              <circle cx="8" cy="11" r="3" fill="#ef4444" />
              <text
                x="16"
                y="15"
                fill="#f3f4f6"
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
              fill="#0f172a"
              stroke="#ef4444"
              strokeWidth="1.8"
            />
            {/* Red Cross Icon */}
            <g transform="translate(17, -15)">
              <rect x="-4" y="-12" width="8" height="24" rx="1.5" fill="#ef4444" />
              <rect x="-12" y="-4" width="24" height="8" rx="1.5" fill="#ef4444" />
            </g>
            {/* Hospital Helipad Text */}
            <text
              x="17"
              y="18"
              textAnchor="middle"
              fill="#f3f4f6"
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
              fill="#ef4444"
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
                fill="#030712"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <text
                x="55"
                y="11"
                textAnchor="middle"
                fill="#f3f4f6"
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
          <div className="absolute bottom-2.5 left-2.5 w-80 bg-gray-900/95 border border-gray-800 rounded p-3 z-30 font-mono text-[11px] shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11px] text-gray-100 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                  {selectedJunctionId}
                </span>
                <span className="text-[11px] font-medium text-gray-300">
                  {JUNCTIONS.find((j) => j.id === selectedJunctionId)?.name ?? 'Corridor Junction'}
                </span>
              </div>
              <Badge
                variant={
                  selectedSignalState?.emergencyState === 'EMERGENCY PRIORITY' ||
                  (selectedSignalState?.emergencyState as string) === 'PRIORITY'
                    ? 'success'
                    : selectedSignalState?.emergencyState === 'PREPARING'
                    ? 'warning'
                    : 'muted'
                }
                className="text-[9px]"
              >
                {selectedSignalState?.emergencyState ?? 'NORMAL'}
              </Badge>
            </div>

            <div className="space-y-1.5 text-gray-400 text-[10px]">
              <div className="flex justify-between">
                <span>Signal Phase:</span>
                <span className="font-bold text-gray-200">
                  {selectedSignalState?.state ?? 'rrrrGG'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Predicted Arrival:</span>
                <span className="font-bold text-gray-200">
                  {selectedAssignment ? `${selectedAssignment.etaSeconds}s` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Traffic Police Assigned:</span>
                <span className="font-bold text-emerald-400">
                  {selectedAssignment?.officerName ?? 'Insp. Rajesh Kumar'}
                </span>
              </div>
              {selectedAssignment?.badgeNumber && (
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Badge / Dispatch ID:</span>
                  <span>{selectedAssignment.badgeNumber} ({selectedAssignment.contactIdentifier})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Alert Channel:</span>
                <span className="font-bold text-emerald-400">
                  NTFY REALTIME (ACTIVE)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. CORRIDOR PROGRESSION INDICATOR (FLOATING BOTTOM RIGHT) ── */}
        <div className="absolute bottom-2.5 right-2.5 bg-gray-900/95 border border-gray-800 rounded px-3 py-1.5 z-30 font-mono text-[10px] shadow-xl backdrop-blur-md flex items-center gap-2">
          <span className="text-gray-500 uppercase font-bold text-[9px]">Corridor:</span>
          <span className="font-bold text-red-400">AMB-01</span>
          <span className="text-gray-600">→</span>
          <span className="font-bold text-emerald-400">SIG-01</span>
          <span className="text-gray-600">→</span>
          <span className="font-bold text-emerald-400">SIG-02</span>
          <span className="text-gray-600">→</span>
          <span className="font-bold text-emerald-400">SIG-03</span>
          <span className="text-gray-600">→</span>
          <span className="font-bold text-emerald-400">SIG-04</span>
          <span className="text-gray-600">→</span>
          <span className="font-bold text-red-400">HOSPITAL</span>
        </div>
      </div>
    </div>
  );
}
