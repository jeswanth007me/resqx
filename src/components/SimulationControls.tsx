import { useLocale } from '../i18n/useLocale';

interface SimulationControlsProps {
  isRunning: boolean;
  speed: 1 | 2 | 5;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: 1 | 2 | 5) => void;
  onEmergencyStart: () => void;
  onScenarioChange: (scenario: string) => void;
}

export function SimulationControls({
  isRunning,
  speed,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
  onEmergencyStart,
  onScenarioChange,
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
              onClick={() => onScenarioChange('HIGH-RISE FIRE')}
              className="px-4 py-2 bg-surface-container-highest text-on-surface font-body text-sm rounded-lg hover:bg-outline-variant transition-all border-none cursor-pointer"
            >
              {t.scenarios.highRiseFire}
            </button>

            <button
              type="button"
              onClick={() => onScenarioChange('FLOOD RESPONSE')}
              className="px-4 py-2 bg-surface-container-highest text-on-surface font-body text-sm rounded-lg hover:bg-outline-variant transition-all border-none cursor-pointer"
            >
              {t.scenarios.floodResponse}
            </button>

            <button
              type="button"
              onClick={() => onScenarioChange('CUSTOM')}
              className="px-4 py-2 border border-primary text-primary font-body text-sm rounded-lg hover:bg-primary hover:text-on-primary transition-all bg-transparent cursor-pointer"
            >
              {t.scenarios.custom}
            </button>

          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-4">

        <div className="flex items-center bg-surface-container-lowest rounded-full p-1 gap-1">

          <button
            type="button"
            onClick={isRunning ? onPause : onStart}
            className="p-3 text-secondary hover:bg-secondary/10 rounded-full transition-all flex items-center justify-center border-none bg-transparent cursor-pointer"
            aria-label={isRunning ? t.controls.pause : t.controls.play}
          >
            <span className="material-symbols-outlined">
              {isRunning ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="p-3 text-on-surface-variant hover:bg-surface-variant rounded-full transition-all flex items-center justify-center border-none bg-transparent cursor-pointer"
            aria-label={t.controls.reset}
          >
            <span className="material-symbols-outlined">
              replay
            </span>
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
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {s}x
            </button>
          ))}

        </div>
      </div>

      {/* Start Emergency */}
      <div className="flex items-center gap-[var(--spacing-gutter)]">

        <button
          type="button"
          onClick={onEmergencyStart}
          className="flex items-center gap-2 px-6 py-3 bg-error-container text-on-error-container font-headline font-semibold text-sm rounded-xl hover:brightness-110 transition-all uppercase tracking-wider border-none cursor-pointer"
        >
          <span className="material-symbols-outlined">
            warning
          </span>

          {t.simulation.startEmergency}
        </button>

      </div>

    </footer>
  );
}