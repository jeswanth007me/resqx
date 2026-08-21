/**
 * SimulationViewport — Placeholder for the future simulation map.
 *
 * This component will later be owned by the Simulation Engineer.
 * For now it renders a professional placeholder indicating the
 * simulation viewport area.
 */

export function SimulationViewport() {
  return (
    <div className="flex-1 relative bg-surface-container-low overflow-hidden rounded-2xl shadow-inner border border-surface-container-highest">
      {/* Decorative background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-on-surface) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-on-surface) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Decorative glow effects */}
      <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-48 h-48 bg-secondary/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10">
        {/* Animated ring */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-surface-container-highest" />
          <div
            className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
            style={{ animation: 'spin 3s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-primary/60">hub</span>
          </div>
        </div>

        <div className="text-center">
          <h2 className="font-headline text-xl font-bold text-on-surface tracking-wide mb-2">
            RESQX SIMULATION
          </h2>
          <p className="font-data text-sm text-on-surface-variant tracking-widest uppercase">
            City Network Initializing
          </p>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-6 mt-4">
          {['Road Network', 'Signal Nodes', 'Vehicle Fleet'].map((label) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary/40 animate-pulse" />
              <span className="font-data text-[10px] text-on-surface-variant uppercase tracking-wider">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top overlay — scenario badge */}
      <div className="absolute top-4 left-4 bg-surface-container/80 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 z-20">
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <span className="font-data text-[12px] font-semibold text-on-surface tracking-wider">
          AWAITING SCENARIO
        </span>
      </div>

      {/* Bottom overlay — map controls placeholder */}
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

      {/* Spinning animation keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
