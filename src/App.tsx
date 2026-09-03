import { useState, useMemo, useEffect, useRef } from 'react';
import { useResQXTelemetry } from './telemetry/useResQXTelemetry';
import { sirenAudio } from './utils/sirenAudio';
import { AppHeader } from './components/AppHeader';
import { SimulationViewport } from './components/SimulationViewport';
import { EmergencyPanel } from './components/EmergencyPanel';
import { SimulationControls } from './components/SimulationControls';
import { decisionEngine } from './ai/decisionEngine';
import { getDefaultCityGraph } from './routing/graph';
import { calculateAmbulanceRoute } from './routing/engine';
import { calculateAmbulanceEta } from './routing/eta';
import { planEmergencyCorridor } from './routing/corridor';
import { validateCorridorPlan } from './safety/validator';
import { executeValidatedControl } from './controllers/signalController';
import type { EmergencyEvent } from './types/events';

interface TransitionTracker {
  emergencyDetected: boolean;
  lastDecisionAction: string;
  lastDecisionSignal: string;
  lastSafetyDecision: string;
  signalPhases: Record<string, string>;
  arrived: boolean;
}

function App() {
  const { telemetry, connectionStatus, sendControl, overrideSignal } = useResQXTelemetry();
  const [activeTab, setActiveTab] = useState('simulation');
  const [dismissedRecId, setDismissedRecId] = useState<string | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<EmergencyEvent[]>([]);

  // Static Route Memoization (Zero UI Lag)
  const staticRoute = useMemo(() => {
    return calculateAmbulanceRoute(getDefaultCityGraph());
  }, []);

  // State Transition Tracker Ref (Strictly prevents per-tick duplicate event flooding)
  const transitionTrackerRef = useRef<TransitionTracker>({
    emergencyDetected: false,
    lastDecisionAction: '',
    lastDecisionSignal: '',
    lastSafetyDecision: '',
    signalPhases: {},
    arrived: false,
  });

  // 1. Canonical AI Decision Engine
  const recommendation = useMemo(() => {
    let rec = decisionEngine(telemetry);
    if (dismissedRecId && rec.id.startsWith(dismissedRecId.split('-')[1])) {
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

  // 2. Predictive Corridor Planning & Canonical Safety Validation Gate
  const { safetyValidation } = useMemo(() => {
    if (!telemetry) return { safetyValidation: null };
    const amb = telemetry.ambulance;
    const eta = calculateAmbulanceEta({
      routeResult: staticRoute,
      ambulance: {
        speedKmh: amb?.speedKmh ?? 50,
        currentRoadId: amb?.currentRoad ?? 'ROAD-01',
        progressOnCurrentRoad: 0,
        status: amb?.status ?? 'EN_ROUTE',
      },
      signals: [
        { id: 'SIG-01', name: 'North Corridor Signal', road: 'ROAD-01' },
        { id: 'SIG-03', name: 'Central Junction Signal', road: 'ROAD-03' },
      ],
    });
    const corridor = planEmergencyCorridor(eta);
    const val = validateCorridorPlan(corridor);
    return { safetyValidation: val };
  }, [telemetry, staticRoute]);

  const isConnected = connectionStatus === 'CONNECTED';
  const simulationTime = telemetry ? telemetry.simulation.elapsedTime : 0;
  const isRunning = telemetry ? telemetry.simulation.running : false;
  const simSpeed = (telemetry?.simulation.speed as 1 | 2 | 5) ?? 1;

  // 3. Canonical Runtime Pipeline & Transition-Based Audit Logging
  useEffect(() => {
    if (!telemetry || !isRunning) return;

    const tTime = telemetry.simulation.elapsedTime;
    const amb = telemetry.ambulance;
    const tracker = transitionTrackerRef.current;
    const newEvents: EmergencyEvent[] = [];

    // Phase 1 Transition: Emergency Mission Started
    if (amb.status === 'EN_ROUTE' && !tracker.emergencyDetected) {
      tracker.emergencyDetected = true;
      newEvents.push({
        id: `evt-emergency-start-${tTime}`,
        timestamp: tTime,
        type: 'EMERGENCY_DETECTED',
        description: `🚨 Emergency dispatch activated: AMB-01 en route to ${telemetry.mission.destination}`,
        severity: 'CRITICAL',
        relatedUnit: 'AMB-01',
      });
    }

    // Phase 2 Transition: Decision Engine State Change
    const currentAction = recommendation.action ?? '';
    const currentTargetSignal = recommendation.targetSignal ?? '';
    if (
      currentAction !== tracker.lastDecisionAction ||
      currentTargetSignal !== tracker.lastDecisionSignal
    ) {
      tracker.lastDecisionAction = currentAction;
      tracker.lastDecisionSignal = currentTargetSignal;

      if (recommendation.action === 'EXECUTE_OVERRIDE' && recommendation.targetSignal) {
        newEvents.push({
          id: `evt-decision-${recommendation.targetSignal}-${tTime}`,
          timestamp: tTime,
          type: 'AI_RECOMMENDATION',
          description: `🧠 AI Decision: ${recommendation.recommendation} (${recommendation.confidence}% confidence)`,
          severity: 'WARNING',
          relatedSignal: recommendation.targetSignal,
          relatedUnit: 'AMB-01',
        });
      }
    }

    // Phase 3 Transition: Safety Validator Gate & Signal Controller Execution
    if (safetyValidation) {
      if (safetyValidation.decision !== tracker.lastSafetyDecision) {
        tracker.lastSafetyDecision = safetyValidation.decision;

        if (safetyValidation.decision === 'APPROVED') {
          newEvents.push({
            id: `evt-safety-appr-${tTime}`,
            timestamp: tTime,
            type: 'SAFETY_APPROVED',
            description: `🛡️ Safety Gate APPROVED: All 5 corridor constraints verified (${safetyValidation.approvedCommands.length} signals)`,
            severity: 'SUCCESS',
            relatedUnit: 'AMB-01',
          });

          // Dispatch approved signal commands
          executeValidatedControl(safetyValidation, {
            onLocalSignalChange: (sigId, phase, pat) => overrideSignal(sigId, phase, pat),
          });
        } else if (safetyValidation.decision === 'BLOCKED') {
          newEvents.push({
            id: `evt-safety-block-${tTime}`,
            timestamp: tTime,
            type: 'SAFETY_BLOCKED',
            description: `🛡️ Safety Gate BLOCKED: ${safetyValidation.safetySummary}`,
            severity: 'CRITICAL',
            relatedUnit: 'AMB-01',
          });
        }
      }
    }

    // Phase 4 Transition: Signal Phase Progression Audit
    for (const s of telemetry.signals) {
      const prevPhase = tracker.signalPhases[s.id] ?? 'NORMAL';
      if (s.emergencyState !== prevPhase) {
        tracker.signalPhases[s.id] = s.emergencyState;

        if (s.emergencyState === 'PREPARING') {
          newEvents.push({
            id: `evt-sig-prep-${s.id}-${tTime}`,
            timestamp: tTime,
            type: 'SIGNAL_PREPARING',
            description: `🟡 ${s.id}: Preparing clearance & pedestrian lockout`,
            severity: 'WARNING',
            relatedSignal: s.id,
          });
        } else if (s.emergencyState === 'EMERGENCY PRIORITY' || (s.emergencyState as string) === 'PRIORITY') {
          newEvents.push({
            id: `evt-sig-prio-${s.id}-${tTime}`,
            timestamp: tTime,
            type: 'SIGNAL_PRIORITY_EXECUTED',
            description: `🟢 ${s.id}: Emergency Green Wave PRIORITY active`,
            severity: 'SUCCESS',
            relatedSignal: s.id,
          });
        } else if (s.emergencyState === 'RESTORED' || (s.emergencyState as string) === 'RESTORING') {
          newEvents.push({
            id: `evt-sig-rest-${s.id}-${tTime}`,
            timestamp: tTime,
            type: 'SIGNAL_RESTORED',
            description: `🔵 ${s.id}: Post-passage clearance; restoring normal cycle`,
            severity: 'INFO',
            relatedSignal: s.id,
          });
        }
      }
    }

    // Phase 5 Transition: Mission Arrived
    if (amb.status === 'ARRIVED' && !tracker.arrived) {
      tracker.arrived = true;
      newEvents.push({
        id: `evt-mission-arr-${tTime}`,
        timestamp: tTime,
        type: 'MISSION_COMPLETE',
        description: `🏁 AMB-01 arrived at ${telemetry.mission.destination}. Time Saved: ${telemetry.mission.timeSaved}s`,
        severity: 'SUCCESS',
        relatedUnit: 'AMB-01',
      });
    }

    if (newEvents.length > 0) {
      setPipelineEvents((prev) => [...newEvents, ...prev]);
    }
  }, [telemetry, isRunning, recommendation, safetyValidation, overrideSignal]);

  const handleStart = async () => {
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
    setDismissedRecId(null);
    transitionTrackerRef.current = {
      emergencyDetected: false,
      lastDecisionAction: '',
      lastDecisionSignal: '',
      lastSafetyDecision: '',
      signalPhases: {},
      arrived: false,
    };
    setPipelineEvents([]);
  };

  const handleSpeedChange = (speed: 1 | 2 | 5) => {
    sendControl('speed', speed);
  };

  const handleExecuteRecommendation = async () => {
    if (!safetyValidation) return;
    if (safetyValidation.decision === 'APPROVED') {
      await executeValidatedControl(safetyValidation, {
        onLocalSignalChange: (sigId, phase, pat) => overrideSignal(sigId, phase, pat),
      });
      setPipelineEvents((prev) => [
        {
          id: `evt-manual-${Date.now()}`,
          timestamp: telemetry?.simulation.elapsedTime ?? 0,
          type: 'OPERATOR_OVERRIDE_EXECUTED',
          description: `Operator Executed Override for ${recommendation.targetSignal || 'corridor'} (Safety Approved)`,
          severity: 'SUCCESS',
          relatedSignal: recommendation.targetSignal || undefined,
        },
        ...prev,
      ]);
    } else {
      setPipelineEvents((prev) => [
        {
          id: `evt-manual-blocked-${Date.now()}`,
          timestamp: telemetry?.simulation.elapsedTime ?? 0,
          type: 'OPERATOR_OVERRIDE_BLOCKED',
          description: `Cannot Execute: Safety Validator Rejected (${safetyValidation.safetySummary})`,
          severity: 'CRITICAL',
          relatedSignal: recommendation.targetSignal || undefined,
        },
        ...prev,
      ]);
    }
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
            {/* LEFT / CENTER: Live City Traffic Simulation Viewport (3D Digital Twin & 2D Tactical View) */}
            <SimulationViewport
              telemetry={telemetry}
              connectionStatus={connectionStatus}
            />

            {/* RIGHT: ResQX Emergency Operational Sidebar & AI Recommendation Card */}
            <EmergencyPanel
              telemetry={telemetry}
              connectionStatus={connectionStatus}
              recommendation={recommendation}
              events={pipelineEvents}
              onExecuteRecommendation={handleExecuteRecommendation}
              onDismissRecommendation={() => {
                const typePrefix = recommendation.id.split('-')[0] + '-' + recommendation.id.split('-')[1];
                setDismissedRecId(typePrefix);
              }}
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
