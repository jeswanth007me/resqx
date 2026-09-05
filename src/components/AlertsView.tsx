import { useState, useMemo } from 'react';
import type { TelemetryData } from '../types/telemetry';
import type { JunctionAssignment } from '../types/police';
import type { EmergencyEvent } from '../types/events';
import type { DispatchedAlertRecord } from '../App';

interface AlertsViewProps {
  telemetry: TelemetryData | null;
  policeAssignments: JunctionAssignment[];
  events: EmergencyEvent[];
  dispatchedAlerts?: DispatchedAlertRecord[];
  connectionStatus: string;
  onResetCorridor?: () => void;
}

// Maps telemetry emergencyState to a display label
function getLiveStateLabel(emergencyState: string | undefined, isDispatched: boolean): string {
  if (isDispatched) return 'ALERT SENT';
  if (emergencyState === 'RESTORED' || emergencyState === 'RESTORING') return 'RESTORED';
  if (emergencyState === 'EMERGENCY PRIORITY' || emergencyState === 'PRIORITY' || emergencyState === 'PASSING') return 'PRIORITY ACTIVE';
  if (emergencyState === 'PREPARING') return 'PREPARING';
  return 'STANDBY';
}

const CORRIDOR_JUNCTIONS = [
  { id: 'SIG-01', name: '4th & Maple', phoneLabel: 'Phone 1', defaultOfficer: 'Insp. Rajesh Kumar', badge: 'TP-4021' },
  { id: 'SIG-02', name: 'Central Junction', phoneLabel: 'Phone 2', defaultOfficer: 'Sub-Insp. Priya Sharma', badge: 'TP-4088' },
  { id: 'SIG-03', name: 'Arterial Approach', phoneLabel: 'Phone 3', defaultOfficer: 'Const. Vikram Singh', badge: 'TP-4105' },
  { id: 'SIG-04', name: 'Metro General Trauma CAD', phoneLabel: 'Phone 4', defaultOfficer: 'Const. Vikram Singh', badge: 'TP-4105' },
];

