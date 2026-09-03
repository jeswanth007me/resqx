import { useLocale } from '../i18n/useLocale';

interface SimulationControlsProps {
  isRunning: boolean;
  speed: 1 | 2 | 5;
  isConnected: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: 1 | 2 | 5) => void;
}

export function SimulationControls({
  isRunning,
  speed,
  isConnected,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
}: SimulationControlsProps) {
  const { t } = useLocale();

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 z-50 control-bar flex items-center justify-between px-[var(--spacing-margin)]">
      {/* Scenario Selection */}
      <div className="flex items-center gap-[var(--spacing-margin)]">
        <div className="flex flex-col">
          <label className="font-data text-[10px] font-semibold text-on-surface-variant uppercase mb-1">
            {t.simulation.scenarioSelection}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-primary/20 text-primary border border-primary/40 font-body text-sm rounded-lg hover:bg-primary/30 transition-all cursor-pointer font-semibold"
            >
              Corridor Emergency
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-surface-container-highest text-on-surface-variant font-body text-sm rounded-lg opacity-50 border-none cursor-not-allowed"
              title="Secondary scenario available in advanced mode"
            >
              High-Rise Fire
            </button>
          </div>
        </div>
      </div>

      {/* Playback Controls & Speed */}
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-surface-container-lowest rounded-full p-1 gap-1 border border-outline-variant/30">
          <button
            type="button"
            onClick={isRunning ? onPause : onStart}
            className={`p-3 rounded-full transition-all flex items-center justify-center border-none cursor-pointer ${
              isRunning
                ? 'text-secondary bg-secondary/10 hover:bg-secondary/20'
                : 'text-primary hover:bg-primary/10'
            }`}
            aria-label={isRunning ? t.controls.pause : t.controls.play}
            title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
          >
            <span className="material-symbols-outlined">
              {isRunning ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="p-3 rounded-full transition-all flex items-center justify-center border-none bg-transparent text-on-surface-variant hover:bg-surface-variant cursor-pointer"
            aria-label={t.controls.reset}
            title="Reset Simulation to Initial Staged State"
          >
            <span className="material-symbols-outlined">replay</span>
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-2">
          <span className="font-data text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
            {t.simulation.simulationSpeed}
          </span>
          {([1, 2, 5] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-3 py-1.5 rounded-lg font-data text-xs font-semibold transition-all border-none cursor-pointer ${
                speed === s
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Operational Status Tag */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-secondary animate-pulse' : 'bg-tertiary'}`} />
          <span className="text-[10px] font-data font-bold uppercase text-on-surface-variant">
            {isConnected ? 'SUMO LIVE' : 'LOCAL FALLBACK'}
          </span>
        </div>
      </div>

      {/* Start Emergency Button */}
      <div className="flex items-center gap-[var(--spacing-gutter)]">
        <button
          type="button"
          onClick={onStart}
          className="flex items-center gap-2 px-6 py-3 font-headline font-semibold text-sm rounded-xl transition-all uppercase tracking-wider border-none shadow-lg bg-error text-on-error hover:brightness-110 active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined">warning</span>
          {t.simulation.startEmergency}
        </button>
      </div>
    </footer>
  );
}
