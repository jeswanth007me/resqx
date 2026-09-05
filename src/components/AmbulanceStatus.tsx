import type { TelemetryData } from '../types/telemetry';

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

  const speedDisplay = telemetry?.speedKmh
    ? `${Math.round(telemetry.speedKmh)} ${speedUnit}`
    : `${speed} ${speedUnit}`;

  const distVal = telemetry
    ? telemetry.distanceToNextSignal < 1000
      ? `${Math.round(telemetry.distanceToNextSignal)} m`
      : `${(telemetry.distanceToNextSignal / 1000).toFixed(1)} km`
    : `${distanceToTarget} ${distanceUnit}`;

  const etaVal = telemetry ? `${telemetry.etaSeconds}s` : eta;

  // Signal state progression nodes
  const getSigState = (sigId: string) => {
    const s = signals?.find((item) => item.id === sigId);
    if (!s) return 'HOLD';
    if (s.emergencyState === 'EMERGENCY PRIORITY' || (s.emergencyState as string) === 'PRIORITY') return 'LOCK';
    if (s.emergencyState === 'PREPARING') return 'ARM';
    if (s.emergencyState === 'RESTORED') return 'PASS';
    return 'HOLD';
  };

  const sig1 = getSigState('SIG-01');
  const sig2 = getSigState('SIG-02');
  const sig3 = getSigState('SIG-03');
  const sig4 = getSigState('SIG-04');

  return (
    <div className="bg-[#171717] border border-[#242424] rounded p-4 flex flex-col justify-between select-none h-full">
      <div>
        {/* Active Emergency Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#d04848]/12 border border-[#d04848]/25">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d04848] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d04848]" />
            </span>
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#d04848]">
              {isArrived ? 'MISSION ARRIVED' : 'ACTIVE EMERGENCY'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#A3A3A3] font-semibold">PRIORITY 1</span>
        </div>

        {/* Unit Callsign Card */}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded p-3.5 mb-3.5">
          <span className="font-mono text-[10px] tracking-wider text-[#737373] uppercase block mb-1">
            UNIT CALLSIGN
          </span>
          <div className="flex items-baseline justify-between">
            <div className="font-headline font-bold text-[30px] leading-tight text-[#F5F5F5] tracking-tight">
              {displayId}
            </div>
            <div className="font-mono text-[13px] font-bold text-[#d04848]">
              {speedDisplay}
            </div>
          </div>
          <div className="font-mono text-[11px] text-[#A3A3A3] mt-1 font-medium flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isArrived ? 'bg-[#38a169]' : 'bg-[#d04848]'}`} />
            Medical Emergency • Priority Corridor
          </div>
        </div>

        {/* Key Metrics (ETA + Distance) */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="bg-[#141414] border border-[#1e1e1e] rounded p-3 flex flex-col">
            <span className="font-mono text-[10px] text-[#737373] uppercase">EST ARRIVAL</span>
            <span className="font-mono text-[22px] font-bold text-[#F5F5F5] tracking-tight mt-0.5">
              {etaVal}
            </span>
            <span className="font-mono text-[10px] text-[#38a169] mt-0.5">Dynamic Sync</span>
          </div>

          <div className="bg-[#141414] border border-[#1e1e1e] rounded p-3 flex flex-col">
            <span className="font-mono text-[10px] text-[#737373] uppercase">DISTANCE</span>
            <span className="font-mono text-[22px] font-bold text-[#F5F5F5] tracking-tight mt-0.5">
              {distVal}
            </span>
            <span className="font-mono text-[10px] text-[#A3A3A3] mt-0.5">Hospital Arterial</span>
          </div>
        </div>

        {/* Route Progression Flow */}
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="flex items-center justify-between font-mono text-[10px] text-[#737373] uppercase tracking-wider">
            <span>Route Progression</span>
            <span className="text-[#38a169] font-semibold">Wave Preempted</span>
          </div>

          <div className="bg-[#141414] border border-[#1e1e1e] rounded p-2 flex items-center justify-between font-mono text-[11px]">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-[#737373]">SIG-01</span>
              <span className={`font-semibold text-[10px] ${sig1 === 'PASS' || sig1 === 'LOCK' ? 'text-[#38a169]' : 'text-[#737373]'}`}>
                {sig1}
              </span>
            </div>
            <span className="text-[#444444] text-[9px]">→</span>

            <div className={`flex flex-col items-center px-1 py-0.5 rounded ${sig2 === 'LOCK' ? 'bg-[#d04848]/15 border border-[#d04848]/30' : ''}`}>
              <span className={`text-[9px] ${sig2 === 'LOCK' ? 'text-[#d04848] font-bold' : 'text-[#737373]'}`}>SIG-02</span>
              <span className={`font-bold text-[10px] ${sig2 === 'LOCK' ? 'text-[#F5F5F5]' : 'text-[#737373]'}`}>
                {sig2}
              </span>
            </div>
            <span className="text-[#444444] text-[9px]">→</span>

            <div className="flex flex-col items-center">
              <span className="text-[9px] text-[#737373]">SIG-03</span>
              <span className={`font-medium text-[10px] ${sig3 === 'LOCK' || sig3 === 'ARM' ? 'text-[#38a169]' : 'text-[#737373]'}`}>
                {sig3}
              </span>
            </div>
            <span className="text-[#444444] text-[9px]">→</span>

            <div className="flex flex-col items-center">
              <span className="text-[9px] text-[#737373]">SIG-04</span>
              <span className={`font-medium text-[10px] ${sig4 === 'LOCK' ? 'text-[#38a169]' : 'text-[#737373]'}`}>
                {sig4}
              </span>
            </div>
            <span className="text-[#444444] text-[9px]">→</span>

            <div className="flex flex-col items-center">
              <span className="text-[9px] text-[#d04848] font-semibold">HOSP</span>
              <span className={`font-semibold text-[10px] ${isArrived ? 'text-[#38a169]' : 'text-[#F5F5F5]'}`}>
                {isArrived ? 'ARRV' : 'TERM'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Corridor Status */}
      <div className="bg-[#141414] border border-[#38a169]/30 rounded p-2.5 flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#38a169] shadow-[0_0_6px_rgba(56,161,105,0.8)]" />
          <span className="font-mono text-[10px] tracking-wider text-[#F5F5F5] font-bold uppercase">
            PRIORITY CORRIDOR ACTIVE
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#38a169] font-bold">ROUTE 4A</span>
      </div>
    </div>
  );
}
