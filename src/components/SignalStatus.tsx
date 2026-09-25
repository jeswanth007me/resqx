import { TrafficCone } from 'lucide-react';
import type { TelemetrySignal } from '../types/telemetry';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';

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
      phasePattern: s?.state,
    };
  });

  const activePriorityCount = signalList.filter((s) => s.isPriority).length;

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <div>
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <TrafficCone className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-gray-100">Signal Interlocks</CardTitle>
            <Tooltip content="Cascaded emergency corridor signal preemption states in 2x2 layout">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge variant={activePriorityCount > 0 ? 'success' : 'secondary'}>
            {activePriorityCount > 0 ? `${activePriorityCount} Active Priority` : '4 Monitored'}
          </Badge>
        </CardHeader>

        <CardContent className="p-3.5 font-mono">
          <div className="grid grid-cols-2 gap-2">
            {signalList.map((sig) => {
              let badgeVariant: 'success' | 'warning' | 'info' | 'secondary' = 'secondary';
              let badgeLabel = 'NORMAL';
              let cardStyle = 'bg-gray-950/70 border-gray-800/80 text-gray-300';
              let iconColor = 'text-gray-500';

              if (sig.isPriority) {
                badgeVariant = 'success';
                badgeLabel = 'PRIORITY';
                cardStyle = 'bg-emerald-950/30 border-emerald-700/60 ring-1 ring-emerald-500/40 text-emerald-200';
                iconColor = 'text-emerald-400 animate-pulse';
              } else if (sig.isPreparing) {
                badgeVariant = 'warning';
                badgeLabel = 'PREPARING';
                cardStyle = 'bg-amber-950/30 border-amber-700/50 text-amber-200';
                iconColor = 'text-amber-400';
              } else if (sig.isRestored) {
                badgeVariant = 'info';
                badgeLabel = 'RESTORED';
                cardStyle = 'bg-gray-950/40 border-gray-800/40 opacity-70 text-gray-400';
                iconColor = 'text-sky-400';
              }

              return (
                <div
                  key={sig.id}
                  className={`p-2.5 rounded border transition-all flex flex-col justify-between min-h-[76px] ${cardStyle}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <TrafficCone className={`w-3 h-3 ${iconColor} shrink-0`} />
                      <span className="font-bold text-gray-100 text-xs tracking-tight">
                        {sig.id}
                      </span>
                    </div>
                    <Badge variant={badgeVariant} className="text-[8px] py-0 px-1 font-bold">
                      {badgeLabel}
                    </Badge>
                  </div>

                  <div className="text-[10px] text-gray-400 truncate mb-1" title={sig.cross}>
                    {sig.cross}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-gray-500 pt-1 border-t border-gray-800/60">
                    <span>{Math.round(sig.distance)}m</span>
                    {sig.phasePattern ? (
                      <span className="font-mono text-gray-400 text-[8px] uppercase">
                        {sig.phasePattern}
                      </span>
                    ) : (
                      <span className="text-gray-600">AUTO</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </div>

      <div className="p-3.5 pt-0 text-[10px] font-mono text-gray-500 border-t border-gray-800/60 mt-1 flex items-center justify-between">
        <span>Route 4A Arterial Signals</span>
        <span className="text-emerald-400 font-semibold">Deterministic Control</span>
      </div>
    </Card>
  );
}

