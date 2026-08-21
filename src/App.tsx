import { useState } from 'react';
import { useSimulation } from './state/useSimulation';
import { AppHeader } from './components/AppHeader';
import { SimulationViewport } from './components/SimulationViewport';
import { EmergencyPanel } from './components/EmergencyPanel';
import { SimulationControls } from './components/SimulationControls';

function App() {
  const { state, dispatch } = useSimulation();
  const [activeTab, setActiveTab] = useState('simulation');

  return (
    <div className="w-full min-h-screen bg-surface font-body text-on-surface">
      <AppHeader
        activeTab={activeTab}
        simulationTime={state.simulationTime}
        onTabChange={setActiveTab}
      />

      <main className="w-full pt-16 pb-20 bg-surface min-h-screen">
        <div className="flex flex-col w-full h-[calc(100vh-144px)]">
          <div className="flex flex-1 h-full p-[var(--spacing-gutter)] gap-[var(--spacing-gutter)] overflow-hidden">
            {/* LEFT / CENTER: Large simulation viewport */}
            <SimulationViewport />

            {/* RIGHT: Emergency control panel */}
            <EmergencyPanel />
          </div>
        </div>
      </main>

      {/* BOTTOM: Simulation controls */}
      <SimulationControls
        isRunning={state.isRunning}
        speed={state.speed}
        onStart={() => dispatch({ type: 'START' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onReset={() => dispatch({ type: 'RESET' })}
        onSpeedChange={(speed) => dispatch({ type: 'SPEED', speed })}
      />
    </div>
  );
}

export default App;
