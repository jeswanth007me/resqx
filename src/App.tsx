import { useState, useMemo } from 'react';
import { useSimulation } from './state/useSimulation';
import { AppHeader } from './components/AppHeader';
import { SimulationViewport } from './components/SimulationViewport';
import { EmergencyPanel } from './components/EmergencyPanel';
import { SimulationControls } from './components/SimulationControls';
import { buildTelemetry } from './telemetry/buildTelemetry';
import { decisionEngine } from './ai/decisionEngine';

function App() {
  const { state, dispatch } = useSimulation();
  const [activeTab, setActiveTab] = useState('simulation');
  const [dismissedRecId, setDismissedRecId] = useState<string | null>(null);

  // Generate live telemetry from simulation state
  const telemetry = useMemo(() => buildTelemetry(state), [state]);

  // Compute recommendation from live telemetry
  const recommendation = useMemo(() => {
    let rec = decisionEngine(telemetry);
    if (dismissedRecId && rec.id.startsWith(dismissedRecId.split('-')[1])) {
      // If the current recommendation is dismissed, fallback to monitoring state
      rec = {
        id: `rec-dismissed-${rec.timestamp}`,
        recommendation: 'Monitoring traffic network',
        reason: 'Override recommendation dismissed by operator. Monitoring corridor status.',
        confidence: 100,
        action: 'DISMISS',
        timestamp: rec.timestamp,
      };
    }
    return rec;
  }, [telemetry, dismissedRecId]);

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
            <SimulationViewport state={state} />

            {/* RIGHT: Emergency control panel */}
            <EmergencyPanel
              telemetry={telemetry}
              recommendation={recommendation}
              onExecuteRecommendation={() => {
                if (recommendation.targetSignal && recommendation.action === 'EXECUTE_OVERRIDE') {
                  dispatch({
                    type: 'OVERRIDE_SIGNAL',
                    signalId: recommendation.targetSignal,
                    state: 'EMERGENCY_PRIORITY',
                  });
                }
              }}
              onDismissRecommendation={() => {
                // Store recommendation type prefix to identify it even with changing timestamps
                const typePrefix = recommendation.id.split('-')[0] + '-' + recommendation.id.split('-')[1];
                setDismissedRecId(typePrefix);
              }}
            />
          </div>
        </div>
      </main>

      {/* BOTTOM: Simulation controls */}
      <SimulationControls
        isRunning={state.isRunning}
        speed={state.speed}
        onStart={() => dispatch({ type: 'START' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onReset={() => {
          dispatch({ type: 'RESET' });
          setDismissedRecId(null);
        }}
        onSpeedChange={(speed) => dispatch({ type: 'SPEED', speed })}
      />
    </div>
  );
}

export default App;
