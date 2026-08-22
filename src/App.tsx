import { useState } from 'react';
import { useResQXTelemetry } from './telemetry/useResQXTelemetry';
import { sirenAudio } from './utils/sirenAudio';
import { AppHeader } from './components/AppHeader';
import { SimulationViewport } from './components/SimulationViewport';
import { EmergencyPanel } from './components/EmergencyPanel';
import { SimulationControls } from './components/SimulationControls';

function App() {
  const { telemetry, connectionStatus, sendControl } = useResQXTelemetry();
  const [activeTab, setActiveTab] = useState('simulation');

  const isConnected = connectionStatus === 'CONNECTED';
  const simulationTime = telemetry ? telemetry.simulation.elapsedTime : 0;
  const isRunning = telemetry ? telemetry.simulation.running : false;
  const simSpeed = (telemetry?.simulation.speed as 1 | 2 | 5) ?? 1;

  const handleStart = async () => {
    // User click gesture initializes/resumes AudioContext synchronously
    await sirenAudio.handleUserGesture();
    sirenAudio.setMuted(false);
    sirenAudio.startSiren();
    sendControl('start');
  };

  const handlePause = () => {
    sirenAudio.stopSiren();
    sendControl('pause');
  };

  const handleReset = () => {
    sirenAudio.stopSiren();
    sendControl('reset');
  };

  const handleSpeedChange = (speed: 1 | 2 | 5) => {
    sendControl('speed', speed);
  };

  return (
    <div className="w-full min-h-screen bg-surface font-body text-on-surface">
      <AppHeader
        activeTab={activeTab}
        simulationTime={simulationTime}
        connectionStatus={connectionStatus}
        onTabChange={setActiveTab}
      />

      <main className="w-full pt-16 pb-20 bg-surface min-h-screen">
        <div className="flex flex-col w-full h-[calc(100vh-144px)]">
          <div className="flex flex-1 h-full p-[var(--spacing-gutter)] gap-[var(--spacing-gutter)] overflow-hidden">
            {/* LEFT / CENTER: Live City Traffic Simulation Viewport */}
            <SimulationViewport
              telemetry={telemetry}
              connectionStatus={connectionStatus}
            />

            {/* RIGHT: ResQX Emergency Operational Sidebar */}
            <EmergencyPanel
              telemetry={telemetry}
              connectionStatus={connectionStatus}
            />
          </div>
        </div>
      </main>

      {/* BOTTOM: Simulation controls */}
      <SimulationControls
        isRunning={isRunning}
        speed={simSpeed}
        isConnected={isConnected}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
      />
    </div>
  );
}

export default App;
