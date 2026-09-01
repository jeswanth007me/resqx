/**
 * ResQX Safety Validator & Signal Controller Tests
 *
 * Deterministic test suite verifying:
 * 1. Valid signal command authorization -> APPROVED
 * 2. Invalid/unknown signal ID rejection -> BLOCKED
 * 3. Insufficient preparation time check -> HOLD / Safety warning
 * 4. Conflicting signal priority rejection -> BLOCKED
 * 5. Priority duration cap & timeout protection (<= 30s)
 * 6. Guaranteed post-passage restoration schedule verification
 * 7. SUMO disconnect & local fallback simulation handling
 * 8. Complete closed-loop emergency corridor control execution
 */

import { getDefaultCityGraph } from '../../routing/graph.ts';
import { calculateAmbulanceRoute } from '../../routing/engine.ts';
import { calculateAmbulanceEta } from '../../routing/eta.ts';
import { planEmergencyCorridor } from '../../routing/corridor.ts';
import { validateCorridorPlan, validateSingleSignal } from '../validator.ts';
import { verifySignalPriorityState } from '../../controllers/signalController.ts';
import { initialState, tick, simulationStateToTelemetry } from '../../simulation/engine.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Safety Validator & Control Closed-Loop Tests');
console.log('====================================================\n');

// ── TEST 1: Valid Signal Command Authorization ───────────────────────
console.log('TEST 1: Valid signal command validation and authorization');
{
  const graph = getDefaultCityGraph();
  const route = calculateAmbulanceRoute(graph);
  const eta = calculateAmbulanceEta({
    routeResult: route,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: [{ id: 'SIG-01', name: 'North Gate', road: 'ROAD-01', position: { x: 300, y: 150 } }],
  });
  const corridor = planEmergencyCorridor(eta);
  const validation = validateCorridorPlan(corridor);

  console.log('  Overall Decision:', validation.decision);
  console.log('  All Safe:', validation.allSafe);
  console.log('  Approved Commands:', validation.approvedCommands.length);
  console.log('  Safety Summary:', validation.safetySummary);

  assert(validation.decision === 'APPROVED', 'TEST 1: Decision must be APPROVED');
  assert(validation.allSafe === true, 'TEST 1: allSafe must be true');
  assert(validation.approvedCommands.length === 1, 'TEST 1: Must authorize 1 signal command');
  assert(validation.approvedCommands[0].signalId === 'SIG-01', 'TEST 1: Authorized signal must be SIG-01');
  assert(validation.approvedCommands[0].timeoutSeconds === 30, 'TEST 1: Timeout cap must be 30s');
  console.log('✅ TEST 1 PASSED: Valid signal command properly authorized.\n');
}

// ── TEST 2: Invalid Signal ID Rejection ──────────────────────────────
console.log('TEST 2: Invalid/Unknown signal rejection');
{
  const invalidPlan = {
    signalId: 'SIG-99-UNKNOWN',
    signalName: 'Fake Light',
    roadId: 'ROAD-01',
    distanceFromAmbulance: 100,
    predictedArrivalSeconds: 10,
    predictedArrivalSimulationTime: 10,
    prepareAt: 4,
    priorityStart: 8,
    priorityEnd: 13,
    restoreAt: 17,
    duration: 5,
    currentPhase: 'PRIORITY' as const,
    status: 'APPROVED' as const,
    reason: 'Testing unknown signal',
    safetyFlags: {
      hasSufficientPreparationTime: true,
      withinMaxDuration: true,
      hasConflictingPriority: false,
      isRestorationScheduled: true,
      warnings: [],
    },
    conflictingSignalIds: [],
  };

  const validation = validateSingleSignal(invalidPlan);

  console.log('  Decision:', validation.decision);
  console.log('  Rejection Reasons:', validation.blockedCommand?.rejectionReasons);

  assert(validation.decision === 'BLOCKED', 'TEST 2: Unknown signal must be BLOCKED');
  assert(
    Boolean(validation.blockedCommand?.rejectionReasons.some((r) => r.includes('SIGNAL_NOT_FOUND'))),
    'TEST 2: Must contain SIGNAL_NOT_FOUND reason'
  );
  console.log('✅ TEST 2 PASSED: Unknown signal blocked safely.\n');
}

