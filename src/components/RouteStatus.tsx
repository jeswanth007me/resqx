interface RouteStatusProps {
  name: string;
  distance: string;
  estimatedTime: string;
  signals: number;
  status: string;
}

export function RouteStatus({ name, distance, estimatedTime, signals, status }: RouteStatusProps) {
  return (
    <div className="p-[var(--spacing-margin)] border-b border-surface-variant/50">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-secondary text-[18px]">route</span>
        <h3 className="font-data text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
          Active Route
        </h3>
      </div>

      <div className="bg-surface-container-highest p-4 rounded-xl border-l-2 border-secondary">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-data text-sm font-medium text-on-surface">{name}</div>
            <div className="font-data text-[10px] font-semibold text-secondary uppercase tracking-wider mt-1">
              {status}
            </div>
          </div>
          <div className="text-right">
            <div className="font-data text-lg font-medium text-on-surface">{estimatedTime}</div>
            <div className="font-data text-[10px] font-semibold text-on-surface-variant">{distance}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-[2px] bg-secondary rounded-full" />
          <span className="material-symbols-outlined text-secondary text-[14px]">emergency</span>
          <div className="flex-1 h-[2px] bg-secondary rounded-full" />
        </div>

        <div className="flex justify-between mt-2">
          <span className="font-data text-[10px] font-semibold text-on-surface-variant uppercase">
            {signals} signals on route
          </span>
        </div>
      </div>
    </div>
  );
}
