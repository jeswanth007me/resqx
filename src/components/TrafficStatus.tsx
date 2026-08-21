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
    <div className="p-[var(--spacing-margin)] border-b border-surface-variant/50">
      <div className="font-data text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
        {t.traffic.trafficConditions}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center border border-tertiary/20">
            <span className="material-symbols-outlined text-tertiary text-sm">traffic</span>
          </div>
          <div>
            <div className="font-data text-sm font-medium text-on-surface leading-tight">
              {density}% {t.traffic.density}
            </div>
            <div className="font-body text-sm text-tertiary">
              {congestion} {t.traffic.congestion}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-headline text-xl font-semibold text-on-surface">{averageSpeed}</div>
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase">
            {speedUnit} {t.traffic.averageSpeed}
          </div>
        </div>
      </div>
    </div>
  );
}