export function AlertsView({
  telemetry,
  policeAssignments,
  events,
  dispatchedAlerts = [],
  connectionStatus,
  onResetCorridor,
}: AlertsViewProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const amb = telemetry?.ambulance;
  const isConnected = connectionStatus === 'CONNECTED';

  // Filter alert-related events
  const alertEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.type.includes('POLICE') ||
        e.type.includes('ALERT') ||
        e.type.includes('EMERGENCY') ||
        e.type.includes('MISSION')
    );
  }, [events]);

  const activeOfficer = policeAssignments.find((a) => a.status === 'ASSIGNED' || a.status === 'ACKNOWLEDGED') ?? policeAssignments[1] ?? policeAssignments[0];

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 w-full select-none">
      {/* ── 1. SUB-HEADER CONTROL BAR ── */}
      <section className="bg-[#171717] border border-[#242424] rounded px-4 py-2.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38a169] animate-pulse shadow-[0_0_8px_#38a169]" />
            <span className="font-headline font-bold text-[13px] tracking-wider text-[#F5F5F5] uppercase">
              EMERGENCY ALERTS &amp; MULTI-AGENCY BROADCAST
            </span>
          </div>
          <div className="h-4 w-px bg-[#262626] hidden sm:block" />
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#A3A3A3] bg-[#111111] px-2 py-0.5 rounded border border-[#242424]">
            <span className="text-[#38a169] font-bold">NTFY / TWILIO / FIRSTNET</span>
            <span className="text-[#737373]">{isConnected ? 'LIVE ONLINE' : 'LOCAL SIMULATOR'}</span>
          </div>
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {[
            { id: 'all', label: 'All Alerts', count: Math.max(dispatchedAlerts.length, alertEvents.length) },
            { id: 'police', label: 'Police Dispatch', count: dispatchedAlerts.length },
            { id: 'traffic', label: 'Traffic Ops', count: dispatchedAlerts.length },
            { id: 'cad', label: 'Trauma CAD', count: 1 },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                filterCategory === cat.id
                  ? 'bg-[#06b6d4]/20 text-[#06b6d4] font-bold border border-[#06b6d4]/40'
                  : 'bg-[#111111] text-[#737373] hover:text-[#F5F5F5] border border-[#242424]'
              }`}
            >
              {cat.label} <span className="ml-1 text-[9px] opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 2. MAIN 3-COLUMN 16:9 CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 items-stretch">
        {/* ============================================================ */}
        {/* COLUMN 1: CORRIDOR STREAM & SUMMARY METRICS (4 COLS)          */}
        {/* ============================================================ */}
        <section className="lg:col-span-4 flex flex-col gap-3 min-h-0">
          {/* Summary Metrics */}
          <div className="bg-[#171717] border border-[#242424] rounded p-2.5 grid grid-cols-3 gap-2 shrink-0 font-mono text-center">
            <div className="bg-[#111111] border border-[#242424] rounded p-2 flex flex-col">
              <span className="text-[9px] text-[#737373] uppercase font-medium">Delivery Latency</span>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span className="text-base font-bold text-[#38a169]">
                  {dispatchedAlerts.length > 0 ? '0.38s' : '--'}
                </span>
                <span className="text-[9px] text-[#38a169]/80">NTFY</span>
              </div>
            </div>
            <div className="bg-[#111111] border border-[#242424] rounded p-2 flex flex-col">
              <span className="text-[9px] text-[#737373] uppercase font-medium">Delivery Rate</span>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span className="text-base font-bold text-[#38a169]">
                  {dispatchedAlerts.length > 0 ? `${dispatchedAlerts.length}/4` : 'STANDBY'}
                </span>
                <span className="text-[9px] text-[#737373]">{dispatchedAlerts.length > 0 ? 'Active' : '4 Nodes'}</span>
              </div>
            </div>
            <div className="bg-[#111111] border border-[#242424] rounded p-2 flex flex-col">
              <span className="text-[9px] text-[#737373] uppercase font-medium">Active Recv</span>
              <div className="flex items-baseline justify-center gap-1 mt-0.5">
                <span className="text-base font-bold text-[#06b6d4]">{dispatchedAlerts.length} Units</span>
                <span className="text-[9px] text-[#737373]">Synced</span>
              </div>
            </div>
          </div>

          {/* Live Corridor Stream Cards */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#242424] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#d04848] animate-pulse shadow-[0_0_6px_#d04848]" />
                <h2 className="font-headline font-bold text-[#F5F5F5] text-xs tracking-wide">
                  Live Corridor Stream • {amb?.id ?? 'AMB-01'}
                </h2>
              </div>
              <span className="text-[9px] text-[#06b6d4] bg-[#06b6d4]/15 border border-[#06b6d4]/30 px-2 py-0.5 rounded font-mono font-bold">
                {(() => {
                  const liveCount = (telemetry?.signals ?? []).filter(
                    (s) => s.emergencyState === 'EMERGENCY PRIORITY' || s.emergencyState === 'PRIORITY' || s.emergencyState === 'PREPARING'
                  ).length;
                  const dispatchedCount = dispatchedAlerts.length;
                  if (dispatchedCount > 0) return `${dispatchedCount}/4 DISPATCHED`;
                  if (liveCount > 0) return `${liveCount}/4 ACTIVE`;
                  return 'CORRIDOR STAGED';
                })()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 font-mono text-[11px]">
              {CORRIDOR_JUNCTIONS.map((j) => {
                const alertRecord = dispatchedAlerts.find((a) => a.signalId === j.id);
                const assignment = policeAssignments.find((a) => a.signalId === j.id);
                const sigTelemetry = telemetry?.signals.find((s) => s.id === j.id);
                const officerName = alertRecord?.officerName ?? assignment?.officerName ?? j.defaultOfficer;
                const badgeNumber = alertRecord?.badgeNumber ?? assignment?.badgeNumber ?? j.badge;
                const isDispatched = !!alertRecord;
                const liveState = getLiveStateLabel(sigTelemetry?.emergencyState, isDispatched);
                const alertStatus = alertRecord?.status;
                const alertMode = alertRecord?.mode;
                const alertTitle = alertRecord?.title;
                const isPriority = liveState === 'PRIORITY ACTIVE';
                const isPreparing = liveState === 'PREPARING';
                const isRestored = liveState === 'RESTORED';
                const isAlertSent = liveState === 'ALERT SENT';
                const isLive = isPriority || isPreparing || isRestored || isAlertSent;

                const accentColor = isAlertSent
                  ? 'text-[#38a169]'
                  : isPriority
                  ? 'text-[#38a169]'
                  : isPreparing
                  ? 'text-[#d97706]'
                  : isRestored
                  ? 'text-[#06b6d4]'
                  : 'text-[#737373]';

                const statusLabel = isAlertSent
                  ? 'Alert Dispatched'
                  : isPriority
                  ? 'Priority Active'
                  : isPreparing
                  ? 'Preparing'
                  : isRestored
                  ? 'Restored'
                  : 'Standby';

                return (
                  <article
                    key={j.id}
                    className={`bg-[#111111] border rounded p-2.5 flex flex-col gap-1.5 transition-colors ${
                      isLive
                        ? 'border-[#38a169]/40 hover:border-[#38a169]'
                        : 'border-[#242424] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLive
                              ? 'bg-[#38a169] animate-pulse shadow-[0_0_6px_#38a169]'
                              : 'bg-[#737373]'
                          }`}
                        />
                        <span
                          className={`font-bold uppercase ${
                            isLive ? 'text-[#06b6d4]' : 'text-[#737373]'
                          }`}
                        >
                          {statusLabel} • {j.id} ({j.name})
                        </span>
                      </div>
                      <span className="text-[#737373]">{officerName} ({badgeNumber})</span>
                    </div>

                    <p className="font-semibold text-[#F5F5F5] text-[11px] leading-snug">
                      {isAlertSent
                        ? `${alertTitle} • ${alertStatus === 'DELIVERED' ? 'NTFY DELIVERED' : 'NTFY DISPATCHED'}`
                        : isPriority
                        ? `Green Wave Priority active at ${j.id} • Cross-traffic held`
                        : isPreparing
                        ? `Preemption preparing at ${j.id} • Awaiting AMB-01 approach`
                        : isRestored
                        ? `AMB-01 cleared ${j.id} • Signal restored to normal cycle`
                        : `Preemption staged for ${j.id} • Awaiting AMB-01 approach`}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-[#242424] text-[10px]">
                      <span className={`flex items-center gap-1 font-bold ${accentColor}`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {isAlertSent ? 'check_circle' : isLive ? 'sync' : 'schedule'}
                        </span>
                        {liveState === 'ALERT SENT'
                          ? `NTFY ${alertStatus} (${j.phoneLabel})`
                          : isPriority
                          ? `PRIORITY ACTIVE (${j.phoneLabel})`
                          : isPreparing
                          ? `PREPARING (${j.phoneLabel})`
                          : isRestored
                          ? `RESTORED (${j.phoneLabel})`
                          : `STANDBY (${j.phoneLabel})`}
                      </span>
                      <span className="text-[#737373]">
                        {isAlertSent ? `Mode: ${alertMode}` : isLive ? `Mode: ${isConnected ? 'LIVE' : 'LOCAL'}` : 'Threshold: Approach'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* COLUMN 2: RESPONDER HANDSET STREAM & DMS MATRIX (5 COLS)     */}
        {/* ============================================================ */}
        <section className="lg:col-span-5 flex flex-col gap-3 min-h-0">
          {/* Field Responder Handset Stream */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden font-mono">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#242424] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#38a169] shadow-[0_0_6px_#38a169]" />
                <h2 className="font-headline font-bold text-[#F5F5F5] text-xs">
                  Field Responder Handset Stream
                </h2>
              </div>
              <span className="text-[10px] text-[#A3A3A3] bg-[#111111] px-2 py-0.5 rounded border border-[#242424]">
                CAD Relay &bull; {activeOfficer?.officerName ?? 'Insp. Rajesh Kumar'} ({activeOfficer?.badgeNumber ?? 'TP-4021'})
              </span>
            </div>

            {/* Encrypted Chat Stream */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 text-[11px]">
              {dispatchedAlerts.length === 0 ? (
                <div className="bg-[#111111] border border-[#242424] rounded p-3 text-[#737373] text-center space-y-1">
                  <div className="text-[10px] text-[#06b6d4] font-bold">[CAD DISPATCH STANDBY]</div>
                  <p className="text-[11px]">
                    Emergency corridor staged. All 4 junction officers on standby. Real alerts will broadcast as AMB-01 triggers each junction priority.
                  </p>
                </div>
              ) : (
                dispatchedAlerts.map((alert) => (
                  <div key={alert.signalId} className="space-y-1.5">
                    {/* System Dispatch */}
                    <div className="bg-[#111111] border border-[#242424] rounded p-2 text-[#A3A3A3]">
                      <div className="flex justify-between text-[10px] text-[#06b6d4] mb-1">
                        <span className="font-bold">[SYS CAD-AUTO GATEWAY]</span>
                        <span>+{Math.round(alert.timestamp)}s</span>
                      </div>
                      <p className="leading-relaxed">
                        {alert.title}: Preemption active for AMB-01 approach. Cross-traffic lockout engaged.
                      </p>
                    </div>

                    {/* Responder ACK */}
                    <div className="bg-[#1e293b]/50 border border-[#06b6d4]/40 rounded p-2 text-[#F5F5F5] ml-4">
                      <div className="flex justify-between text-[10px] text-[#06b6d4] mb-1">
                        <span className="font-bold">
                          [{alert.badgeNumber} • {alert.officerName.toUpperCase()}]
                        </span>
                        <span>ACK</span>
                      </div>
                      <p className="leading-relaxed">
                        ACK received for {alert.signalId}. Cross-traffic held. Perimeter locked for AMB-01 flyby.
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[9px] text-[#737373] pt-1 border-t border-[#242424]">
                        <span className="text-[#38a169] font-bold">&check;&check; 2-Way NTFY Delivery Confirmed</span>
                        <span>SIG: {alert.signalId}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Current Speed / Telemetry update */}
              <div className="bg-[#111111] border border-[#242424] rounded p-2 text-[#A3A3A3]">
                <div className="flex justify-between text-[10px] text-[#06b6d4] mb-1">
                  <span className="font-bold">[SYS CAD-AUTO GATEWAY]</span>
                  <span>LIVE CORRIDOR STATUS</span>
                </div>
                <p className="leading-relaxed">
                  AMB-01 speed: {amb?.speedKmh ?? 42} km/h • Next: {amb?.nextSignal ?? 'SIG-01'} • ETA: {amb?.etaSeconds ?? 14}s • Corridor status: {amb?.status ?? 'STAGED'}.
                </p>
              </div>
            </div>

            {/* Quick Broadcast push bar */}
            <div className="pt-2 mt-2 border-t border-[#242424] flex gap-2 shrink-0">
              <input
                type="text"
                readOnly
                value="BROADCAST: Corridor wave active. All units maintain station clearance."
                className="flex-1 bg-[#111111] border border-[#242424] text-[11px] rounded px-2.5 py-1 text-[#A3A3A3]"
              />
              <button className="px-3 py-1 bg-[#06b6d4]/20 hover:bg-[#06b6d4]/30 border border-[#06b6d4]/40 text-[#06b6d4] rounded font-bold text-[10px] uppercase">
                PUSH CAD
              </button>
            </div>
          </div>

          {/* Dynamic Roadside Signage (DMS) Preview */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 shrink-0 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#242424]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#d97706]">traffic</span>
                <h2 className="font-headline font-bold text-[#F5F5F5] text-xs">
                  Dynamic Roadside Signage (DMS) Preview
                </h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-[#737373]">LOC: 6th &amp; Maple (DMS-02)</span>
                <span className="px-1.5 py-0.5 rounded bg-[#38a169]/15 border border-[#38a169]/30 text-[#38a169] font-bold">
                  SYNCED
                </span>
              </div>
            </div>

            {/* LED Matrix Banner */}
            <div className="bg-[#050608] border-2 border-[#242424] rounded p-3.5 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden font-mono">
              <div className="absolute top-1.5 left-2 text-[8px] text-[#d97706]/70 uppercase font-bold">
                OVERHEAD MATRIX BOARD #2 • REALTIME SYNCHRONIZED
              </div>
              <div className="py-1">
                <p className="text-[#ff9800] text-base font-black tracking-widest leading-tight drop-shadow-[0_0_8px_rgba(255,152,0,0.6)]">
                  {dispatchedAlerts.length > 0 ? 'EMERGENCY CORRIDOR ACTIVE' : 'EMERGENCY CORRIDOR STAGED'}
                </p>
                <p className="text-[#ff9800] text-sm font-bold tracking-wider leading-snug drop-shadow-[0_0_6px_rgba(255,152,0,0.5)]">
                  YIELD TO AMBULANCE (AMB-01)
                </p>
                <p className="text-[#d97706] text-[11px] font-semibold tracking-wide leading-normal">
                  {dispatchedAlerts.length > 0
                    ? `PRIORITY ACTIVE AT ${dispatchedAlerts[dispatchedAlerts.length - 1].signalId} • CLEAR CROSS TRAFFIC`
                    : 'EXPECT SIGNAL HOLDS • ALL LANES CLEAR'}
                </p>
              </div>
              <div className="absolute bottom-1 right-2 text-[8px] text-[#d97706]/60">
                NTCIP 1203 PROTOCOL • REFRESH: 1.0s
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* COLUMN 3: SAFETY CONFLICT & SYSTEM TELEMETRY (3 COLS)        */}
        {/* ============================================================ */}
        <section className="lg:col-span-3 flex flex-col gap-3 min-h-0 font-mono">
          {/* Conflict Engine Status */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 shrink-0 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-[#737373] uppercase font-bold">Conflict Engine</span>
              <span className="flex items-center gap-1 text-[10px] text-[#38a169] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
                VERIFIED
              </span>
            </div>
            <div className="bg-[#111111] border border-[#38a169]/30 rounded p-2 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#38a169]/15 border border-[#38a169]/40 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px] text-[#38a169]">security</span>
              </div>
              <div>
                <div className="font-bold text-[#F5F5F5] text-[11px]">No Intersecting Preemptions</div>
                <div className="text-[10px] text-[#737373]">Cross-traffic locked • Failsafe clear</div>
              </div>
            </div>
          </div>

          {/* Telemetry Infrastructure Health */}
          <div className="bg-[#171717] border border-[#242424] rounded p-3 flex-1 flex flex-col min-h-0 shadow-sm">
            <h2 className="font-headline font-bold text-[#F5F5F5] text-xs pb-1.5 mb-2 border-b border-[#242424] shrink-0 uppercase tracking-wider">
              Telemetry Infrastructure Health
            </h2>
            <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 text-[11px]">
              <div className="flex items-center justify-between p-1.5 bg-[#111111] border border-[#242424] rounded">
                <span className="text-[#A3A3A3]">Loop Sensors SIG-01..04</span>
                <span className="flex items-center gap-1 text-[#38a169] text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
                  Optimal (100Hz)
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 bg-[#111111] border border-[#242424] rounded">
                <span className="text-[#A3A3A3]">SUMO TraCI Host</span>
                <span className="flex items-center gap-1 text-[#38a169] text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
                  {isConnected ? 'Connected' : 'Active'}
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 bg-[#111111] border border-[#242424] rounded">
                <span className="text-[#A3A3A3]">NTFY Phone Transport</span>
                <span className="flex items-center gap-1 text-[#38a169] text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
                  4 Signals Armed
                </span>
              </div>
              <div className="flex items-center justify-between p-1.5 bg-[#111111] border border-[#242424] rounded">
                <span className="text-[#A3A3A3]">AI Safety Interlock Gate</span>
                <span className="flex items-center gap-1 text-[#38a169] text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
                  Approved
                </span>
              </div>
            </div>

            {/* Preemption Escalation Pipeline */}
            <div className="pt-2 mt-2 border-t border-[#242424] shrink-0">
              <div className="text-[10px] text-[#737373] uppercase font-bold mb-1.5">Preemption Pipeline</div>
              <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                <div className="bg-[#38a169]/20 border border-[#38a169]/40 text-[#38a169] rounded p-1">1. Trigger</div>
                <div className="bg-[#38a169]/20 border border-[#38a169]/40 text-[#38a169] rounded p-1">2. 500m Geo</div>
                <div className="bg-[#38a169]/20 border border-[#38a169]/40 text-[#38a169] rounded p-1">3. NTFY Alert</div>
                <div className="bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4] rounded p-1 animate-pulse">4. Sig Lock</div>
              </div>
            </div>
          </div>

          {/* Corridor Termination Emergency Action */}
          <div className="bg-[#171717] border border-[#d04848]/40 rounded p-3 shrink-0 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#d04848] font-bold uppercase tracking-wider">
                Corridor Teardown
              </span>
              <span className="text-[9px] text-[#737373]">FAILSAFE READY</span>
            </div>
            <button
              onClick={onResetCorridor}
              className="w-full py-2 px-3 bg-[#d04848]/20 hover:bg-[#d04848]/30 border border-[#d04848]/50 text-[#d04848] font-bold text-[10px] rounded tracking-wider transition-colors cursor-pointer"
            >
              EXECUTE EMERGENCY TEARDOWN
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
