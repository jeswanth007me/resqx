import type { EmergencyEvent } from '../types/events';
import type { TelemetryData } from '../types/telemetry';

interface EventTimelineProps {
  events: EmergencyEvent[];
  telemetry?: TelemetryData | null;
  isRunning?: boolean;
}

const severityTag: Record<EmergencyEvent['severity'], { color: string; bg: string }> = {
  SUCCESS: { color: 'text-[#38a169]', bg: 'bg-[#38a169]/15 border-[#38a169]/30' },
  INFO: { color: 'text-[#A3A3A3]', bg: 'bg-[#1e1e1e] border-[#2a2a2a]' },
  WARNING: { color: 'text-[#d97706]', bg: 'bg-[#d97706]/15 border-[#d97706]/30' },
  CRITICAL: { color: 'text-[#d04848]', bg: 'bg-[#d04848]/15 border-[#d04848]/30' },
};

function formatSimTime(timestamp: number): string {
  const m = Math.floor(timestamp / 60);
  const s = Math.floor(timestamp % 60);
  return `+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function EventTimeline({ events, telemetry = null, isRunning = false }: EventTimelineProps) {
  const displayEvents = events.slice(0, 6);

  // Derive the rail from live telemetry only — no hard-coded future timestamps.
  const sigState = (id: string): string => {
    const s = telemetry?.signals.find((x) => x.id === id);
    return s?.emergencyState ?? 'NORMAL';
  };

  const ambStatus = telemetry?.ambulance.status ?? (isRunning ? 'STAGED' : 'STAGED');
  const ambTime = telemetry?.simulation.elapsedTime ?? 0;
  const isArrived = ambStatus === 'ARRIVED';
  const isEnRoute = ambStatus === 'EN_ROUTE' || isArrived;

  // Each signal is "done" once SUMO reports it RESTORED, otherwise pending/active.
  const sigDone = (id: string): boolean => sigState(id) === 'RESTORED';

  // The "currently active" signal is the first non-done signal in corridor order.
  const corridor = ['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04'];
  const activeSigIndex = isArrived
    ? -1
    : corridor.findIndex((id) => !sigDone(id));

  // Init gates: Dispatch, Route Calc, Safety Gate are completed at mission start
  // (isRunning OR AMB-01 is en-route) and stay pending otherwise.
  const initialized = isRunning || isEnRoute;
  const dispatchDone = initialized;
  const routeCalcDone = initialized;
  const safetyGateDone = initialized;

  const sig1Done = sigDone('SIG-01');
  const sig2Done = sigDone('SIG-02');
  const sig3Done = sigDone('SIG-03');
  const sig4Done = sigDone('SIG-04');

  // Active step: priority is the first unfinished step, in the required order.
  // Hospital becomes done only when AMB-01 actually arrives.
  type Step = { label: string; done: boolean; active: boolean };
  const steps: Step[] = [
    { label: 'Dispatch', done: dispatchDone, active: false },
    { label: 'Route Calc', done: routeCalcDone, active: false },
    { label: 'Safety Gate', done: safetyGateDone, active: false },
    { label: 'SIG-01', done: sig1Done, active: !sig1Done && activeSigIndex === 0 && !isArrived },
    { label: 'SIG-02', done: sig2Done, active: !sig2Done && activeSigIndex === 1 && !isArrived },
    { label: 'SIG-03', done: sig3Done, active: !sig3Done && activeSigIndex === 2 && !isArrived },
    { label: 'SIG-04', done: sig4Done, active: !sig4Done && activeSigIndex === 3 && !isArrived },
    { label: 'Hospital', done: isArrived, active: false },
  ];

  // If no signal is active and we are en-route but not yet at Hospital, that means
  // we're between signals — keep the next-pending signal visually "active" so the
  // rail does not freeze. (Already handled by activeSigIndex for non-done signals.)

  const completedCount = steps.filter((s) => s.done).length;
  const activeCount = steps.filter((s) => s.active).length;
  const totalSlots = steps.length;
  // Rail highlight grows with done+active steps. When fully arrived, 100%.
  const progressRatio = isArrived
    ? 1
    : Math.min(1, (completedCount + activeCount) / totalSlots);

  const fmt = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stepTime = (_label: string, idx: number): string => {
    if (steps[idx].active) return 'NOW';
    if (steps[idx].done) return fmt(ambTime);
    return '--:--';
  };

  return (
    <div className="bg-[#171717] border border-[#242424] rounded p-4 flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-[#A3A3A3]">timeline</span>
          <span className="font-mono text-[11px] uppercase font-bold tracking-widest text-[#F5F5F5]">
            MISSION EVENT TIMELINE
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#38a169] font-semibold">
          {isArrived ? 'MISSION COMPLETE' : isRunning || isEnRoute ? 'ACTIVE CORRIDOR EXECUTION' : 'STAGED'}
        </span>
      </div>

      {/* ── HORIZONTAL MILESTONE PROGRESSION RAIL ── */}
      <div className="w-full overflow-x-auto py-1">
        <div className="min-w-[720px] flex items-center justify-between relative px-4">
          {/* Background Rail */}
          <div className="absolute left-6 right-6 top-3 h-[2px] bg-[#242424]" />
          {/* Active Highlight Line — grows with live progress */}
          <div
            className="absolute left-6 top-3 h-[2px] bg-[#38a169] transition-all"
            style={{ width: `calc((100% - 3rem) * ${progressRatio})` }}
          />

          {/* Steps */}
          {steps.map((step, idx) => {
            const isDone = step.done;
            const isActive = step.active;

            return (
              <div key={idx} className="flex flex-col items-center text-center z-10">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                    isActive
                      ? 'bg-[#d04848] text-white ring-4 ring-[#d04848]/25 animate-pulse'
                      : isDone
                      ? 'bg-[#38a169] text-[#111111]'
                      : 'bg-[#1e1e1e] border border-[#333333] text-[#737373]'
                  }`}
                >
                  {isDone ? (
                    <span className="material-symbols-outlined text-[13px]">check</span>
                  ) : isActive ? (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#555555]" />
                  )}
                </div>
                <span
                  className={`font-mono text-[9px] mt-1.5 ${
                    isActive ? 'text-[#d04848] font-bold' : isDone ? 'text-[#38a169]' : 'text-[#737373]'
                  }`}
                >
                  {stepTime(step.label, idx)}
                </span>
                <span
                  className={`font-mono text-[10px] font-medium ${
                    isActive ? 'text-[#F5F5F5] font-bold' : isDone ? 'text-[#F5F5F5]' : 'text-[#737373]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RECENT LIVE TRANSITION AUDIT LOG (CLEAN MONOSPACE ROWS) ── */}
      {displayEvents.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 border-t border-[#242424] pt-2">
          {displayEvents.map((evt) => {
            const tag = severityTag[evt.severity] ?? severityTag.INFO;
            return (
              <div
                key={evt.id}
                className="flex items-center justify-between bg-[#141414] border border-[#1e1e1e] px-2.5 py-1.5 rounded font-mono text-[11px]"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-[#737373] text-[10px] shrink-0 font-medium">
                    {formatSimTime(evt.timestamp)}
                  </span>
                  <span className="text-[#F5F5F5] truncate text-[11px]">{evt.description}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 ml-2 ${tag.bg} ${tag.color}`}>
                  {evt.type.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