// ── TEST 3: Insufficient Preparation Time Check ──────────────────────
console.log('TEST 3: Insufficient preparation time safety check');
{
  const tightPlan = {
    signalId: 'SIG-01',
    signalName: 'North Gate',
    roadId: 'ROAD-01',
    distanceFromAmbulance: 10,
    predictedArrivalSeconds: 1.2, // Only 1.2s before arrival
    predictedArrivalSimulationTime: 1.2,
    prepareAt: 0,
    priorityStart: 0,
    priorityEnd: 4.2,
    restoreAt: 8.2,
    duration: 4.2,
    currentPhase: 'NORMAL' as const,
    status: 'APPROVED' as const,
    reason: 'Too close',
    safetyFlags: {
      hasSufficientPreparationTime: false,
      withinMaxDuration: true,
      hasConflictingPriority: false,
      isRestorationScheduled: true,
      warnings: ['INSUFFICIENT_PREPARATION_TIME'],
    },
    conflictingSignalIds: [],
  };

  const validation = validateSingleSignal(tightPlan);

  console.log('  Decision:', validation.decision);
  console.log('  Rejection Reasons:', validation.blockedCommand?.rejectionReasons);

  assert(validation.decision === 'HOLD', 'TEST 3: Insufficient prep time must trigger safety HOLD');
  assert(
    Boolean(validation.blockedCommand?.rejectionReasons.some((r) => r.includes('INSUFFICIENT_PREP_TIME'))),
    'TEST 3: Must flag INSUFFICIENT_PREP_TIME'
  );
  console.log('✅ TEST 3 PASSED: Insufficient prep time safely placed on HOLD.\n');
}

// ── TEST 4: Conflicting Signal Priority Rejection ────────────────────
console.log('TEST 4: Conflicting cross-traffic signal priority rejection');
{
  const conflictPlan = {
    signalId: 'SIG-02',
    signalName: 'Central Avenue',
    roadId: 'ROAD-02',
    distanceFromAmbulance: 150,
    predictedArrivalSeconds: 15,
    predictedArrivalSimulationTime: 15,
    prepareAt: 9,
    priorityStart: 13,
    priorityEnd: 18,
    restoreAt: 22,
    duration: 5,
    currentPhase: 'PRIORITY' as const,
    status: 'CONFLICT' as const,
    reason: 'Conflict on cross street',
    safetyFlags: {
      hasSufficientPreparationTime: true,
      withinMaxDuration: true,
      hasConflictingPriority: true,
      isRestorationScheduled: true,
      warnings: ['SIGNAL_CONFLICT'],
    },
    conflictingSignalIds: ['SIG-02-CROSS'],
  };

  const validation = validateSingleSignal(conflictPlan);

  console.log('  Decision:', validation.decision);
  console.log('  Rejection Reasons:', validation.blockedCommand?.rejectionReasons);

  assert(validation.decision === 'BLOCKED', 'TEST 4: Conflicting signal must be BLOCKED');
  assert(
    Boolean(validation.blockedCommand?.rejectionReasons.some((r) => r.includes('CONFLICT_DETECTED'))),
    'TEST 4: Must contain CONFLICT_DETECTED reason'
  );
  console.log('✅ TEST 4 PASSED: Intersecting conflict safely blocked.\n');
}

// ── TEST 5: Priority Duration Cap & Timeout Protection ───────────────
console.log('TEST 5: Priority duration cap and timeout protection');
{
  const excessiveDurationPlan = {
    signalId: 'SIG-01',
    signalName: 'North Gate',
    roadId: 'ROAD-01',
    distanceFromAmbulance: 200,
    predictedArrivalSeconds: 40,
    predictedArrivalSimulationTime: 40,
    prepareAt: 10,
    priorityStart: 10,
    priorityEnd: 55, // Duration 45s > 30s cap!
    restoreAt: 60,
    duration: 45,
    currentPhase: 'PRIORITY' as const,
    status: 'APPROVED' as const,
    reason: 'Excessive green duration',
    safetyFlags: {
      hasSufficientPreparationTime: true,
      withinMaxDuration: false,
      hasConflictingPriority: false,
      isRestorationScheduled: true,
      warnings: ['EXCEEDS_MAX_DURATION'],
    },
    conflictingSignalIds: [],
  };

  const validation = validateSingleSignal(excessiveDurationPlan);

  console.log('  Decision:', validation.decision);
  console.log('  Rejection Reasons:', validation.blockedCommand?.rejectionReasons);

  assert(validation.decision === 'BLOCKED', 'TEST 5: Excessive duration must be BLOCKED');
  assert(
    Boolean(validation.blockedCommand?.rejectionReasons.some((r) => r.includes('DURATION_EXCEEDED'))),
    'TEST 5: Must contain DURATION_EXCEEDED reason'
  );
  console.log('✅ TEST 5 PASSED: Priority duration cap (>30s) strictly enforced.\n');
}

