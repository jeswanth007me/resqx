import { useMemo } from 'react';
import { Ambulance, TrafficCone, Hospital, CheckCircle2, ArrowRight } from 'lucide-react';
import type { TelemetryData } from '../types/telemetry';
import { Badge } from './ui/badge';

interface CorridorFlowPipelineProps {
  telemetry: TelemetryData | null;
  isRunning?: boolean;
  className?: string;
}

type NodeStatus = 'completed' | 'active' | 'pending' | 'idle';

interface FlowNode {
  id: string;
  label: string;
  sublabel: string;
  type: 'ambulance' | 'signal' | 'hospital';
  status: NodeStatus;
  statusText: string;
  distance?: number;
}

export function CorridorFlowPipeline({
  telemetry,
  isRunning = false,
  className = '',
}: CorridorFlowPipelineProps) {
  const amb = telemetry?.ambulance;
  const signals = telemetry?.signals;

  const isArrived = amb?.status === 'ARRIVED' || amb?.status === 'COMPLETED';
  const isEnRoute = amb?.status === 'EN_ROUTE' || amb?.status === 'MOVING' || isRunning;
  const isStaged = !amb || amb.status === 'STAGED' || (!isRunning && !isArrived && amb.speedKmh === 0);

  const clearedSignalsCount = useMemo(() => {
    if (!signals) return 0;
    if (isArrived) return 4;
    return signals.filter(
      (s) => s.emergencyState === 'RESTORED' || (s.emergencyState as string) === 'RESTORING'
    ).length;
  }, [signals, isArrived]);

  const nodes: FlowNode[] = useMemo(() => {
    // 1. AMB-01 Node
    let ambStatus: NodeStatus = 'idle';
    let ambStatusText = 'STAGED';
    if (isArrived) {
      ambStatus = 'completed';
      ambStatusText = 'ARRIVED';
    } else if (isEnRoute) {
      ambStatus = 'active';
      ambStatusText = `${Math.round(amb?.speedKmh ?? 0)} KM/H`;
    }

    const flowNodes: FlowNode[] = [
      {
        id: 'AMB-01',
        label: 'AMB-01',
        sublabel: 'Emergency Unit',
        type: 'ambulance',
        status: ambStatus,
        statusText: ambStatusText,
      },
    ];

    // 2. 4 Corridor Signals (SIG-01 through SIG-04)
    const corridorSignalIds = ['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04'];
    corridorSignalIds.forEach((sigId, index) => {
      const sigData = signals?.find((s) => s.id === sigId);
      const emergencyState = sigData?.emergencyState ?? 'NORMAL';
      const isPriority = emergencyState === 'EMERGENCY PRIORITY' || (emergencyState as string) === 'PRIORITY';
      const isPreparing = emergencyState === 'PREPARING';
      const isRestored = emergencyState === 'RESTORED' || (emergencyState as string) === 'RESTORING';

      let sigStatus: NodeStatus = 'idle';
      let sigStatusText = 'STANDBY';

      if (isArrived || isRestored) {
        sigStatus = 'completed';
        sigStatusText = 'RESTORED';
      } else if (isPriority) {
        sigStatus = 'active';
        sigStatusText = 'PREEMPTED';
      } else if (isPreparing) {
        sigStatus = 'active';
        sigStatusText = 'PREPARING';
      } else if (isEnRoute) {
        // If en route and not yet reached, determine if it's the immediate next signal
        if (amb?.nextSignal === sigId || index === clearedSignalsCount) {
          sigStatus = 'active';
          sigStatusText = 'APPROACHING';
        } else {
          sigStatus = 'pending';
          sigStatusText = 'PENDING';
        }
      }

      flowNodes.push({
        id: sigId,
        label: sigId,
        sublabel: sigId === 'SIG-01' ? '4th & Maple' : sigId === 'SIG-02' ? '6th & Maple' : sigId === 'SIG-03' ? '8th & Maple' : 'Hospital Way',
        type: 'signal',
        status: sigStatus,
        statusText: sigStatusText,
        distance: sigData?.distanceFromAmbulance,
      });
    });

    // 3. Hospital Destination Node
    let hospStatus: NodeStatus = 'idle';
    let hospStatusText = 'DESTINATION';
    if (isArrived) {
      hospStatus = 'completed';
      hospStatusText = 'ARRIVED';
    } else if (isEnRoute) {
      hospStatus = 'pending';
      hospStatusText = amb ? `${amb.etaSeconds}s ETA` : 'PENDING';
    }

    flowNodes.push({
      id: 'HOSPITAL',
      label: 'HOSPITAL',
      sublabel: 'Trauma Center L1',
      type: 'hospital',
      status: hospStatus,
      statusText: hospStatusText,
    });

    return flowNodes;
  }, [amb, signals, isArrived, isEnRoute, clearedSignalsCount]);

  return (
    <div
      className={`bg-gray-950/95 border border-gray-800 rounded p-3 select-none font-mono shadow-sm flex flex-col gap-2.5 ${className}`}
    >
      {/* Header bar: Pipeline title & corridor status */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-2 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-headline font-bold text-xs tracking-wider text-gray-100 uppercase">
              Corridor Flow Pipeline
            </span>
          </div>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <span className="text-[10px] text-gray-400 hidden sm:inline">
            Route 4A Arterial Progression (AMB-01 → SIG-01..04 → Hospital)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              isArrived
                ? 'success'
                : isEnRoute
                ? 'default'
                : isStaged
                ? 'warning'
                : 'secondary'
            }
            className="text-[10px] font-bold"
          >
            {isArrived
              ? 'MISSION COMPLETE'
              : isEnRoute
              ? `${clearedSignalsCount} / 4 SIGNALS CLEARED`
              : 'CORRIDOR STAGED'}
          </Badge>
        </div>
      </div>

      {/* Visual Pipeline Strip */}
      <div className="overflow-x-auto py-1">
        <div className="flex items-center justify-between min-w-[680px] gap-2">
          {nodes.map((node, index) => {
            const isLast = index === nodes.length - 1;

            let borderStyle = 'border-gray-800 bg-gray-900/60 text-gray-400';
            let iconColor = 'text-gray-500';
            let badgeBg = 'bg-gray-800/60 text-gray-400 border-gray-700/60';

            if (node.status === 'completed') {
              borderStyle = 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300';
              iconColor = 'text-emerald-400';
              badgeBg = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
            } else if (node.status === 'active') {
              borderStyle = 'border-emerald-500/80 bg-emerald-950/40 ring-1 ring-emerald-500/40 text-emerald-200';
              iconColor = 'text-emerald-400 animate-pulse';
              badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60';
            } else if (node.status === 'pending') {
              borderStyle = 'border-gray-800/80 bg-gray-900/40 text-gray-400';
              iconColor = 'text-gray-500';
              badgeBg = 'bg-gray-800/40 text-gray-500 border-gray-800';
            }

            return (
              <div key={node.id} className="flex-1 flex items-center">
                {/* Node Box */}
                <div
                  className={`flex-1 p-2 rounded border transition-all duration-200 flex flex-col justify-between min-h-[64px] ${borderStyle}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      {node.type === 'ambulance' ? (
                        <Ambulance className={`w-3.5 h-3.5 ${iconColor}`} />
                      ) : node.type === 'hospital' ? (
                        <Hospital className={`w-3.5 h-3.5 ${iconColor}`} />
                      ) : (
                        <TrafficCone className={`w-3.5 h-3.5 ${iconColor}`} />
                      )}
                      <span className="font-bold text-[11px] text-gray-100 tracking-tight">
                        {node.label}
                      </span>
                    </div>

                    {node.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : node.status === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between text-[9px] gap-1">
                    <span className="text-gray-400 truncate max-w-[80px]" title={node.sublabel}>
                      {node.sublabel}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wider shrink-0 ${badgeBg}`}
                    >
                      {node.statusText}
                    </span>
                  </div>
                </div>

                {/* Arrow connector between nodes */}
                {!isLast && (
                  <div className="px-1.5 flex items-center justify-center shrink-0">
                    <ArrowRight
                      className={`w-3.5 h-3.5 ${
                        node.status === 'completed'
                          ? 'text-emerald-500'
                          : node.status === 'active'
                          ? 'text-emerald-400 animate-pulse'
                          : 'text-gray-700'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
