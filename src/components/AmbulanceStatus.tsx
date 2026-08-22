import { useLocale } from '../i18n/useLocale';
import type { TelemetryData } from '../types/telemetry';

interface AmbulanceStatusProps {
  telemetry?: TelemetryData['ambulance'] | null;
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
  id = 'AMB-01',
  status = 'Active',
  eta = '04:32',
  speed = 42,
  speedUnit = 'km/h',
  distanceToTarget = 2.4,
  distanceUnit = 'km',
}: AmbulanceStatusProps) {
  const { t } = useLocale();

  const displayId = telemetry?.id ?? id;
  const displayStatus = telemetry?.status ?? status;
  const displayEta = telemetry ? `${telemetry.etaSeconds}s` : eta;
  const displaySpeed = telemetry?.speedKmh ?? speed;
  const displayDistance = telemetry ? telemetry.distanceToNextSignal : distanceToTarget;
  const displayDistUnit = telemetry ? 'm' : distanceUnit;

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
            {displayId}
            <span className="bg-error text-on-error font-data text-[10px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wide shadow-sm">
              {displayStatus}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-data text-[12px] font-semibold text-on-surface-variant uppercase mb-1">
            {t.emergency.eta}
          </div>
          <div className="font-data text-[24px] font-medium text-primary leading-none">
            {displayEta}
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
            {displaySpeed}{' '}
            <span className="text-sm text-on-surface-variant">{speedUnit}</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-3 rounded-lg shadow-inner">
          <div className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-1">
            {t.emergency.distanceToTarget}
          </div>
          <div className="font-data text-lg font-medium text-on-surface">
            {displayDistance}{' '}
            <span className="text-sm text-on-surface-variant">{displayDistUnit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
