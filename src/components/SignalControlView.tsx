import { useMemo, useState } from 'react';
import type { TelemetryData, TelemetrySignal } from '../types/telemetry';
import type { EmergencyEvent } from '../types/events';

interface SignalControlViewProps {
  telemetry: TelemetryData | null;
  connectionStatus: string;
  safetyValidation: any;
  corridorPlan?: any;
  events: EmergencyEvent[];
  onOverrideSignal?: (signalId: string, phase: string, pattern?: string) => void;
  onResetCorridor?: () => void;
}

export function SignalControlView({
  telemetry,
  safetyValidation,
  events,
  onOverrideSignal,
  onResetCorridor,
}: SignalControlViewProps) {
  const amb = telemetry?.ambulance;
  const signals: TelemetrySignal[] = telemetry?.signals ?? [];

  // Focused signal for intersection twin
  const [selectedSignalId, setSelectedSignalId] = useState<string>('SIG-02');

  const selectedSignal: TelemetrySignal | undefined = useMemo(() => {
    return signals.find((s: TelemetrySignal) => s.id === selectedSignalId) ?? signals[1] ?? signals[0];
  }, [signals, selectedSignalId]);

  // Find active / target signal
  const activeSignalId = useMemo(() => {
    const preparingOrPrio = signals.find(
      (s: TelemetrySignal) => s.emergencyState === 'PREPARING' || s.emergencyState === 'EMERGENCY PRIORITY' || (s.emergencyState as string) === 'PRIORITY'
    );
    return preparingOrPrio?.id ?? 'SIG-02';
  }, [signals]);

  const signalAuditEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.relatedSignal ||
        e.type.includes('SIGNAL') ||
        e.type.includes('SAFETY') ||
        e.type.includes('OVERRIDE')
    ).slice(0, 8);
  }, [events]);

  const handleForceGreen = () => {
    if (selectedSignal) {
      onOverrideSignal?.(selectedSignal.id, 'GREEN', 'EMERGENCY_HOLD');
    }
  };

  const handleHoldPhase = () => {
    if (selectedSignal) {
      onOverrideSignal?.(selectedSignal.id, 'GREEN', 'HOLD_MANUAL');
    }
  };

  const handleFlushPed = () => {
    if (selectedSignal) {
      onOverrideSignal?.(selectedSignal.id, 'GREEN', 'PED_CLEARANCE');
    }
  };

  const handleRevertNEMA = () => {
    if (selectedSignal) {
      onOverrideSignal?.(selectedSignal.id, 'NORMAL', 'RESTORE_CYCLE');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 w-full select-none">
      {/* ── 1. SUB-HEADER STRIP ── */}
      <div className="bg-[#171717] border border-[#242424] rounded px-4 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#06b6d4] animate-pulse shadow-[0_0_8px_#06b6d4]" />
            <span className="font-headline font-bold text-[13px] tracking-wider text-[#F5F5F5] uppercase">
              NEMA TS-2 CORRIDOR PHASE CONTROLLER
            </span>
          </div>
          <div className="h-4 w-px bg-[#262626] hidden sm:block" />
          <span className="font-mono text-[11px] text-[#A3A3A3] hidden md:inline">
            ZONE-1 NORTH ARTERIAL • 4 CASCADE PREEMPT NODES
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <div className="px-2.5 py-0.5 rounded bg-[#111111] border border-[#242424] text-[#38a169] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
            DSRC 5.9GHz &amp; NTCIP 1202 ONLINE
          </div>
          {onResetCorridor && (
            <button
              onClick={onResetCorridor}
              className="px-2.5 py-0.5 rounded bg-[#d04848]/15 border border-[#d04848]/40 hover:bg-[#d04848]/25 text-[#d04848] font-bold transition-colors cursor-pointer"
            >
              RESET CORRIDOR
            </button>
          )}
        </div>
      </div>

      {/* ── 2. MAIN 3-COLUMN CONTROL DESK GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 items-stretch">
        {/* ============================================================ */}
        {/* LEFT COLUMN: CORRIDOR OVERVIEW & PREEMPT NODE ARRAY (3 COLS) */}
        {/* ============================================================ */}
        <section className="lg:col-span-3 flex flex-col gap-3 min-h-0">
          {/* Top Left Card: Corridor Path Overview */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                  TARGET CORRIDOR PATH A
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide bg-[#38a169]/15 text-[#38a169] border border-[#38a169]/30">
                  {safetyValidation?.decision === 'APPROVED' ? 'PREEMPTION ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <h2 className="font-headline text-[13px] font-bold text-[#F5F5F5] flex items-center gap-1.5">
                <span>North Maple Ave</span>
                <span className="text-[#737373] font-mono">→</span>
                <span>Metro General Hospital</span>
              </h2>
            </div>

            {/* 4-Node Cascade Sequence Bar */}
            <div className="grid grid-cols-4 gap-1.5 mt-2.5 pt-2.5 border-t border-[#242424] text-center font-mono">
              {['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04'].map((sigId: string) => {
                const s = signals.find((item: TelemetrySignal) => item.id === sigId);
                const isPass = s?.emergencyState === 'RESTORED';
                const isPrio = s?.emergencyState === 'EMERGENCY PRIORITY' || (s?.emergencyState as string) === 'PRIORITY';
                const isPrep = s?.emergencyState === 'PREPARING';
                const isSelected = selectedSignalId === sigId;

                let stateLabel = 'NORM';
                let colorClass = 'text-[#737373] border-[#242424] bg-[#111111]';
                let barColor = 'bg-[#737373]/30 w-1/4';

                if (isPass) {
                  stateLabel = 'PASS';
                  colorClass = 'text-[#38a169] border-[#38a169]/40 bg-[#38a169]/10';
                  barColor = 'bg-[#38a169] w-full';
                } else if (isPrio) {
                  stateLabel = 'GREEN';
                  colorClass = 'text-[#38a169] border-[#38a169] bg-[#38a169]/20 shadow-[0_0_8px_rgba(56,161,105,0.3)]';
                  barColor = 'bg-[#38a169] w-full';
                } else if (isPrep) {
                  stateLabel = 'TRANS';
                  colorClass = 'text-[#d97706] border-[#d97706]/40 bg-[#d97706]/10';
                  barColor = 'bg-[#d97706] w-2/3';
                } else {
                  stateLabel = 'HOLD';
                  colorClass = 'text-[#A3A3A3] border-[#242424] bg-[#111111]';
                  barColor = 'bg-[#d04848] w-1/3';
                }

                return (
                  <button
                    key={sigId}
                    onClick={() => setSelectedSignalId(sigId)}
                    className={`rounded p-1 transition-all border cursor-pointer ${colorClass} ${
                      isSelected ? 'ring-1 ring-[#06b6d4]' : ''
                    }`}
                  >
                    <div className="text-[9px] font-semibold">{sigId}</div>
                    <div className="text-[11px] font-bold">{stateLabel}</div>
                    <div className="w-full bg-[#242424] h-1 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full ${barColor}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Middle Left Card: Preempt Node Array */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex-1 flex flex-col justify-between shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
                PREEMPT NODE ARRAY
              </h3>
              <span className="font-mono text-[10px] text-[#06b6d4]">4 SIGNALS SYNCED</span>
            </div>

            <div className="space-y-2 my-2 overflow-y-auto pr-0.5">
              {['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04'].map((sigId: string) => {
                const s = signals.find((item: TelemetrySignal) => item.id === sigId);
                const isSelected = selectedSignalId === sigId;
                const isTarget = activeSignalId === sigId;
                const isPrio = s?.emergencyState === 'EMERGENCY PRIORITY' || (s?.emergencyState as string) === 'PRIORITY';
                const isPrep = s?.emergencyState === 'PREPARING';
                const isGreen = isPrio || s?.state?.toLowerCase().includes('g');
                const isYellow = isPrep || s?.state?.toLowerCase().includes('y');

                let lightClass = 'bg-[#d04848] shadow-[0_0_6px_#d04848]';
                let phaseName = 'RED';
                if (isGreen) {
                  lightClass = 'bg-[#38a169] shadow-[0_0_6px_#38a169]';
                  phaseName = 'GREEN';
                } else if (isYellow) {
                  lightClass = 'bg-[#d97706] shadow-[0_0_6px_#d97706]';
                  phaseName = 'YELLOW';
                }

                const locationNames: Record<string, string> = {
                  'SIG-01': '4th Ave & Maple',
                  'SIG-02': '6th Ave & Maple (Central)',
                  'SIG-03': '8th Ave & Maple (Arterial)',
                  'SIG-04': 'Hospital Way South Exit',
                };

                return (
                  <div
                    key={sigId}
                    onClick={() => setSelectedSignalId(sigId)}
                    className={`p-2 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1e293b]/60 border-[#06b6d4] shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                        : 'bg-[#111111] border-[#242424] hover:border-[#383838]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${lightClass}`} />
                        <div>
                          <div className="font-bold text-[#F5F5F5] flex items-center gap-1.5 font-mono text-[11px]">
                            <span>{sigId} • {locationNames[sigId]}</span>
                            {isTarget && (
                              <span className="bg-[#06b6d4]/20 text-[#06b6d4] text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                                TARGET
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#737373] font-mono">
                            State: <span className="text-[#A3A3A3] font-semibold">{s?.emergencyState ?? 'NORMAL'}</span>
                            {' • '}
                            Phase: <span className={isGreen ? 'text-[#38a169] font-bold' : isYellow ? 'text-[#d97706]' : 'text-[#d04848]'}>{phaseName}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#737373] font-semibold">
                        P2/P6 LOCK
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Left: Phase Lock Deck & Operator Force Controls */}
            <div className="pt-2 border-t border-[#242424]">
              <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                <span className="text-[#737373] uppercase">PHASE FORCE OVERRIDES ({selectedSignalId})</span>
                <span className="text-[#06b6d4] font-bold">NEMA TS-2</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                <button
                  onClick={handleHoldPhase}
                  className="px-2 py-1.5 bg-[#1e293b] hover:bg-[#283850] text-[#06b6d4] border border-[#06b6d4]/40 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>HOLD PHASE</span>
                </button>
                <button
                  onClick={handleForceGreen}
                  className="px-2 py-1.5 bg-[#38a169]/20 hover:bg-[#38a169]/30 text-[#38a169] border border-[#38a169]/50 rounded flex items-center justify-center gap-1 font-bold transition-colors cursor-pointer"
                >
                  <span>FORCE GREEN</span>
                </button>
                <button
                  onClick={handleFlushPed}
                  className="px-2 py-1.5 bg-[#111111] hover:bg-[#242424] text-[#d97706] border border-[#242424] rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>FLUSH PED</span>
                </button>
                <button
                  onClick={handleRevertNEMA}
                  className="px-2 py-1.5 bg-[#111111] hover:bg-[#242424] text-[#A3A3A3] border border-[#242424] rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>REVERT NEMA</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* CENTER COLUMN: INTERSECTION 2D DIGITAL TWIN & TIMELINE (6 COLS) */}
        {/* ============================================================ */}
        <section className="lg:col-span-6 flex flex-col gap-3 min-h-0">
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex-1 flex flex-col relative overflow-hidden shadow-sm">
            {/* Header Info Bar */}
            <div className="flex items-center justify-between border-b border-[#242424] pb-2 z-10 bg-[#171717]/90">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline font-bold text-[14px] text-[#F5F5F5] uppercase tracking-wide">
                    {selectedSignal?.id ?? 'SIG-02'}: North Corridor Interlock Junction
                  </h2>
                  <span className="px-2 py-0.2 rounded text-[10px] bg-[#06b6d4]/15 text-[#06b6d4] border border-[#06b6d4]/30 font-mono font-bold">
                    AMB-01 BEACON LOCKED
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[#737373]">
                  Corridor Path A • NEMA TS-2 Dual-Ring Controller • SUMO ID: {selectedSignal?.id ?? 'SIG-02'}
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px]">
                <div className="px-2 py-1 rounded bg-[#111111] border border-[#242424] text-[#38a169] font-bold">
                  OPTICOM IR: ACTIVE
                </div>
              </div>
            </div>

            {/* Schematic Digital Twin Canvas / Vector Graphic */}
            <div className="flex-1 relative flex items-center justify-center my-1 rounded border border-[#242424] bg-[#0e1726] overflow-hidden min-h-[300px]">
              {/* Background Coordinate Grid */}
              <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid-ctrl" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#06b6d4" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-ctrl)" />
              </svg>

              {/* Radar sweep circle */}
              <div className="absolute w-72 h-72 rounded-full border border-[#06b6d4]/15 pointer-events-none" />
              <div className="absolute w-44 h-44 rounded-full border border-[#06b6d4]/25 border-dashed pointer-events-none animate-pulse" />

              {/* SVG Intersection Graphic */}
              <svg className="w-full h-full max-h-[340px] z-10 drop-shadow-md" viewBox="0 0 600 340">
                {/* Road Asphalt */}
                <rect x="235" y="0" width="130" height="340" fill="#111827" stroke="#1f2937" strokeWidth="2" />
                <rect x="0" y="105" width="600" height="130" fill="#111827" stroke="#1f2937" strokeWidth="2" />
                <rect x="235" y="105" width="130" height="130" fill="#0f172a" />

                {/* Road Markings */}
                <line x1="300" y1="0" x2="300" y2="95" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8,6" opacity="0.6" />
                <line x1="300" y1="245" x2="300" y2="340" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8,6" opacity="0.6" />
                <line x1="0" y1="170" x2="225" y2="170" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8,6" opacity="0.6" />
                <line x1="375" y1="170" x2="600" y2="170" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8,6" opacity="0.6" />

                {/* Crosswalks */}
                <g opacity="0.4" stroke="#94a3b8" strokeWidth="3">
                  <line x1="245" y1="98" x2="355" y2="98" strokeDasharray="5,6" />
                  <line x1="245" y1="242" x2="355" y2="242" strokeDasharray="5,6" />
                  <line x1="228" y1="115" x2="228" y2="225" strokeDasharray="5,6" />
                  <line x1="372" y1="115" x2="372" y2="225" strokeDasharray="5,6" />
                </g>

                {/* Preemption Green Wave Trajectory Beam */}
                <path d="M 300 340 L 300 0" stroke="#10b981" strokeWidth="6" opacity="0.3" strokeLinecap="round" />
                <path d="M 300 340 L 300 0" stroke="#34d399" strokeWidth="2" strokeDasharray="10,6" opacity="0.9" />

                {/* AMB-01 Vehicle Vector */}
                <g transform="translate(286, 260)">
                  <circle cx="14" cy="14" r="20" fill="#ef4444" fillOpacity="0.2" className="animate-ping" style={{ animationDuration: '2s' }} />
                  <rect x="2" y="-4" width="24" height="36" rx="4" fill="#1e293b" stroke="#ef4444" strokeWidth="2" />
                  <rect x="7" y="10" width="14" height="6" rx="1.5" fill="#ef4444" />
                  <circle cx="10" cy="13" r="2" fill="#ffffff" />
                  <circle cx="18" cy="13" r="2" fill="#38bdf8" />
                  <text x="14" y="38" fill="#ffffff" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    AMB-01
                  </text>
                  <text x="14" y="47" fill="#34d399" fontSize="7" fontFamily="monospace" textAnchor="middle">
                    {amb?.speedKmh ?? 42} km/h
                  </text>
                </g>

                {/* 4 Corner Signal Heads based on real phase of selectedSignal */}
                {(() => {
                  const isPrio = selectedSignal?.emergencyState === 'EMERGENCY PRIORITY' || (selectedSignal?.emergencyState as string) === 'PRIORITY';
                  const isPrep = selectedSignal?.emergencyState === 'PREPARING';
                  const isGrn = isPrio || selectedSignal?.state?.toLowerCase().includes('g');
                  const isYel = isPrep || selectedSignal?.state?.toLowerCase().includes('y');
                  const isRd = !isGrn && !isYel;
                  const phase = isGrn ? 'GREEN' : isYel ? 'YELLOW' : 'RED';

                  return (
                    <>
                      {/* South Approach Signal (N-S Primary Corridor) */}
                      <g transform="translate(380, 245)">
                        <rect x="0" y="0" width="18" height="42" rx="3" fill="#030712" stroke="#475569" strokeWidth="1.5" />
                        <circle cx="9" cy="8" r="4.5" fill={isRd ? '#ef4444' : '#334155'} />
                        <circle cx="9" cy="21" r="4.5" fill={isYel ? '#f59e0b' : '#334155'} />
                        <circle cx="9" cy="34" r="5" fill={isGrn ? '#10b981' : '#334155'} className={isGrn ? 'glow-green' : ''} />
                        <text x="24" y="24" fill={isGrn ? '#34d399' : '#f87171'} fontSize="9" fontFamily="monospace" fontWeight="bold">
                          P2: {phase} {isGrn ? '(HOLD)' : ''}
                        </text>
                      </g>

                      {/* North Approach Signal (N-S) */}
                      <g transform="translate(205, 60)">
                        <rect x="0" y="0" width="18" height="42" rx="3" fill="#030712" stroke="#475569" strokeWidth="1.5" />
                        <circle cx="9" cy="8" r="4.5" fill={isRd ? '#ef4444' : '#334155'} />
                        <circle cx="9" cy="21" r="4.5" fill={isYel ? '#f59e0b' : '#334155'} />
                        <circle cx="9" cy="34" r="5" fill={isGrn ? '#10b981' : '#334155'} className={isGrn ? 'glow-green' : ''} />
                        <text x="-8" y="24" fill={isGrn ? '#34d399' : '#f87171'} fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="end">
                          P6: {phase}
                        </text>
                      </g>

                      {/* East Approach Signal (E-W Cross) */}
                      <g transform="translate(380, 70)">
                        <rect x="0" y="0" width="42" height="18" rx="3" fill="#030712" stroke="#475569" strokeWidth="1.5" />
                        <circle cx="8" cy="9" r="5" fill="#ef4444" />
                        <circle cx="21" cy="9" r="4.5" fill="#334155" />
                        <circle cx="34" cy="9" r="4.5" fill="#334155" />
                        <text x="21" y="-5" fill="#f87171" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                          P4: RED (LOCK)
                        </text>
                      </g>

                      {/* West Approach Signal (E-W Cross) */}
                      <g transform="translate(180, 245)">
                        <rect x="0" y="0" width="42" height="18" rx="3" fill="#030712" stroke="#475569" strokeWidth="1.5" />
                        <circle cx="8" cy="9" r="5" fill="#ef4444" />
                        <circle cx="21" cy="9" r="4.5" fill="#334155" />
                        <circle cx="34" cy="9" r="4.5" fill="#334155" />
                        <text x="21" y="28" fill="#f87171" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                          P8: RED (LOCK)
                        </text>
                      </g>
                    </>
                  );
                })()}
              </svg>

              {/* Floating HUD: Telemetry overlay */}
              <div className="absolute bottom-2 left-2 bg-[#111111]/90 border border-[#242424] p-2 rounded text-[10px] font-mono flex gap-3 text-[#A3A3A3] backdrop-blur-xs">
                <div>
                  <span className="text-[#737373]">SPEED:</span>{' '}
                  <strong className="text-[#F5F5F5]">{amb?.speedKmh ?? 42} km/h</strong>
                </div>
                <div>
                  <span className="text-[#737373]">DIST TO STOPBAR:</span>{' '}
                  <strong className="text-[#06b6d4]">{amb?.distanceToNextSignal ?? 142} m</strong>
                </div>
                <div>
                  <span className="text-[#737373]">ETA:</span>{' '}
                  <strong className="text-[#38a169]">{amb?.etaSeconds ?? 12} s</strong>
                </div>
              </div>
            </div>

            {/* Phase Timing Split Timeline */}
            <div className="bg-[#111111] border border-[#242424] rounded p-2.5 mt-1 font-mono">
              <div className="flex items-center justify-between text-[10px] text-[#737373] mb-1.5">
                <span className="text-[#F5F5F5] font-bold">120s NEMA TS-2 Cycle Split Breakdown</span>
                <span className="text-[#06b6d4] font-semibold">
                  ACTIVE PHASE: {selectedSignal?.emergencyState ?? 'GREEN'} (+24.0s Preempt Lock)
                </span>
              </div>
              <div className="w-full h-5 rounded overflow-hidden flex bg-[#171717] border border-[#242424] text-[10px] font-bold">
                <div className="bg-[#38a169] text-[#111111] flex items-center justify-center relative overflow-hidden" style={{ width: '60%' }}>
                  <span className="z-10 px-1 truncate">P2 CORRIDOR GREEN (72s)</span>
                  <div className="absolute inset-0 bg-[#38a169]/30 animate-pulse" />
                </div>
                <div className="bg-[#d97706] text-[#111111] flex items-center justify-center" style={{ width: '5%' }}>
                  <span>Y</span>
                </div>
                <div className="bg-[#d04848] text-[#F5F5F5] flex items-center justify-center" style={{ width: '5%' }}>
                  <span>R</span>
                </div>
                <div className="bg-[#262626] text-[#A3A3A3] flex items-center justify-center" style={{ width: '30%' }}>
                  <span className="truncate px-1">P4 EW REVERT (36s)</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#737373] mt-1.5 px-0.5">
                <div>CMU: <strong className="text-[#38a169]">ZERO CONFLICTS</strong></div>
                <div>Permissive Flash: <strong className="text-[#A3A3A3]">Suppressed</strong></div>
                <div>Voltage: <strong className="text-[#A3A3A3]">120.2V Nominal</strong></div>
                <div>Hardware Interlock: <strong className="text-[#06b6d4]">ENGAGED</strong></div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: CONTROLLER SPECS, SATURATION & AUDIT LOG (3 COLS) */}
        {/* ============================================================ */}
        <section className="lg:col-span-3 flex flex-col gap-3 min-h-0">
          {/* Top Right Card: Field Controller Specs */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 shadow-sm font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#242424] mb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
                FIELD CONTROLLER SPECS
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] bg-[#06b6d4]/15 border border-[#06b6d4]/30 text-[#06b6d4] font-bold">
                ONLINE • 100Hz
              </span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between py-0.5 border-b border-[#242424]">
                <span className="text-[#737373]">Cabinet Type:</span>
                <span className="text-[#F5F5F5] font-semibold">NEMA TS-2 Type 1</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#242424]">
                <span className="text-[#737373]">Telemetry Host:</span>
                <span className="text-[#F5F5F5]">127.0.0.1:8000</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#242424]">
                <span className="text-[#737373]">TraCI Protocol:</span>
                <span className="text-[#38a169] font-bold">Sumo-API v1.2</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#242424]">
                <span className="text-[#737373]">Preempt Channel:</span>
                <span className="text-[#06b6d4] font-bold">DSRC / Opticom CH-1</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-[#737373]">Signal Cycle:</span>
                <span className="text-[#38a169] font-semibold">Preemption Lock Active</span>
              </div>
            </div>
          </div>

          {/* Middle Right Card: Realtime Approach Saturation */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 shadow-sm flex flex-col justify-between font-mono">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
                APPROACH SATURATION
              </h3>
              <span className="text-[10px] text-[#737373]">{selectedSignalId} Loops</span>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#A3A3A3]">N-S Corridor Approach:</span>
                  <span className="text-[#38a169] font-bold">Flushed • Green Wave</span>
                </div>
                <div className="w-full bg-[#111111] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#38a169] h-full rounded-full" style={{ width: '8%' }} />
                </div>
                <div className="flex justify-between text-[9px] text-[#737373] mt-0.5">
                  <span>Occupancy: 4.1%</span>
                  <span>Speed: {amb?.speedKmh ?? 42} km/h</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#A3A3A3]">E-W Cross Approaches:</span>
                  <span className="text-[#d97706] font-bold">Held (Safe Inhibit)</span>
                </div>
                <div className="w-full bg-[#111111] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#d97706] h-full rounded-full" style={{ width: '65%' }} />
                </div>
                <div className="flex justify-between text-[9px] text-[#737373] mt-0.5">
                  <span>Queue Delay: ~18s</span>
                  <span>Occupancy: 68.2%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Right Card: Preemption Event Audit Trail */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex-1 flex flex-col justify-between shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#242424]">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">
                PREEMPT AUDIT LOG
              </h3>
              <span className="w-2 h-2 rounded-full bg-[#38a169] shadow-[0_0_6px_#38a169]" />
            </div>

            <div className="space-y-1.5 font-mono text-[10px] my-auto overflow-y-auto pr-0.5">
              {signalAuditEvents.length === 0 ? (
                <div className="text-[#737373] py-2 text-center">Monitoring corridor signal transitions...</div>
              ) : (
                signalAuditEvents.map((evt) => (
                  <div key={evt.id} className="text-[#A3A3A3] truncate">
                    <span className="text-[#737373]">+{Math.round(evt.timestamp)}s</span>{' '}
                    <span className="text-[#06b6d4]">[{evt.relatedSignal ?? 'SYS'}]</span> {evt.description}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#242424]">
              <button
                onClick={onResetCorridor}
                className="w-full py-1.5 bg-[#d04848]/20 hover:bg-[#d04848]/30 border border-[#d04848]/50 text-[#d04848] rounded text-[10px] font-mono font-bold tracking-wider transition-colors cursor-pointer"
              >
                EMERGENCY ABORT CORRIDOR
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
