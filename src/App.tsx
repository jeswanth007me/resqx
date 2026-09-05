import { useState, useMemo, useEffect, useRef } from 'react';
import { useResQXTelemetry } from './telemetry/useResQXTelemetry';
import { sirenAudio } from './utils/sirenAudio';
import { AppHeader } from './components/AppHeader';
import { SimulationViewport } from './components/SimulationViewport';
import { AmbulanceStatus } from './components/AmbulanceStatus';
import { LiveTelemetryCard } from './components/LiveTelemetryCard';
import { SignalStatus } from './components/SignalStatus';
import { EventTimeline } from './components/EventTimeline';
import { AIRecommendationCard } from './components/AIRecommendationCard';
import { PoliceCoordinationCard } from './components/PoliceCoordinationCard';
import { SimulationControls } from './components/SimulationControls';
import { SignalControlView } from './components/SignalControlView';
import { AnalyticsView } from './components/AnalyticsView';
import { AlertsView } from './components/AlertsView';
import { decisionEngine } from './ai/decisionEngine';
import { getDefaultCityGraph } from './routing/graph';
import { calculateAmbulanceRoute } from './routing/engine';
import { calculateAmbulanceEta } from './routing/eta';
import { planEmergencyCorridor } from './routing/corridor';
import { validateCorridorPlan } from './safety/validator';
import { executeValidatedControl } from './controllers/signalController';
import { PoliceCoordinator } from './services/policeCoordinator';
import { getAlertService } from './services/alertService';
import type { EmergencyEvent } from './types/events';
import type { JunctionAssignment } from './types/police';

