import type { EmergencyEvent } from '../types/events';

interface EventTimelineProps {
  events: EmergencyEvent[];
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

export function EventTimeline({ events }: EventTimelineProps) {
  const displayEvents = events.slice(0, 6);

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
          ACTIVE CORRIDOR EXECUTION
        </span>
      </div>

      {/* ── HORIZONTAL MILESTONE PROGRESSION RAIL ── */}
      <div className="w-full overflow-x-auto py-1">
        <div className="min-w-[720px] flex items-center justify-between relative px-4">
          {/* Background Rail */}
          <div className="absolute left-6 right-6 top-3 h-[2px] bg-[#242424]" />
          {/* Active Highlight Line */}
          <div className="absolute left-6 w-[52%] top-3 h-[2px] bg-[#38a169]" />

          {/* Steps */}
          {[
            { label: 'Dispatch', time: '00:00', state: 'done' },
            { label: 'Route Calc', time: '00:01', state: 'done' },
            { label: 'Safety Gate', time: '00:02', state: 'done' },
            { label: 'SIG-01', time: '00:08', state: 'done' },
            { label: 'SIG-02', time: 'NOW', state: 'active' },
            { label: 'SIG-03', time: '00:26', state: 'pending' },
            { label: 'SIG-04', time: '00:38', state: 'pending' },
            { label: 'Hospital', time: '00:52', state: 'pending' },
          ].map((step, idx) => {
            const isDone = step.state === 'done';
            const isActive = step.state === 'active';

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
                  {step.time}
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