// ── TEST 6: Guaranteed Restoration Verification ──────────────────────
console.log('TEST 6: Guaranteed restoration schedule check');
{
  const noRestorePlan = {
    signalId: 'SIG-01',
    signalName: 'North Gate',
    roadId: 'ROAD-01',
    distanceFromAmbulance: 100,
    predictedArrivalSeconds: 10,
    predictedArrivalSimulationTime: 10,
    prepareAt: 4,
    priorityStart: 8,
    priorityEnd: 13,
    restoreAt: 10, // Invalid: restoreAt <= priorityEnd!
    duration: 5,
    currentPhase: 'PRIORITY' as const,
    status: 'APPROVED' as const,
    reason: 'Missing restoration',
    safetyFlags: {
      hasSufficientPreparationTime: true,
      withinMaxDuration: true,
      hasConflictingPriority: false,
      isRestorationScheduled: false,
      warnings: [],
    },
    conflictingSignalIds: [],
  };

  const validation = validateSingleSignal(noRestorePlan);

  console.log('  Decision:', validation.decision);
  console.log('  Rejection Reasons:', validation.blockedCommand?.rejectionReasons);

  assert(validation.decision === 'BLOCKED', 'TEST 6: Missing restoration must be BLOCKED');
  assert(
    Boolean(validation.blockedCommand?.rejectionReasons.some((r) => r.includes('MISSING_RESTORATION'))),
    'TEST 6: Must contain MISSING_RESTORATION reason'
  );
  console.log('✅ TEST 6 PASSED: Guaranteed restoration schedule verified.\n');
}

// ── TEST 7: SUMO Disconnect & Local Fallback Simulation ───────────────
console.log('TEST 7: SUMO disconnect and local simulation fallback');
{
  let localState = initialState();
  assert(localState.isRunning === false, 'TEST 7: Initial state is not running');

  // Start local simulation
  localState = { ...localState, isRunning: true };
  localState = tick(localState, 1.0); // step 1s

  const localTelemetry = simulationStateToTelemetry(localState);

  console.log('  Local Sim Running:', localTelemetry.simulation.running);
  console.log('  Ambulance Status:', localTelemetry.ambulance.status);
  console.log('  Ambulance Position Y:', localTelemetry.ambulance.y);
  console.log('  Signals in Telemetry:', localTelemetry.signals.length);

  assert(localTelemetry.simulation.running === true, 'TEST 7: Local sim must be running');
  assert(localTelemetry.ambulance.status === 'EN_ROUTE', 'TEST 7: Ambulance must be EN_ROUTE');
  assert(localTelemetry.signals.length === 4, 'TEST 7: Signals must be reported');
  console.log('✅ TEST 7 PASSED: Local simulation provides continuous deterministic telemetry.\n');
}

// ── TEST 8: Closed-Loop State Verification ────────────────────────────
console.log('TEST 8: Closed-loop priority state verification');
{
  const verifiedPriority = verifySignalPriorityState('PRIORITY', 'EMERGENCY PRIORITY');
  const verifiedPrep = verifySignalPriorityState('PREPARING', 'PREPARING');
  const unverified = verifySignalPriorityState('PRIORITY', 'NORMAL');

  console.log('  Commanded PRIORITY vs Reported EMERGENCY PRIORITY:', verifiedPriority);
  console.log('  Commanded PREPARING vs Reported PREPARING:', verifiedPrep);
  console.log('  Commanded PRIORITY vs Reported NORMAL (Unverified):', unverified);

  assert(verifiedPriority === true, 'TEST 8: Priority must verify true when matched');
  assert(verifiedPrep === true, 'TEST 8: Preparing must verify true when matched');
  assert(unverified === false, 'TEST 8: Must NOT verify true when states mismatch');
  console.log('✅ TEST 8 PASSED: Closed-loop verification ensures zero fake priority claims.\n');
}

console.log('====================================================');
console.log('ALL 8 SAFETY VALIDATOR & CONTROL TESTS PASSED!');
console.log('====================================================');
