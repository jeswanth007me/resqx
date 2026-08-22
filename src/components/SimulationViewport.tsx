import { CityMap } from './CityMap';
import type { SimulationState } from '../types/simulation';

interface SimulationViewportProps {
  state: SimulationState;
}

/**
 * SimulationViewport — Displays the live city map visualization of the simulation.
 */
export function SimulationViewport({ state }: SimulationViewportProps) {
  return (
    <div className="flex-1 relative bg-surface-container-low overflow-hidden rounded-2xl shadow-inner border border-surface-container-highest flex items-center justify-center">
      {/* Decorative background grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-on-surface) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-on-surface) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Render the actual live city map */}
      <div className="w-full h-full max-w-[550px] max-h-[550px] p-4 flex items-center justify-center z-10">
        <CityMap
          roads={state.roads}
          signals={state.signals}
          vehicles={state.vehicles}
          ambulance={state.ambulance}
        />
      </div>

      {/* Top overlay — scenario badge */}
      <div className="absolute top-4 left-4 bg-surface-container/80 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 z-20">
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-secondary animate-pulse' : 'bg-primary'}`} />
        <span className="font-data text-[12px] font-semibold text-on-surface tracking-wider">
          {state.scenario}
        </span>
      </div>

      {/* Bottom overlay — map controls */}
      <div className="absolute bottom-4 left-4 flex gap-2 z-20">
        <button className="w-9 h-9 bg-surface-container-high/80 backdrop-blur-md rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">zoom_in</span>
        </button>
        <button className="w-9 h-9 bg-surface-container-high/80 backdrop-blur-md rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">zoom_out</span>
        </button>
        <button className="w-9 h-9 bg-surface-container-high/80 backdrop-blur-md rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors cursor-pointer ml-1">
          <span className="material-symbols-outlined text-[18px]">my_location</span>
        </button>
      </div>
    </div>
  );
}
