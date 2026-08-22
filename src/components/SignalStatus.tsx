import { useLocale } from '../i18n/useLocale';
import type { TelemetrySignal } from '../types/telemetry';

interface SignalStatusProps {
  signals?: TelemetrySignal[];
}

export function SignalStatus({ signals }: SignalStatusProps) {
  const { t } = useLocale();

  const items = (signals ?? []).map((s) => {
    let statusTag: 'priority' | 'preparing' | 'normal' | 'override' = 'normal';
    if (s.emergencyState === 'EMERGENCY PRIORITY') statusTag = 'override';
    else if (s.emergencyState === 'PREPARING') statusTag = 'preparing';
    else if (s.emergencyState === 'RESTORED') statusTag = 'priority';

    return {
      id: s.id,
      distance: `${s.distanceFromAmbulance}m away`,
      status: statusTag,
      emergencyState: s.emergencyState,
      state: s.state,
    };
  });

  return (
    <div className="p-[var(--spacing-margin)] flex-1 flex flex-col border-b border-surface-variant/50">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <h3 className="font-data text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
          {t.signals.liveRouteSignals}
        </h3>
        <span className="font-data text-[10px] font-semibold text-secondary flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          {items.length} {t.signals.online}
        </span>
      </div>

      {/* Signal List */}
      {items.length === 0 ? (
        <div className="font-data text-xs text-on-surface-variant py-4 text-center">
          No live signals connected
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((signal) => {
            const isOverride = signal.emergencyState === 'EMERGENCY PRIORITY';
            const isPreparing = signal.emergencyState === 'PREPARING';

            const bgClass = isOverride
              ? 'bg-error/20 text-error'
              : isPreparing
              ? 'bg-tertiary/10 text-tertiary animate-pulse'
              : 'bg-secondary/10 text-secondary';

            return (
              <div
                key={signal.id}
                className="flex items-center justify-between bg-surface-container-highest p-3 rounded-lg shadow-sm hover:bg-surface-bright transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${isOverride ? 'bg-error-container/20 text-error' : isPreparing ? 'bg-tertiary-container/20 text-tertiary' : 'bg-secondary-container/20 text-secondary'}`}>
                    <span className="material-symbols-outlined text-[18px]">traffic</span>
                  </div>
                  <div>
                    <div className="font-data text-sm font-medium text-on-surface group-hover:text-secondary transition-colors">
                      {signal.id}
                    </div>
                    <div className="font-data text-[10px] font-semibold text-on-surface-variant">
                      {signal.distance}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`font-data text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded ${bgClass}`}>
                    {signal.emergencyState}
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[16px] group-hover:text-on-surface">
                    chevron_right
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
