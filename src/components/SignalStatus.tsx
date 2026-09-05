import type { TelemetrySignal } from '../types/telemetry';

interface SignalStatusProps {
  signals?: TelemetrySignal[];
}

const SIGNAL_METADATA: Record<string, { name: string; cross: string }> = {
  'SIG-01': { name: 'North Gate', cross: '4th & Maple Ave' },
  'SIG-02': { name: 'Central Intersection', cross: '6th & Maple Ave' },
  'SIG-03': { name: 'Hospital Approach', cross: '8th & Maple Ave' },
  'SIG-04': { name: 'South Corridor', cross: 'Hospital Way' },
};

export function SignalStatus({ signals }: SignalStatusProps) {
  const signalList = ['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04'].map((id) => {
    const s = signals?.find((item) => item.id === id);
    const meta = SIGNAL_METADATA[id] ?? { name: id, cross: 'Arterial Junction' };
    const emergencyState = s?.emergencyState ?? 'NORMAL';
    const isPriority = emergencyState === 'EMERGENCY PRIORITY' || (emergencyState as string) === 'PRIORITY';
    const isPreparing = emergencyState === 'PREPARING';
    const isRestored = emergencyState === 'RESTORED' || (emergencyState as string) === 'RESTORING';

    return {
      id,
      name: meta.name,
      cross: meta.cross,
      emergencyState,
      isPriority,
      isPreparing,
      isRestored,
      distance: s?.distanceFromAmbulance ?? 0,
      state: s?.state ?? 'rrrrGG',
    };
  });

  return (
    <div className="bg-[#171717] border border-[#242424] rounded p-4 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#242424]">
          <span className="font-mono text-[11px] font-bold tracking-widest text-[#F5F5F5] uppercase">
            TRAFFIC SIGNALS
          </span>
          <span className="font-mono text-[10px] text-[#38a169] font-semibold">
            4 / 4 UNDER CONTROL
          </span>
        </div>

        {/* 4 Spacious Signal Rows */}
        <div className="flex flex-col gap-2">
          {signalList.map((sig) => {
            let badgeText = 'NORMAL';
            let badgeBg = 'bg-[#1e1e1e] text-[#737373] border-[#2a2a2a]';
            let greenBulb = '#262626';
            let yellowBulb = '#262626';
            let redBulb = '#d04848';

            if (sig.isPriority) {
              badgeText = 'PRIORITY';
              badgeBg = 'bg-[#38a169]/15 text-[#38a169] border-[#38a169]/30';
              greenBulb = '#38a169';
              redBulb = '#262626';
            } else if (sig.isPreparing) {
              badgeText = 'PREPARING';
              badgeBg = 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30';
              yellowBulb = '#d97706';
              redBulb = '#262626';
            } else if (sig.isRestored) {
              badgeText = 'RESTORED';
              badgeBg = 'bg-[#38a169]/15 text-[#38a169] border-[#38a169]/30';
              greenBulb = '#38a169';
              redBulb = '#262626';
            }

            return (
              <div
                key={sig.id}
                className="bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded p-2.5 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {/* Vertical 3-Light Signal Head Icon */}
                  <div className="w-3.5 h-8 bg-[#0e0e0e] border border-[#2a2a2a] rounded flex flex-col items-center justify-around py-0.5 shrink-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        redBulb !== '#262626' ? 'bg-[#d04848] shadow-[0_0_4px_#d04848]' : 'bg-[#222222]'
                      }`}
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        yellowBulb !== '#262626' ? 'bg-[#d97706] shadow-[0_0_4px_#d97706]' : 'bg-[#222222]'
                      }`}
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        greenBulb !== '#262626' ? 'bg-[#38a169] shadow-[0_0_4px_#38a169]' : 'bg-[#222222]'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="font-mono text-[11px] font-bold text-[#F5F5F5] flex items-center gap-1.5">
                      {sig.id}
                      <span className="text-[9px] text-[#737373] font-normal">({sig.distance}m)</span>
                    </div>
                    <div className="font-mono text-[9px] text-[#737373]">{sig.cross}</div>
                  </div>
                </div>

                <div className={`flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[9px] font-bold ${badgeBg}`}>
                  {sig.isPriority && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38a169] animate-pulse" />
                  )}
                  {badgeText}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#242424] font-mono text-[10px] text-[#737373] flex items-center justify-between">
        <span>Dynamic Phase Preemption</span>
        <span className="text-[#38a169] font-semibold">100% Interlocked</span>
      </div>
    </div>
  );
}
