import { useMemo } from 'react';
import { Ambulance, Gauge, Clock, Navigation, MapPin } from 'lucide-react';
import type { TelemetryData } from '../types/telemetry';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';

interface AmbulanceStatusProps {
  telemetry?: TelemetryData['ambulance'] | null;
  signals?: TelemetryData['signals'];
  id?: string;
  status?: string;
  eta?: string;
  speed?: number;
  speedUnit?: string;
  distanceToTarget?: number;
  distanceUnit?: string;
}

export function AmbulanceStatus({
  telemetry,
  signals,
  id = 'AMB-01',
  status = 'EN_ROUTE',
  eta = '02:41',
  speed = 42,
  speedUnit = 'km/h',
  distanceToTarget = 1.8,
  distanceUnit = 'km',
}: AmbulanceStatusProps) {
  const displayId = telemetry?.id ?? id;
  const displayStatus = telemetry?.status ?? status;
  const isArrived = displayStatus === 'ARRIVED';
  const isEnRoute = displayStatus === 'EN_ROUTE';
  const isStaged = displayStatus === 'STAGED';

  const speedDisplay =
    telemetry?.speedKmh !== undefined
      ? `${Math.round(telemetry.speedKmh)} ${speedUnit}`
      : `${speed} ${speedUnit}`;

  const distToNextVal = telemetry
    ? telemetry.distanceToNextSignal < 1000
      ? `${Math.round(telemetry.distanceToNextSignal)}m`
      : `${(telemetry.distanceToNextSignal / 1000).toFixed(1)}km`
    : `${distanceToTarget}${distanceUnit}`;

  const etaVal = telemetry ? `${telemetry.etaSeconds}s` : eta;
  const nextSignalId = isArrived ? 'HOSPITAL' : (telemetry?.nextSignal ?? 'SIG-01');

  // Real count of signals cleared along the 4-junction arterial
  const clearedSignalsCount = useMemo(() => {
    if (isArrived) return 4;
    if (!signals) return 0;
    return signals.filter(
      (s) => s.emergencyState === 'RESTORED' || (s.emergencyState as string) === 'RESTORING'
    ).length;
  }, [signals, isArrived]);

  // Mission progress percentage based on SUMO coordinates (Y: 300 -> 0)
  const progressPct = useMemo(() => {
    if (isArrived) return 100;
    if (!telemetry || !Number.isFinite(telemetry.y)) return isEnRoute ? 15 : 0;
    const raw = ((300 - telemetry.y) / 300) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [telemetry, isArrived, isEnRoute]);

  // Signal state progression nodes
  const getSigState = (sigId: string) => {
    const s = signals?.find((item) => item.id === sigId);
    if (!s) return 'HOLD';
    if (s.emergencyState === 'EMERGENCY PRIORITY' || (s.emergencyState as string) === 'PRIORITY') return 'LOCK';
    if (s.emergencyState === 'PREPARING') return 'ARM';
    if (s.emergencyState === 'RESTORED') return 'PASS';
    return 'HOLD';
  };

  const sigNodes = [
    { id: 'SIG-01', state: getSigState('SIG-01') },
    { id: 'SIG-02', state: getSigState('SIG-02') },
    { id: 'SIG-03', state: getSigState('SIG-03') },
    { id: 'SIG-04', state: getSigState('SIG-04') },
  ];

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <div>
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Ambulance className="w-4 h-4 text-red-500" />
            <CardTitle className="text-gray-100">Ambulance Unit</CardTitle>
            <Tooltip content="Primary operational emergency vehicle with active corridor preemption">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge
            variant={
              isArrived
                ? 'success'
                : isEnRoute
                ? 'default'
                : isStaged
                ? 'warning'
                : 'muted'
            }
          >
            {isArrived ? 'Arrived' : isEnRoute ? 'En Route' : displayStatus}
          </Badge>
        </CardHeader>

        <CardContent className="p-3.5 space-y-3 font-mono">
          {/* Main Hero Entity Banner */}
          <div className="bg-gray-950/80 border border-gray-800/90 rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-red-950/60 border border-red-800/80 flex items-center justify-center shrink-0">
                <Ambulance className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-gray-100 font-headline">
                  {displayId}
                </span>
                <span className="text-[10px] text-red-400 font-bold tracking-widest block uppercase mt-0.5">
                  {displayStatus}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
                Corridor Speed
              </span>
              <span className="text-lg font-bold text-gray-100 font-mono">{speedDisplay}</span>
            </div>
          </div>

          {/* Clean 2x2 Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Speed & ETA */}
            <div className="bg-gray-950/70 border border-gray-800/80 rounded p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                <Gauge className="w-3.5 h-3.5 text-gray-500" />
                <span>Speed:</span>
              </div>
              <span className="font-bold text-gray-100 font-mono">{speedDisplay}</span>
            </div>

            <div className="bg-gray-950/70 border border-gray-800/80 rounded p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span>ETA:</span>
              </div>
              <span className="font-bold text-emerald-400 font-mono">{etaVal}</span>
            </div>

            {/* Next Signal & Distance */}
            <div className="bg-gray-950/70 border border-gray-800/80 rounded p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                <Navigation className="w-3.5 h-3.5 text-gray-500" />
                <span>Next Sig:</span>
              </div>
              <span className="font-bold text-gray-100 font-mono">{nextSignalId}</span>
            </div>

            <div className="bg-gray-950/70 border border-gray-800/80 rounded p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                <span>Dist:</span>
              </div>
              <span className="font-bold text-gray-100 font-mono">{distToNextVal}</span>
            </div>
          </div>

          {/* Mission Progress Bar & Cleared Signals Metric */}
          <div className="bg-gray-950/60 border border-gray-800/80 rounded p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-gray-400 uppercase tracking-wide text-[10px]">
                Corridor Clearance
              </span>
              <span className="text-emerald-400 font-bold font-mono">
                {clearedSignalsCount} / 4 SIGNALS CLEARED
              </span>
            </div>
            <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Route Progression Nodes */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              <span>Wave Sequence</span>
              <span className="text-emerald-400 text-[9px]">Preempted</span>
            </div>
            <div className="bg-gray-950/80 border border-gray-800/90 rounded p-2 flex items-center justify-between text-[10px]">
              {sigNodes.map((node, index) => {
                const isPass = node.state === 'PASS';
                const isLock = node.state === 'LOCK';
                const isArm = node.state === 'ARM';

                let color = 'text-gray-500';
                if (isPass || isLock) color = 'text-emerald-400';
                else if (isArm) color = 'text-amber-400';

                return (
                  <div key={node.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-500">{node.id}</span>
                      <span className={`font-bold ${color}`}>
                        {node.state}
                      </span>
                    </div>
                    {index < sigNodes.length - 1 && (
                      <span className="text-gray-700 mx-1.5 text-[9px]">→</span>
                    )}
                  </div>
                );
              })}

              <span className="text-gray-700 mx-1.5 text-[9px]">→</span>

              <div className="flex flex-col items-center">
                <span className="text-[9px] text-red-400 font-semibold">HOSP</span>
                <span className={`font-bold ${isArrived ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {isArrived ? 'ARRV' : 'TERM'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </div>

      {/* Prominent Footer Status */}
      <div className="p-3.5 pt-0 font-mono">
        <div className="bg-gray-950/90 border border-emerald-800/30 rounded p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] tracking-wider text-gray-200 font-bold uppercase">
              {isArrived ? 'Corridor Mission Complete' : 'Priority Corridor Active'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">ROUTE 4A</span>
        </div>
      </div>
    </Card>
  );
}

