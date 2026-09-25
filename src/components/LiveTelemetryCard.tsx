import { Activity } from 'lucide-react';
import type { TelemetryData } from '../types/telemetry';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';

interface LiveTelemetryCardProps {
  telemetry: TelemetryData | null;
  connectionStatus: string;
}

export function LiveTelemetryCard({ telemetry, connectionStatus }: LiveTelemetryCardProps) {
  const isConnected = connectionStatus === 'CONNECTED';
  const amb = telemetry?.ambulance;
  const mission = telemetry?.mission;

  const speedVal = amb ? `${Math.round(amb.speedKmh)} km/h` : '42 km/h';
  const distVal = amb
    ? amb.distanceToNextSignal < 1000
      ? `${Math.round(amb.distanceToNextSignal)} m`
      : `${(amb.distanceToNextSignal / 1000).toFixed(1)} km`
    : '1.8 km';
  const etaVal = amb ? `${amb.etaSeconds}s` : '02:41';
  const timeSavedVal = mission ? `+${mission.timeSaved}s` : '+24s';

  return (
    <Card className="border-gray-800 bg-gray-900/95 flex flex-col justify-between">
      <div>
        <CardHeader className="py-2.5 px-3.5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-gray-100">Live Telemetry</CardTitle>
            <Tooltip content="Direct TraCI / sensor metrics stream at 500ms sampling rate">
              <span className="text-[10px] text-gray-500 font-mono cursor-help">ⓘ</span>
            </Tooltip>
          </div>
          <Badge variant={isConnected ? 'success' : 'warning'}>
            {isConnected ? 'TraCI Sync' : 'Standby'}
          </Badge>
        </CardHeader>

        <CardContent className="p-3.5 space-y-1.5 font-mono text-[11px] divide-y divide-gray-800/80">
          <div className="pt-0 flex items-center justify-between">
            <span className="text-gray-400">Current Speed</span>
            <span className="font-bold text-gray-100 text-xs">{speedVal}</span>
          </div>

          <div className="pt-1.5 flex items-center justify-between">
            <span className="text-gray-400">Distance to Next Signal</span>
            <span className="font-bold text-gray-100 text-xs">{distVal}</span>
          </div>

          <div className="pt-1.5 flex items-center justify-between">
            <span className="text-gray-400">Dynamic Arrival ETA</span>
            <span className="font-bold text-emerald-400 text-xs">{etaVal}</span>
          </div>

          <div className="pt-1.5 flex items-center justify-between">
            <span className="text-gray-400">ResQX Corridor Savings</span>
            <span className="font-bold text-emerald-400 text-xs">{timeSavedVal}</span>
          </div>

          <div className="pt-1.5 flex items-center justify-between">
            <span className="text-gray-400">SUMO Vehicle Status</span>
            <span className="text-gray-300 font-semibold">
              {amb?.status ?? 'STAGED'}
            </span>
          </div>
        </CardContent>
      </div>

      <div className="p-3.5 pt-0 text-[10px] font-mono text-gray-500 border-t border-gray-800/60 mt-1 flex items-center justify-between">
        <span>TraCI Step Sync Rate</span>
        <span className="text-emerald-400 font-semibold">500ms Interval</span>
      </div>
    </Card>
  );
}
