import { Play, Pause, RefreshCw, AlertTriangle } from 'lucide-react';
import { useLocale } from '../i18n/useLocale';
import { Button } from './ui/button';

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
    <footer className="w-full bg-gray-950/95 border-t border-gray-800 px-4 py-2.5 flex items-center justify-between z-40 select-none font-mono">
      {/* Active Corridor Scenario Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            Active Mission Scenario
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="px-2.5 py-0.5 bg-gray-900 border border-gray-800 text-gray-200 text-[11px] font-bold rounded">
              Route 4A Hospital Arterial (4 Cascade Junctions)
            </span>
          </div>
        </div>
      </div>

      {/* Playback & Speed Controls */}
      <div className="flex items-center gap-4">
        {/* Play / Pause & Reset */}
        <div className="flex items-center bg-gray-900 rounded p-1 gap-1.5 border border-gray-800">
          <Button
            size="sm"
            onClick={isRunning ? onPause : onStart}
            className={`h-7 px-3 text-[11px] font-bold ${
              isRunning
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500'
            }`}
            title={isRunning ? 'Pause Corridor Simulation' : 'Start Corridor Simulation'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? 'PAUSE' : 'RUN CORRIDOR'}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-7 px-2.5 text-[11px] text-gray-400 hover:text-gray-100"
            title="Reset Simulation to Initial State"
          >
            <RefreshCw className="w-3 h-3" />
            <span>RESET</span>
          </Button>
        </div>

        {/* Speed Multiplier Toggles */}
        <div className="flex items-center gap-1 bg-gray-900 p-1 rounded border border-gray-800 text-[11px]">
          <span className="text-[9px] text-gray-500 uppercase px-1 font-bold">
            SPEED:
          </span>
          {([1, 2, 5] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                speed === s
                  ? 'bg-gray-800 text-gray-100 border border-gray-700'
                  : 'text-gray-500 hover:text-gray-200 border border-transparent'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* SUMO Live Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded bg-gray-900 border border-gray-800 text-[10px]">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-gray-400 font-medium">
            {isConnected ? 'TraCI HARD SYNC ONLINE' : 'SIMULATOR STANDBY'}
          </span>
        </div>
      </div>

      {/* Emergency Priority Trigger Button */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={isRunning ? undefined : onStart}
          className={`h-8 px-3.5 text-xs font-bold tracking-wider uppercase ${
            isRunning
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/60'
              : 'bg-red-600 text-white hover:bg-red-500 border-red-500'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{isRunning ? 'CORRIDOR ACTIVE' : t.simulation.startEmergency}</span>
        </Button>
      </div>
    </footer>
  );
}
