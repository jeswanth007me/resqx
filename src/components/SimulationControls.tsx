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
            <button className="px-4 py-2 bg-surface-container-highest text-on-surface font-body text-sm rounded-lg hover:bg-outline-variant transition-all border-none cursor-pointer">
              Corridor Emergency
            </button>
            <button className="px-4 py-2 bg-surface-container-highest text-on-surface-variant font-body text-sm rounded-lg opacity-60 border-none cursor-not-allowed">
              High-Rise Fire
            </button>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-surface-container-lowest rounded-full p-1 gap-1 border border-outline-variant/30">
          <button
            onClick={isRunning ? onPause : onStart}
            disabled={!isConnected}
            className={`p-3 rounded-full transition-all flex items-center justify-center border-none ${
              !isConnected
                ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                : isRunning
                ? 'text-secondary hover:bg-secondary/10 cursor-pointer'
                : 'text-primary hover:bg-primary/10 cursor-pointer'
            }`}
            aria-label={isRunning ? t.controls.pause : t.controls.play}
            title={!isConnected ? 'SUMO Disconnected' : isRunning ? 'Pause Simulation' : 'Start SUMO Simulation'}
          >
            <span className="material-symbols-outlined">
              {isRunning ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button
            onClick={onReset}
            disabled={!isConnected}
            className={`p-3 rounded-full transition-all flex items-center justify-center border-none bg-transparent ${
              !isConnected ? 'opacity-40 cursor-not-allowed text-on-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant cursor-pointer'
            }`}
            aria-label={t.controls.reset}
            title={!isConnected ? 'SUMO Disconnected' : 'Reset Simulation to READY State'}
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
              key={s}
              onClick={() => onSpeedChange(s)}
              disabled={!isConnected}
              className={`px-3 py-1.5 rounded-lg font-data text-xs font-semibold transition-all border-none ${
                !isConnected
                  ? 'bg-surface-container-highest text-on-surface-variant opacity-40 cursor-not-allowed'
                  : speed === s
                  ? 'bg-primary text-on-primary shadow-sm cursor-pointer'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high cursor-pointer'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Start Emergency Button */}
      <div className="flex items-center gap-[var(--spacing-gutter)]">
        <button
          onClick={onStart}
          disabled={!isConnected}
          className={`flex items-center gap-2 px-6 py-3 font-headline font-semibold text-sm rounded-xl transition-all uppercase tracking-wider border-none shadow-lg ${
            isConnected
              ? 'bg-error-container text-on-error-container hover:brightness-110 cursor-pointer'
              : 'bg-surface-container-highest text-on-surface-variant opacity-40 cursor-not-allowed'
          }`}
        >
          <span className="material-symbols-outlined">warning</span>
          {t.simulation.startEmergency}
        </button>
      </div>
    </footer>
  );
}
