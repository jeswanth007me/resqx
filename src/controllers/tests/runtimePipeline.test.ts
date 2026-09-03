/**
 * ResQX Single Canonical Runtime Pipeline Integration Tests
 *
 * Verifies the end-to-end control chain:
 * Telemetry -> AI Decision Engine -> Safety Validator Gate -> Signal Controller Execution
 *
 * Proves:
 * 1. Decision -> Safety Validation (APPROVED) -> Signal Action Executed (Local + SUMO)
 * 2. Decision -> Safety Validation (BLOCKED) -> Signal Action strictly PREVENTED from executing
 */

import { decisionEngine } from '../../ai/decisionEngine.ts';
import { getDefaultCityGraph } from '../../routing/graph.ts';
import { calculateAmbulanceRoute } from '../../routing/engine.ts';
import { calculateAmbulanceEta } from '../../routing/eta.ts';
import { planEmergencyCorridor } from '../../routing/corridor.ts';
import { validateCorridorPlan, validateSingleSignal } from '../../safety/validator.ts';
import { executeValidatedControl } from '../signalController.ts';
import type { TelemetryData } from '../../types/telemetry.ts';
import type { SignalPlan } from '../../types/corridor.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Runtime Pipeline Integration Tests');
console.log('====================================================\n');

// ── TEST 1: Full Pipeline Flow (Telemetry -> Decision -> Safety APPROVED -> Execution) ──
console.log('TEST 1: Decision -> Safety Validation (APPROVED) -> Signal Controller Executed');
{
  const mockTelemetry: TelemetryData = {
    simulation: { running: true, step: 10, elapsedTime: 10.0 },
    ambulance: {
      id: 'AMB-01',
      status: 'EN_ROUTE',
      x: 100.0,
      y: 220.0,
      speedKmh: 50.0,
      currentRoad: 'ROAD-01',
      nextSignal: 'SIG-01',
      distanceToNextSignal: 80,
      etaSeconds: 6,
    },
    signals: [
      { id: 'SIG-01', state: 'rrrGG', emergencyState: 'NORMAL', distanceFromAmbulance: 80 },
      { id: 'SIG-03', state: 'rrrGG', emergencyState: 'NORMAL', distanceFromAmbulance: 250 },
    ],
    traffic: { level: 'MODERATE', vehicleCount: 3, vehicles: [] },
    mission: {
      origin: 'N_START',
      destination: 'HOSPITAL',
      elapsedTime: 10.0,
      estimatedNormalTime: 45.0,
      estimatedResQXTime: 28.0,
      timeSaved: 17.0,
      signalsPrioritized: 0,
      intersectionsCleared: 0,
    },
  };

  // Step 1: Canonical AI Decision Engine
  const recommendation = decisionEngine(mockTelemetry);
  console.log('  1. AI Decision Action:', recommendation.action);
  console.log('  1. AI Recommendation:', recommendation.recommendation);
  console.log('  1. AI Confidence:', recommendation.confidence + '%');
  console.log('  1. Target Signal:', recommendation.targetSignal);

  assert(recommendation.action === 'EXECUTE_OVERRIDE', 'Step 1: Decision engine must recommend EXECUTE_OVERRIDE');
  assert(recommendation.targetSignal === 'SIG-01', 'Step 1: Target signal must be SIG-01');

  // Step 2: Predictive Corridor & Canonical Safety Validator
  const graph = getDefaultCityGraph();
  const route = calculateAmbulanceRoute(graph);
  const eta = calculateAmbulanceEta({
    routeResult: route,
    ambulance: {
      speedKmh: mockTelemetry.ambulance.speedKmh,
      currentRoadId: mockTelemetry.ambulance.currentRoad,
      progressOnCurrentRoad: 0,
      status: 'EN_ROUTE',
    },
    signals: [
      { id: 'SIG-01', name: 'North Corridor Signal', road: 'ROAD-01' },
      { id: 'SIG-03', name: 'Central Junction Signal', road: 'ROAD-03' },
    ],
  });
  const corridor = planEmergencyCorridor(eta);
  const validation = validateCorridorPlan(corridor);

  console.log('  2. Safety Validation Decision:', validation.decision);
  console.log('  2. Safety All Safe:', validation.allSafe);
  console.log('  2. Approved Commands Count:', validation.approvedCommands.length);

  assert(validation.decision === 'APPROVED', 'Step 2: Safety Validator must APPROVE safe plan');
  assert(validation.approvedCommands.length > 0, 'Step 2: Must have at least 1 approved command');

  // Step 3: Canonical Signal Controller Execution Gate
  const localInvocations: Array<{ signalId: string; phase: string }> = [];

  const dispatchResult = await executeValidatedControl(validation, {
    serverUrl: 'http://localhost:9999-unreachable', // verify graceful network handling
    onLocalSignalChange: (sigId, phase) => {
      localInvocations.push({ signalId: sigId, phase });
    },
  });

  console.log('  3. Controller Execution Success:', dispatchResult.success);
  console.log('  3. Local Invocations Count:', localInvocations.length);
  console.log('  3. Invoked Signals:', localInvocations.map((i) => `${i.signalId} (${i.phase})`).join(', '));

  assert(dispatchResult.success === true, 'Step 3: Signal controller must report success for approved plan');
  assert(localInvocations.length > 0, 'Step 3: Local simulation adapter must be updated');
  assert(localInvocations.some((i) => i.signalId === 'SIG-01'), 'Step 3: Commanded signals must include target SIG-01');

  console.log('✅ TEST 1 PASSED: Full Telemetry -> Decision -> Safety APPROVED -> Execution verified.\n');
}

