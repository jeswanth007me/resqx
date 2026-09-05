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
    <footer className="w-full bg-[#111111] border-t border-[#242424] px-4 py-2.5 flex items-center justify-between z-40 select-none">
      {/* Scenario Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] font-bold text-[#737373] uppercase tracking-wider">
            ACTIVE SCENARIO
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="px-2.5 py-1 bg-[#171717] border border-[#2a2a2a] text-[#F5F5F5] font-mono text-[11px] font-bold rounded">
              Route 4A Corridor Emergency
            </span>
          </div>
        </div>
      </div>

      {/* Playback & Speed Controls */}
      <div className="flex items-center gap-4">
        {/* Play / Pause & Reset */}
        <div className="flex items-center bg-[#171717] rounded p-1 gap-1 border border-[#242424]">
          <button
            type="button"
            onClick={isRunning ? onPause : onStart}
            className={`px-3 py-1 rounded font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isRunning
                ? 'bg-[#38a169]/15 text-[#38a169] border border-[#38a169]/30'
                : 'bg-[#d04848] text-white hover:bg-[#e15252] border border-[#e15252]'
            }`}
            title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isRunning ? 'pause' : 'play_arrow'}
            </span>
            {isRunning ? 'PAUSE' : 'RUN'}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="p-1 px-2 rounded font-mono text-[11px] text-[#737373] hover:text-[#F5F5F5] hover:bg-[#222222] transition-colors cursor-pointer flex items-center gap-1 border border-transparent"
            title="Reset Simulation to Initial State"
          >
            <span className="material-symbols-outlined text-[14px]">replay</span>
            RESET
          </button>
        </div>

        {/* Speed Multiplier Toggles */}
        <div className="flex items-center gap-1.5 bg-[#171717] p-1 rounded border border-[#242424]">
          <span className="font-mono text-[9px] text-[#737373] uppercase px-1 font-bold">
            SPEED:
          </span>
          {([1, 2, 5] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                speed === s
                  ? 'bg-[#262626] text-[#F5F5F5] border border-[#383838]'
                  : 'text-[#737373] hover:text-[#F5F5F5] border border-transparent'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* SUMO Live Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded bg-[#171717] border border-[#242424] font-mono text-[10px]">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#38a169] animate-pulse' : 'bg-[#d97706]'}`} />
          <span className="text-[#A3A3A3] font-medium">
            {isConnected ? 'TraCI REALTIME FEED' : 'STANDBY MODE'}
          </span>
        </div>
      </div>

      {/* Emergency Priority Trigger Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="flex items-center gap-2 px-4 py-2 font-mono font-bold text-[11px] rounded transition-all uppercase tracking-wider shadow-sm bg-[#d04848] text-white hover:bg-[#e15252] border border-[#e15252] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">warning</span>
          {isRunning ? 'CORRIDOR ACTIVE' : t.simulation.startEmergency}
        </button>
      </div>
    </footer>
  );
}
