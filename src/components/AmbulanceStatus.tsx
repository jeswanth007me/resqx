import { useLocale } from '../i18n/useLocale';

interface AmbulanceStatusProps {
  id: string;
  status: string;
  eta: string;
  speed: number;
  speedUnit: string;
  distanceToTarget: number;
  distanceUnit: string;
}

export function AmbulanceStatus({
  id,
  status,
  eta,
  speed,
  speedUnit,
  distanceToTarget,
  distanceUnit,
}: AmbulanceStatusProps) {
  const { t } = useLocale();

  return (
    <div className="p-[var(--spacing-margin)] border-b border-surface-variant/50 relative overflow-hidden bg-gradient-to-br from-error-container/20 to-transparent">
      {/* Decorative background icon */}
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <span className="material-symbols-outlined text-[120px] text-primary">emergency</span>
      </div>

      {/* Header row */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <div className="font-data text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
            {t.emergency.priorityAsset}
          </div>
          <div className="font-headline text-2xl font-semibold text-on-surface flex items-center gap-2">
            {id}
            <span className="bg-error text-on-error font-data text-[10px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wide shadow-sm">
              {status}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-data text-[12px] font-semibold text-on-surface-variant uppercase mb-1">
            {t.emergency.eta}
          </div>
          <div className="font-data text-[24px] font-medium text-primary leading-none">
            {eta}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="bg-surface-container-lowest p-3 rounded-lg shadow-inner">
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-1">
            {t.emergency.currentSpeed}
          </div>
          <div className="font-data text-lg font-medium text-on-surface">
            {speed}{' '}
            <span className="text-sm text-on-surface-variant">{speedUnit}</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-3 rounded-lg shadow-inner">
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-1">
            {t.emergency.distanceToTarget}
          </div>
          <div className="font-data text-lg font-medium text-on-surface">
            {distanceToTarget}{' '}
            <span className="text-sm text-on-surface-variant">{distanceUnit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
