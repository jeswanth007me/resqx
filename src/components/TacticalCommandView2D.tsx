/**
 * ResQX 2D Tactical Command-Center View
 *
 * Provides a high-contrast, instant-comprehension tactical map for emergency dispatchers.
 * Consumes the single source of truth: RoadGraph, RouteResult, EtaResult, CorridorPlan,
 * Telemetry, Queue Estimator, and Police Coordination.
 */

import { useState, useMemo } from 'react';
import type { TelemetryData } from '../types/telemetry.ts';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry.ts';
import { getDefaultCityGraph } from '../routing/graph.ts';
import { calculateAmbulanceRoute } from '../routing/engine.ts';
import { calculateAmbulanceEta } from '../routing/eta.ts';
import { planEmergencyCorridor } from '../routing/corridor.ts';
import { validateCorridorPlan } from '../safety/validator.ts';
import { PoliceCoordinator } from '../services/policeCoordinator.ts';
import { estimateRoadQueues } from '../traffic/queueEstimator.ts';

interface TacticalCommandView2DProps {
  telemetry: TelemetryData | null;
  connectionStatus: ConnectionStatus;
  onSelectSignal?: (signalId: string) => void;
}

export function TacticalCommandView2D({
  telemetry,
  connectionStatus,
}: TacticalCommandView2DProps) {
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>('SIG-01');
  const coordinator = useMemo(() => new PoliceCoordinator(), []);

  const isConnected = connectionStatus === 'CONNECTED';
  const amb = telemetry?.ambulance;
  const isRunning = telemetry?.simulation.running ?? false;
  const isArrived = amb?.status === 'ARRIVED';

  // Compute live single source of truth
  const {
    graph,
    routeResult,
    etaResult,
    safetyResult,
    policeAssignments,
    queueMetrics,
  } = useMemo(() => {
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
        { id: 'SIG-03', name: 'Hospital Approach', road: 'ROAD-03', position: { x: 300, y: 400 } },
        { id: 'SIG-02', name: 'Central Intersection', road: 'ROAD-02', position: { x: 300, y: 275 } },
      ],
    });
    const corridor = planEmergencyCorridor(eta);
    const safety = validateCorridorPlan(corridor);
    const assignments = coordinator.assignOfficersForCorridor(
      corridor,
      amb?.id ?? 'AMB-01',
      telemetry?.simulation.elapsedTime ?? 0
    );
    const queues = estimateRoadQueues(telemetry?.traffic.vehicles ?? []);

    return {
      graph: defaultGraph,
      routeResult: route,
      etaResult: eta,
      corridorPlan: corridor,
      safetyResult: safety,
      policeAssignments: assignments,
      queueMetrics: queues,
    };
  }, [coordinator, amb?.speedKmh, amb?.currentRoad, amb?.status, amb?.id, telemetry?.simulation.elapsedTime, telemetry?.traffic.vehicles]);

  // Selected junction data for inspector
  const selectedAssignment = policeAssignments.find((a) => a.signalId === selectedJunctionId);
  const selectedSignalState = telemetry?.signals.find((s) => s.id === selectedJunctionId);

  // Coordinate mapping from RoadGraph (X: 50..550 -> SVG 60..540, Y: 30..560 -> SVG 50..430)
  const mapGraphToSvg = (gx: number, gy: number) => {
    const svgX = 60 + ((gx - 50) / 500) * 480;
    const svgY = 40 + ((gy - 30) / 530) * 400;
    return { x: svgX, y: svgY };
  };

  // Ambulance position mapping
  // If telemetry has x, y in SUMO coordinates (100, 300..0)
  const ambSvgPos = useMemo(() => {
    if (!amb) return { x: 300, y: 50 };
    const progress = 1 - Math.max(0, Math.min(300, amb.y)) / 300;
    const gx = 300;
    const gy = 40 + progress * 505;
    return mapGraphToSvg(gx, gy);
  }, [amb]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0b0f17] text-on-surface rounded-xl overflow-hidden border border-outline-variant/40 shadow-2xl">
      {/* ── 1. COMMAND-CENTER TACTICAL STATUS BAR ────────────────────── */}
      <div className="px-4 py-2.5 bg-[#101726]/95 border-b border-outline-variant/30 flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="font-headline text-xs font-bold text-on-surface tracking-wider uppercase">
              2D TACTICAL COMMAND CENTER
            </span>
          </div>
          <span className="text-[10px] font-data px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/30">
            {isConnected ? 'SUMO LIVE' : 'LOCAL SIMULATION'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-data">
          <div>
            <span className="text-on-surface-variant text-[10px] block">EMERGENCY</span>
            <span className="font-bold text-secondary">
              {isArrived ? 'COMPLETED' : isRunning ? 'ACTIVE' : 'STAGED'}
            </span>
          </div>

          <div className="h-6 w-[1px] bg-outline-variant/30" />

          <div>
            <span className="text-on-surface-variant text-[10px] block">AMBULANCE</span>
            <span className="font-bold text-on-surface">AMB-01 ({amb ? `${amb.speedKmh} km/h` : '0 km/h'})</span>
          </div>

          <div className="h-6 w-[1px] bg-outline-variant/30" />

          <div>
            <span className="text-on-surface-variant text-[10px] block">PREDICTED ETA</span>
            <span className="font-bold text-primary">{etaResult.formattedEta} ({Math.round(etaResult.estimatedTravelTime)}s)</span>
          </div>

          <div className="h-6 w-[1px] bg-outline-variant/30" />

          <div>
            <span className="text-on-surface-variant text-[10px] block">SAFETY VALIDATION</span>
            <span
              className={`font-bold ${
                safetyResult.decision === 'APPROVED'
                  ? 'text-secondary'
                  : safetyResult.decision === 'HOLD'
                  ? 'text-tertiary'
                  : 'text-error'
              }`}
            >
              {safetyResult.decision}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. SVG VECTOR TACTICAL MAP VIEWPORT ──────────────────────── */}
      <div className="relative flex-1 w-full h-full bg-[#070a10] overflow-hidden flex items-center justify-center p-2">
        {/* Tactical Grid Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#4edea3 1px, transparent 1px), radial-gradient(#1e293b 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        <svg viewBox="0 0 600 480" className="w-full h-full max-h-[560px] select-none">
          <defs>
            {/* Glow Filter for Active Emergency Corridor */}
            <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="ambGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ── 2A. ALL ROAD EDGES ── */}
          {Array.from(graph.edges.values()).map((edge) => {
            const fromNode = graph.nodes.get(edge.from);
            const toNode = graph.nodes.get(edge.to);
            if (!fromNode || !toNode) return null;

            const p1 = mapGraphToSvg(fromNode.position.x, fromNode.position.y);
            const p2 = mapGraphToSvg(toNode.position.x, toNode.position.y);

            const isSelectedRoute = routeResult.roadIds.includes(edge.id);
            const isBlocked = edge.blocked;
            const queueInfo = queueMetrics?.get(edge.id);
            const hasQueue = queueInfo && queueInfo.estimatedQueueDelaySeconds > 0;

            return (
              <g key={edge.id}>
                {/* Road Base Underlay */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isBlocked ? '#ef4444' : isSelectedRoute ? '#003824' : '#1e293b'}
                  strokeWidth={isSelectedRoute ? '12' : '8'}
                  strokeLinecap="round"
                  strokeDasharray={isBlocked ? '6 4' : undefined}
                />

                {/* Active ResQX Emergency Route Highlight */}
                {isSelectedRoute && (
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#4edea3"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#routeGlow)"
                    opacity="0.9"
                  />
                )}

                {/* Road ID & Queue Annotation */}
                <text
                  x={(p1.x + p2.x) / 2 + 8}
                  y={(p1.y + p2.y) / 2 - 4}
                  fill={isBlocked ? '#ef4444' : isSelectedRoute ? '#4edea3' : hasQueue ? '#ffb95f' : '#64748b'}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {edge.id} {isBlocked ? '🚧 BLOCKED' : hasQueue ? `⚠️ Q:${queueInfo.stoppedVehicleCount} (+${Math.round(queueInfo.estimatedQueueDelaySeconds)}s)` : ''}
                </text>
              </g>
            );
          })}

          {/* ── 2B. INTERSECTION NODES & TRAFFIC LIGHTS ── */}
          {Array.from(graph.nodes.values()).map((node) => {
            const pos = mapGraphToSvg(node.position.x, node.position.y);
            const isHospital = node.id === 'NODE_HOSPITAL';
            const isStart = node.id === 'NODE_NORTH';

            // Find signal associated with node
            let signalId: string | null = null;
            if (node.id === 'NODE_NORTH') signalId = 'SIG-01';
            else if (node.id === 'NODE_CENTRAL') signalId = 'SIG-02';
            else if (node.id === 'NODE_HOSPITAL') signalId = 'SIG-03';

            const sig = telemetry?.signals.find((s) => s.id === signalId);
            const sigState = sig?.emergencyState ?? 'NORMAL';

            let sigColor = '#ff5451'; // Red NORMAL
            if (sigState === 'EMERGENCY PRIORITY' || sigState === 'PRIORITY') sigColor = '#4edea3'; // Green PRIORITY
            else if (sigState === 'PREPARING') sigColor = '#ffb95f'; // Amber PREPARING

            const isSelected = selectedJunctionId === signalId;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => signalId && setSelectedJunctionId(signalId)}
              >
                {/* Node Target Ring */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHospital ? '14' : '10'}
                  fill="#0b0f17"
                  stroke={isSelected ? '#38bdf8' : isHospital ? '#ef4444' : isStart ? '#4edea3' : '#334155'}
                  strokeWidth={isSelected ? '3' : '2'}
                />

                {/* Inner Icon / Marker */}
                {isHospital ? (
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fill="#ef4444"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    🏥
                  </text>
                ) : isStart ? (
                  <text
                    x={pos.x}
                    y={pos.y + 3.5}
                    textAnchor="middle"
                    fill="#4edea3"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    ▲
                  </text>
                ) : (
                  <circle cx={pos.x} cy={pos.y} r="4" fill={sigColor} />
                )}

                {/* Node Label */}
                <text
                  x={pos.x}
                  y={pos.y + 20}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {node.name}
                </text>

                {/* Traffic Light State Badge if signal exists */}
                {signalId && (
                  <g transform={`translate(${pos.x - 22}, ${pos.y - 24})`}>
                    <rect
                      width="44"
                      height="14"
                      rx="3"
                      fill="#1e293b"
                      stroke={sigColor}
                      strokeWidth="1"
                    />
                    <text
                      x="22"
                      y="10"
                      textAnchor="middle"
                      fill={sigColor}
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {signalId} {sigState === 'EMERGENCY PRIORITY' ? '🟢 PRIO' : sigState === 'PREPARING' ? '🟡 PREP' : '🔴 NORM'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── 2C. CIVILIAN TRAFFIC VEHICLES ── */}
          {(telemetry?.traffic.vehicles ?? []).map((v) => {
            if (v.type === 'emergency' || v.id === 'AMB-01') return null;
            // Place non-emergency vehicles along corridor
            const vy = 40 + (1 - Math.max(0, Math.min(300, v.y)) / 300) * 400;
            const vx = 300 + (v.id.charCodeAt(v.id.length - 1) % 2 === 0 ? -16 : 16);

            return (
              <g key={v.id}>
                <circle cx={vx} cy={vy} r="3.5" fill={v.color ?? '#64748b'} />
              </g>
            );
          })}

          {/* ── 2D. AMBULANCE (AMB-01) WITH TACTICAL BEACON ── */}
          <g transform={`translate(${ambSvgPos.x}, ${ambSvgPos.y})`} filter="url(#ambGlow)">
            {/* Pulsing Beacon Ring */}
            <circle cx="0" cy="0" r="14" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.8">
              <animate attributeName="r" values="10;22;10" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.5s" repeatCount="indefinite" />
            </circle>

            {/* Ambulance Body */}
            <circle cx="0" cy="0" r="8" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
            <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold">
              🚑
            </text>

            {/* Label Callout */}
            <g transform="translate(14, -10)">
              <rect width="64" height="20" rx="3" fill="#0f172a" stroke="#ef4444" strokeWidth="1" />
              <text x="4" y="9" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="bold">
                AMB-01
              </text>
              <text x="4" y="17" fill="#94a3b8" fontSize="7" fontFamily="monospace">
                {amb ? `${amb.speedKmh} km/h` : '50 km/h'}
              </text>
            </g>
          </g>
        </svg>

        {/* ── 3. INTERACTIVE JUNCTION INSPECTOR CARD (Floating Bottom Left) ── */}
        {selectedJunctionId && (
          <div className="absolute bottom-3 left-3 w-72 bg-[#101726]/95 border border-outline-variant/40 rounded-lg p-3 shadow-2xl backdrop-blur-md z-20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-on-surface bg-surface-container-highest px-1.5 py-0.5 rounded">
                  {selectedJunctionId}
                </span>
                <span className="text-xs font-semibold text-on-surface">
                  {selectedJunctionId === 'SIG-01' ? 'North Gate' : selectedJunctionId === 'SIG-03' ? 'Hospital Approach' : 'Central Junction'}
                </span>
              </div>
              <span
                className={`text-[9px] font-data font-bold px-1.5 py-0.5 rounded ${
                  selectedSignalState?.emergencyState === 'EMERGENCY PRIORITY'
                    ? 'bg-secondary/20 text-secondary'
                    : selectedSignalState?.emergencyState === 'PREPARING'
                    ? 'bg-tertiary/20 text-tertiary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {selectedSignalState?.emergencyState ?? 'NORMAL'}
              </span>
            </div>

            <div className="space-y-1 text-xs font-data text-on-surface-variant">
              <div className="flex justify-between">
                <span>Predicted Arrival:</span>
                <span className="font-bold text-on-surface">
                  {selectedAssignment ? `${selectedAssignment.etaSeconds}s` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Assigned Officer:</span>
                <span className="font-bold text-on-surface">
                  {selectedAssignment?.officerName ?? 'Unassigned'}
                </span>
              </div>
              {selectedAssignment?.badgeNumber && (
                <div className="flex justify-between text-[10px]">
                  <span>Badge / Contact:</span>
                  <span>{selectedAssignment.badgeNumber} ({selectedAssignment.contactIdentifier})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Alert Status:</span>
                <span className="font-bold text-secondary">
                  {selectedAssignment?.status === 'UNASSIGNED' ? 'NO OFFICER' : 'DISPATCHED (DEMO)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. CORRIDOR PROGRESSION INDICATOR (Floating Bottom Right) ── */}
        <div className="absolute bottom-3 right-3 bg-[#101726]/95 border border-outline-variant/40 rounded-lg p-2.5 shadow-2xl backdrop-blur-md z-20 flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-data">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">CORRIDOR:</span>
            <span className="font-bold text-secondary">AMB-01</span>
            <span className="text-on-surface-variant">➔</span>
            <span className="font-bold text-secondary">SIG-01</span>
            <span className="text-on-surface-variant">➔</span>
            <span className="font-bold text-secondary">SIG-03</span>
            <span className="text-on-surface-variant">➔</span>
            <span className="font-bold text-error">HOSPITAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