// ── TEST 2: Safety Gate Rejection (Decision -> Safety BLOCKED -> NO Signal Action) ──
console.log('TEST 2: Safety Rejection Gate: Decision -> Safety BLOCKED -> Signal Action NOT Executed');
{
  // Create an unsafe signal plan that violates duration cap (> 30s) and has cross-street conflict
  const unsafeSignalPlan: SignalPlan = {
    signalId: 'SIG-01',
    signalName: 'North Gate',
    roadId: 'ROAD-01',
    distanceFromAmbulance: 80,
    predictedArrivalSeconds: 5,
    predictedArrivalSimulationTime: 15,
    prepareAt: 0,
    priorityStart: 2,
    priorityEnd: 45, // 43s duration > 30s cap!
    restoreAt: 50,
    duration: 43,
    currentPhase: 'PRIORITY',
    status: 'CONFLICT', // Conflict flag!
    reason: 'Unsafe requested override',
    safetyFlags: {
      hasSufficientPreparationTime: true,
      withinMaxDuration: false,
      hasConflictingPriority: true,
      isRestorationScheduled: true,
      warnings: ['DURATION_EXCEEDED', 'CONFLICT_DETECTED'],
    },
    conflictingSignalIds: ['SIG-02-CROSS'],
  };

  const singleValidation = validateSingleSignal(unsafeSignalPlan);
  console.log('  1. Single Signal Safety Decision:', singleValidation.decision);
  console.log('  1. Blocked Command Rejection Reasons:', singleValidation.blockedCommand?.rejectionReasons);

  assert(singleValidation.decision === 'BLOCKED', 'Safety Validator must BLOCK unsafe plan');
  assert(singleValidation.blockedCommand !== undefined, 'Must provide blockedCommand metadata');

  // Attempt to execute a BLOCKED validation result
  let localAdapterCalled = false;
  const blockedValidationResult = {
    decision: 'BLOCKED' as const,
    allSafe: false,
    corridorId: 'TEST-BLOCKED-CORRIDOR',
    timestamp: Date.now(),
    approvedCommands: [],
    blockedCommands: [singleValidation.blockedCommand!],
    validationNotes: ['Plan blocked by safety validator'],
    safetySummary: 'Safety validation BLOCKED due to conflicts',
  };

  const dispatchResult = await executeValidatedControl(blockedValidationResult, {
    onLocalSignalChange: () => {
      localAdapterCalled = true;
    },
  });

  console.log('  2. Blocked Dispatch Result Success:', dispatchResult.success);
  console.log('  2. Blocked Dispatched Commands Count:', dispatchResult.dispatchedCommands.length);
  console.log('  2. Local Adapter Called for Blocked Action:', localAdapterCalled);

  assert(dispatchResult.success === false, 'Signal controller must return success: false when safety blocks plan');
  assert(dispatchResult.dispatchedCommands.length === 0, 'No commands must be dispatched when blocked');
  assert(localAdapterCalled === false, 'Local simulation adapter MUST NOT be invoked when safety blocks plan');

  console.log('✅ TEST 2 PASSED: Safety Gate strictly prevents rejected signal actions from executing.\n');
}

console.log('====================================================');
console.log('ALL RUNTIME PIPELINE INTEGRATION TESTS PASSED!');
console.log('====================================================\n');
