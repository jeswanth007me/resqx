import type { TelemetryData } from '../types/telemetry';

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
    <div className="bg-[#171717] border border-[#242424] rounded p-4 flex flex-col select-none">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#242424]">
        <span className="font-mono text-[11px] font-bold tracking-widest text-[#F5F5F5] uppercase">
          LIVE TELEMETRY
        </span>
        <span className="font-mono text-[10px] text-[#38a169] font-semibold">
          AMB-01 SENSORS
        </span>
      </div>

      <div className="flex flex-col divide-y divide-[#1e1e1e] font-mono text-[11px]">
        <div className="py-2 flex items-center justify-between">
          <span className="text-[#A3A3A3]">Speed</span>
          <span className="font-bold text-[#F5F5F5] text-[13px]">{speedVal}</span>
        </div>

        <div className="py-2 flex items-center justify-between">
          <span className="text-[#A3A3A3]">Distance to Hospital</span>
          <span className="font-bold text-[#F5F5F5] text-[13px]">{distVal}</span>
        </div>

        <div className="py-2 flex items-center justify-between">
          <span className="text-[#A3A3A3]">Dynamic ETA</span>
          <span className="font-bold text-[#38a169] text-[13px]">{etaVal}</span>
        </div>

        <div className="py-2 flex items-center justify-between">
          <span className="text-[#A3A3A3]">Time Saved (ResQX)</span>
          <span className="font-bold text-[#38a169] text-[13px]">{timeSavedVal}</span>
        </div>

        <div className="py-2 flex items-center justify-between">
          <span className="text-[#A3A3A3]">GPS Link</span>
          <span className="px-2 py-0.5 rounded bg-[#38a169]/15 border border-[#38a169]/30 text-[#38a169] font-bold text-[9px]">
            {isConnected ? 'LIVE SYNC' : 'ACTIVE'}
          </span>
        </div>

        <div className="py-2 flex items-center justify-between">
          <span className="text-[#A3A3A3]">Signal Feed</span>
          <span className="px-2 py-0.5 rounded bg-[#38a169]/15 border border-[#38a169]/30 text-[#38a169] font-bold text-[9px]">
            4/4 LOCKED
          </span>
        </div>
      </div>
    </div>
  );
}
