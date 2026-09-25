import { Activity } from 'lucide-react';
import { useLocale } from '../i18n/useLocale';

interface TrafficStatusProps {
  density: number;
  congestion: string;
  averageSpeed: number;
  speedUnit: string;
}

export function TrafficStatus({ density, congestion, averageSpeed, speedUnit }: TrafficStatusProps) {
  const { t } = useLocale();

  return (
    <div className="p-4 border-b border-gray-800">
      <div className="font-mono text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {t.traffic.trafficConditions}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-950/30 flex items-center justify-center border border-amber-800/40">
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="font-mono text-sm font-medium text-gray-100 leading-tight">
              {density}% {t.traffic.density}
            </div>
            <div className="font-mono text-sm text-amber-400">
              {congestion} {t.traffic.congestion}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-headline text-xl font-semibold text-gray-100">{averageSpeed}</div>
          <div className="font-mono text-[10px] font-semibold text-gray-500 uppercase">
            {speedUnit} {t.traffic.averageSpeed}
          </div>
        </div>
      </div>
    </div>
  );
}
