import { useState } from 'react';
import { useSimulation } from './state/useSimulation';
import { AppHeader } from './components/AppHeader';
import { SimulationViewport } from './components/SimulationViewport';
import { EmergencyPanel } from './components/EmergencyPanel';
import { SimulationControls } from './components/SimulationControls';

function App() {
  const { state, dispatch } = useSimulation();
  const [activeTab, setActiveTab] = useState('simulation');

  const handleEmergencyStart = () => {
    dispatch({
      type: 'EMERGENCY_START',
    });
  };

  const handleScenarioChange = (scenario: string) => {
    dispatch({
      type: 'SCENARIO',
      scenario,
    });
  };

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

            <SimulationViewport />

            <EmergencyPanel />

          </div>

        </div>

      </main>

      <SimulationControls
        isRunning={state.isRunning}
        speed={state.speed}
        onStart={() =>
          dispatch({
            type: 'START',
          })
        }
        onPause={() =>
          dispatch({
            type: 'PAUSE',
          })
        }
        onReset={() =>
          dispatch({
            type: 'RESET',
          })
        }
        onSpeedChange={(speed) =>
          dispatch({
            type: 'SPEED',
            speed,
          })
        }
        onEmergencyStart={handleEmergencyStart}
        onScenarioChange={handleScenarioChange}
      />

    </div>
  );
}

export default App;