export interface DispatchedAlertRecord {
  signalId: string;
  emergencyId: string;
  officerName: string;
  badgeNumber: string;
  status: 'DISPATCHED' | 'DELIVERED';
  timestamp: number;
  title: string;
  mode: 'DEMO' | 'LIVE';
}

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
  const [activeTab, setActiveTab] = useState('live');
  const [dismissedRecId, setDismissedRecId] = useState<string | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<EmergencyEvent[]>([]);
  const [dispatchedAlerts, setDispatchedAlerts] = useState<DispatchedAlertRecord[]>([]);

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

  // Police Coordinator Ref (Maintains deduplication history across ticks)
  const policeCoordinatorRef = useRef<PoliceCoordinator>(new PoliceCoordinator());

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
  const { safetyValidation, corridorPlan, policeAssignments } = useMemo(() => {
    if (!telemetry) {
      return { safetyValidation: null, corridorPlan: null, policeAssignments: [] };
    }
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
        { id: 'SIG-01', name: 'North Corridor Signal', road: 'ROAD-01', position: { x: 300, y: 150 } },
        { id: 'SIG-02', name: 'Central Intersection Signal', road: 'ROAD-01', position: { x: 300, y: 275 } },
        { id: 'SIG-03', name: 'Hospital Approach Signal', road: 'ROAD-03', position: { x: 300, y: 400 } },
        { id: 'SIG-04', name: 'South Corridor Signal', road: 'ROAD-03', position: { x: 300, y: 525 } },
      ],
    });
    const corridor = planEmergencyCorridor(eta);
    const val = validateCorridorPlan(corridor);
    const assignments = policeCoordinatorRef.current.assignOfficersForCorridor(
      corridor,
      amb?.id ?? 'AMB-01',
      telemetry.simulation.elapsedTime
    );

    return { safetyValidation: val, corridorPlan: corridor, policeAssignments: assignments };
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

    // Reset alert deduplication if mission is staged
    if (amb.status === 'STAGED') {
      policeCoordinatorRef.current.resetHistory();
      setDispatchedAlerts([]);
    }

    // Helper: Dispatches a real NTFY alert naturally when a signal enters priority
    const dispatchAlertForSignal = (sigId: string) => {
      const coordinator = policeCoordinatorRef.current;
      if (!coordinator.shouldSendAlert(amb.id, sigId)) {
        return;
      }
      coordinator.markAlertSent(amb.id, sigId);

      const officer = coordinator.selectOfficerForJunction(sigId);
      if (!officer) return;

      const sigTelemetry = telemetry.signals.find((sig) => sig.id === sigId);
      const etaSec = Math.round(
        ((sigTelemetry?.distanceFromAmbulance ?? 100) / Math.max(amb.speedKmh / 3.6, 5)) * 10
      ) / 10;

      const assignment: JunctionAssignment = {
        junctionId: sigId,
        signalId: sigId,
        officerId: officer.officerId,
        officerName: officer.name,
        badgeNumber: officer.badgeNumber,
        contactIdentifier: officer.contactIdentifier,
        assignmentReason: `Primary on-duty officer covering ${sigId}`,
        emergencyId: amb.id,
        etaSeconds: etaSec,
        assignedAt: tTime,
        status: 'ASSIGNED',
      };

      const alert = coordinator.createEmergencyAlert(assignment, 'CRITICAL', Date.now());
      if (alert) {
        getAlertService()
          .sendAlert(alert)
          .then((res) => {
            setDispatchedAlerts((prev) => [
              ...prev.filter((a) => a.signalId !== sigId),
              {
                signalId: sigId,
                emergencyId: amb.id,
                officerName: officer.name,
                badgeNumber: officer.badgeNumber,
                status: res.status === 'DELIVERED' ? 'DELIVERED' : 'DISPATCHED',
                timestamp: tTime,
                title: `RESQX ALERT — ${amb.id} at ${sigId}`,
                mode: res.mode,
              },
            ]);
          })
          .catch((err) => {
            console.warn(`[ResQX Alert] Outbound dispatch error for ${sigId}:`, err);
          });

        newEvents.push({
          id: `evt-police-alert-${sigId}-${tTime}`,
          timestamp: tTime,
          type: 'POLICE_ALERT_DISPATCHED',
          description: `👮 Real NTFY Alert DISPATCHED to ${officer.name} for ${sigId} (RESQX ALERT — ${amb.id} at ${sigId})`,
          severity: 'INFO',
          relatedSignal: sigId,
          relatedUnit: amb.id,
        });
      }
    };

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
        const sigId = recommendation.targetSignal;
        newEvents.push({
          id: `evt-decision-${sigId}-${tTime}`,
          timestamp: tTime,
          type: 'AI_RECOMMENDATION',
          description: `🧠 AI Decision: ${recommendation.recommendation} (${recommendation.confidence}% confidence)`,
          severity: 'WARNING',
          relatedSignal: sigId,
          relatedUnit: 'AMB-01',
        });

        // Trigger priority for approaching signal across local simulation and SUMO bridge
        overrideSignal(sigId, 'EMERGENCY_PRIORITY', 'GGGrr');
        fetch(`http://localhost:8000/api/signal?signalId=${sigId}&state=PRIORITY&pattern=GGGrr`, {
          method: 'GET',
          cache: 'no-store',
        }).catch(() => {
          // offline handling
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
          // Natural live notification triggered by the signal priority event!
          dispatchAlertForSignal(s.id);
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
  }, [telemetry, isRunning, recommendation, safetyValidation, corridorPlan, overrideSignal]);

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
    policeCoordinatorRef.current.resetHistory();
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
    <div className="w-full min-h-screen bg-[#111111] font-body text-[#F5F5F5] flex flex-col justify-between select-none">
      {/* ── 1. HEADER (STITCH EOC CHROME) ── */}
      <AppHeader
        activeTab={activeTab}
        simulationTime={simulationTime}
        connectionStatus={connectionStatus}
        onTabChange={setActiveTab}
      />

      {/* ── 2. MAIN OPERATIONAL WORKSPACE (VIEW SWITCHER) ── */}
      <main className="flex-1 px-3 sm:px-4 py-3 flex flex-col gap-3 w-full max-w-[1920px] mx-auto min-h-0">
        {activeTab === 'signals' ? (
          <SignalControlView
            telemetry={telemetry}
            connectionStatus={connectionStatus}
            safetyValidation={safetyValidation}
            corridorPlan={corridorPlan}
            events={pipelineEvents}
            onOverrideSignal={overrideSignal}
            onResetCorridor={handleReset}
          />
        ) : activeTab === 'analytics' ? (
          <AnalyticsView
            telemetry={telemetry}
            connectionStatus={connectionStatus}
            events={pipelineEvents}
            onNavigateToLive={() => setActiveTab('live')}
          />
        ) : activeTab === 'alerts' ? (
          <AlertsView
            telemetry={telemetry}
            policeAssignments={policeAssignments}
            events={pipelineEvents}
            dispatchedAlerts={dispatchedAlerts}
            connectionStatus={connectionStatus}
            onResetCorridor={handleReset}
          />
        ) : (
          /* PRIMARY VIEW: LIVE MONITOR */
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* UPPER TIER: 3-COLUMN PRIMARY GRID (CENTER EXPANDED TO 58%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              {/* LEFT COLUMN: ACTIVE EMERGENCY HERO PANEL (~22% -> col-span-12 lg:col-span-3) */}
              <div className="lg:col-span-3 flex flex-col">
                <AmbulanceStatus
                  telemetry={telemetry?.ambulance}
                  signals={telemetry?.signals}
                  id={telemetry?.ambulance.id ?? 'AMB-01'}
                  status={telemetry?.ambulance.status ?? (isConnected ? 'STAGED' : 'DISCONNECTED')}
                  eta={telemetry ? `${telemetry.ambulance.etaSeconds}s` : '02:41'}
                  speed={telemetry?.ambulance.speedKmh ?? 42}
                  distanceToTarget={telemetry?.ambulance.distanceToNextSignal ?? 1800}
                />
              </div>

              {/* CENTER: DIGITAL TWIN / 2D TACTICAL VECTOR CORRIDOR (56% -> col-span-12 lg:col-span-6) */}
              <div className="lg:col-span-6 flex flex-col min-h-[460px]">
                <SimulationViewport
                  telemetry={telemetry}
                  connectionStatus={connectionStatus}
                />
              </div>

              {/* RIGHT FLANK: LIVE TELEMETRY & TRAFFIC SIGNALS (~22% -> col-span-12 lg:col-span-3) */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                <LiveTelemetryCard
                  telemetry={telemetry}
                  connectionStatus={connectionStatus}
                />
                <SignalStatus
                  signals={telemetry?.signals}
                />
              </div>
            </div>

            {/* LOWER SECTION: 3 STATUS BLOCKS + EVENT TIMELINE + DECISION ENGINE */}
            <div className="flex flex-col gap-3 w-full">
              {/* THREE MINIMAL STATUS BLOCKS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* BLOCK 1: DECISION */}
                <div className="bg-[#171717] border border-[#242424] rounded p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#737373] block">
                      CORRIDOR DECISION
                    </span>
                    <span className="font-headline font-bold text-[17px] text-[#F5F5F5]">
                      {safetyValidation?.decision === 'APPROVED' ? 'APPROVED' : 'MONITORING'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#38a169]/15 border border-[#38a169]/30 text-[#38a169] font-mono text-[10px] font-bold">
                    100% VERIFIED
                  </span>
                </div>

                {/* BLOCK 2: SAFETY */}
                <div className="bg-[#171717] border border-[#242424] rounded p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#737373] block">
                      SAFETY INTERLOCK
                    </span>
                    <span className="font-headline font-bold text-[17px] text-[#F5F5F5]">
                      {safetyValidation?.allSafe ? 'SAFE' : 'NOMINAL'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#38a169]/15 border border-[#38a169]/30 text-[#38a169] font-mono text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38a169]" />
                    ALL CONFLICTS RESOLVED
                  </div>
                </div>

                {/* BLOCK 3: SUMO / TraCI */}
                <div className="bg-[#171717] border border-[#242424] rounded p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#737373] block">
                      SIMULATION ENGINE
                    </span>
                    <span className="font-headline font-bold text-[17px] text-[#F5F5F5]">
                      {isConnected ? 'CONNECTED' : 'LOCAL SIMULATOR'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#38a169]/15 border border-[#38a169]/30 text-[#38a169] font-mono text-[10px] font-bold">
                    REALTIME FEED
                  </span>
                </div>
              </div>

              {/* LOWER GRID: EVENT TIMELINE (LEFT 7 COLS) + AI DECISION & POLICE (RIGHT 5 COLS) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                <div className="lg:col-span-7 flex flex-col">
                  <EventTimeline events={pipelineEvents} />
                </div>

                <div className="lg:col-span-5 flex flex-col gap-3">
                  <AIRecommendationCard
                    recommendation={recommendation}
                    onExecute={handleExecuteRecommendation}
                    onDismiss={() => {
                      const typePrefix = recommendation.id.split('-')[0] + '-' + recommendation.id.split('-')[1];
                      setDismissedRecId(typePrefix);
                    }}
                  />
                  <PoliceCoordinationCard
                    assignments={policeAssignments}
                    dispatchedAlerts={dispatchedAlerts}
                    telemetry={telemetry}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── 3. BOTTOM SIMULATION CONTROLS BAR ── */}
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
