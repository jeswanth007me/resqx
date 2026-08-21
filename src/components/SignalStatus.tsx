import { useLocale } from '../i18n/useLocale';
import type { SignalPanelItem } from '../data/mockData';

interface SignalStatusProps {
  signals: SignalPanelItem[];
}

const statusStyles: Record<SignalPanelItem['status'], { bg: string; text: string; animate?: boolean }> = {
  priority: { bg: 'bg-secondary/10', text: 'text-secondary' },
  preparing: { bg: 'bg-tertiary/10', text: 'text-tertiary', animate: true },
  normal: { bg: 'bg-surface-variant/50', text: 'text-on-surface-variant' },
  override: { bg: 'bg-error/20', text: 'text-error' },
};

const statusIconBg: Record<SignalPanelItem['status'], string> = {
  priority: 'bg-secondary-container/20 text-secondary',
  preparing: 'bg-tertiary-container/20 text-tertiary',
  normal: 'bg-error-container/20 text-error',
  override: 'bg-error-container/20 text-error',
};

export function SignalStatus({ signals }: SignalStatusProps) {
  const { t } = useLocale();

  return (
    <div className="p-[var(--spacing-margin)] flex-1 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-end mb-4">
        <h3 className="font-data text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
          {t.signals.liveRouteSignals}
        </h3>
        <span className="font-data text-[10px] font-semibold text-secondary flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          {signals.length} {t.signals.online}
        </span>
      </div>

      {/* Signal List */}
      <div className="flex flex-col gap-2">
        {signals.map((signal) => {
          const style = statusStyles[signal.status];
          const iconBg = statusIconBg[signal.status];

          return (
            <div
              key={signal.id}
              className="flex items-center justify-between bg-surface-container-highest p-3 rounded-lg shadow-sm hover:bg-surface-bright transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center ${iconBg}`}>
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
                <div className={`font-data text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded ${style.bg} ${style.text} ${style.animate ? 'animate-pulse' : ''}`}>
                  {t.signals[signal.status]}
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[16px] group-hover:text-on-surface">
                  chevron_right
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
