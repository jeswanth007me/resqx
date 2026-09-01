/**
 * ResQX Emergency Corridor & Green-Wave Engine Tests
 *
 * Deterministic test suite verifying:
 * TEST 1: Two signals on route -> corridor ordered chronologically.
 * TEST 2: Different predicted arrival times -> different signal schedules generated.
 * TEST 3: Signal with insufficient preparation time -> flagged appropriately.
 * TEST 4: Conflicting signal priorities -> conflict detected.
 * TEST 5: Signals are restored after ambulance passage (state machine progression).
 * TEST 6: No upcoming signals -> valid corridor with zero signal actions.
 * TEST 7: No route -> corridor planner safely returns failed corridor.
 */

import { getDefaultCityGraph } from '../graph.ts';
import { calculateAmbulanceRoute } from '../engine.ts';
import { calculateAmbulanceEta } from '../eta.ts';
import { planEmergencyCorridor } from '../corridor.ts';
import type { SignalInput } from '../../types/eta.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Emergency Corridor & Green-Wave Tests');
console.log('====================================================\n');

const testSignals: SignalInput[] = [
  { id: 'SIG-01', name: 'North Gate', road: 'ROAD-01', position: { x: 300, y: 150 } },
  { id: 'SIG-02', name: 'Central Avenue', road: 'ROAD-02', position: { x: 300, y: 275 } },
  { id: 'SIG-03', name: 'Hospital Approach', road: 'ROAD-03', position: { x: 300, y: 400 } },
];

// ── TEST 1: Two Signals on Route Ordered Correctly ───────────────────
console.log('TEST 1: Corridor signal ordering');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph); // ROAD-01 -> ROAD-03
  const etaResult = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 54, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: testSignals,
  });

  const corridor = planEmergencyCorridor(etaResult);

  console.log('  Corridor ID:', corridor.corridorId);
  console.log('  Total Signals:', corridor.signals.length);
  console.log('  Signal Order:', corridor.signals.map((s) => `${s.signalId} (${s.predictedArrivalSeconds}s)`).join(' → '));
  console.log('  Corridor Metrics:', JSON.stringify(corridor.metrics));

  assert(corridor.success === true, 'TEST 1: Corridor planning must succeed');
  assert(corridor.signals.length === 2, 'TEST 1: Corridor must contain 2 signals');
  assert(corridor.signals[0].signalId === 'SIG-01', 'TEST 1: First signal must be SIG-01');
  assert(corridor.signals[1].signalId === 'SIG-03', 'TEST 1: Second signal must be SIG-03');
  assert(
    corridor.signals[0].predictedArrivalSeconds < corridor.signals[1].predictedArrivalSeconds,
    'TEST 1: Signals must be strictly ordered by arrival time'
  );
  console.log('✅ TEST 1 PASSED: Emergency corridor ordered correctly.\n');
}

// ── TEST 2: Different Predicted Arrival Times -> Different Schedules ─
console.log('TEST 2: Dynamic signal schedule computation');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);

  // Speed 36 km/h (10 m/s) -> Slower arrival
  const slowEta = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 36, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: testSignals,
  });

  // Speed 72 km/h (20 m/s) -> Faster arrival
  const fastEta = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 72, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: testSignals,
  });

  const slowCorridor = planEmergencyCorridor(slowEta);
  const fastCorridor = planEmergencyCorridor(fastEta);

  const slowSig01 = slowCorridor.signals[0];
  const fastSig01 = fastCorridor.signals[0];

  console.log(`  Slow Ambulance (36 km/h): Arrival ${slowSig01.predictedArrivalSeconds}s | Prep @ ${slowSig01.prepareAt}s | Priority @ ${slowSig01.priorityStart}s | Restore @ ${slowSig01.restoreAt}s`);
  console.log(`  Fast Ambulance (72 km/h): Arrival ${fastSig01.predictedArrivalSeconds}s | Prep @ ${fastSig01.prepareAt}s | Priority @ ${fastSig01.priorityStart}s | Restore @ ${fastSig01.restoreAt}s`);

  assert(slowSig01.prepareAt > fastSig01.prepareAt, 'TEST 2: Slower ambulance must prepare later in time');
  assert(slowSig01.priorityStart > fastSig01.priorityStart, 'TEST 2: Slower ambulance priority must start later');
  assert(slowSig01.restoreAt > fastSig01.restoreAt, 'TEST 2: Slower ambulance restoration must end later');
  console.log('✅ TEST 2 PASSED: Signal schedules accurately adjust to predicted arrival times.\n');
}

// ── TEST 3: Insufficient Preparation Time ────────────────────────────
console.log('TEST 3: Insufficient preparation time safety flag');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);

  // Ambulance approaching signal 11m away (0.45 progress, signal at 0.50 -> ~0.8s arrival < 3.0s min threshold)
  const immediateEta = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0.45 },
    signals: [{ id: 'SIG-01', name: 'North Gate', road: 'ROAD-01', position: { x: 300, y: 150 } }],
  });

  const corridor = planEmergencyCorridor(immediateEta);
  const sigPlan = corridor.signals[0];

  console.log('  Arrival in:', sigPlan.predictedArrivalSeconds, 's');
  console.log('  Has Sufficient Prep Time:', sigPlan.safetyFlags.hasSufficientPreparationTime);
  console.log('  Safety Warnings:', sigPlan.safetyFlags.warnings);

  assert(
    sigPlan.safetyFlags.hasSufficientPreparationTime === false,
    'TEST 3: hasSufficientPreparationTime must be false when arrival < min threshold (3s)'
  );
  assert(
    sigPlan.safetyFlags.warnings.some((w) => w.includes('INSUFFICIENT_PREPARATION_TIME')),
    'TEST 3: Must include INSUFFICIENT_PREPARATION_TIME warning'
  );
  console.log('✅ TEST 3 PASSED: Insufficient preparation time correctly flagged for validator.\n');
}

// ── TEST 4: Conflicting Signal Priorities ────────────────────────────
console.log('TEST 4: Conflicting signal priority detection');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);
  const etaResult = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: [{ id: 'SIG-02', name: 'Central Avenue', road: 'ROAD-01' }],
  });

  // Simulate an active external priority on intersecting cross-street 'SIG-02-CROSS'
  const corridor = planEmergencyCorridor(etaResult, {
    activeExternalConflictingSignals: ['SIG-02-CROSS'],
  });

  const sigPlan = corridor.signals[0];
  console.log('  Signal:', sigPlan.signalId);
  console.log('  Status:', sigPlan.status);
  console.log('  Conflicts:', sigPlan.conflictingSignalIds);
  console.log('  Reason:', sigPlan.reason);

  assert(sigPlan.status === 'CONFLICT', 'TEST 4: Status must be CONFLICT when intersecting priority is active');
  assert(sigPlan.safetyFlags.hasConflictingPriority === true, 'TEST 4: hasConflictingPriority flag must be true');
  assert(sigPlan.conflictingSignalIds.includes('SIG-02-CROSS'), 'TEST 4: Conflicting signal must be identified');
  console.log('✅ TEST 4 PASSED: Intersecting signal priority conflict detected and held safely.\n');
}

// ── TEST 5: State Machine Progression & Restoration ──────────────────
console.log('TEST 5: State machine progression and post-passage restoration');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);
  const etaResult = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 54, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: testSignals,
  });

  const arrivalSec = etaResult.junctionArrivals[0].predictedArrivalSeconds; // ~7.8s

  // Sample at different relative times t
  const planT0 = planEmergencyCorridor(etaResult, { currentRelativeSeconds: 0 }); // t = 0s (PREPARING or NORMAL)
  const planTPrep = planEmergencyCorridor(etaResult, { currentRelativeSeconds: arrivalSec - 4.0 }); // PREPARING
  const planTPriority = planEmergencyCorridor(etaResult, { currentRelativeSeconds: arrivalSec - 1.0 }); // PRIORITY
  const planTPassing = planEmergencyCorridor(etaResult, { currentRelativeSeconds: arrivalSec + 1.0 }); // PASSING
  const planTRestoring = planEmergencyCorridor(etaResult, { currentRelativeSeconds: arrivalSec + 4.5 }); // RESTORING
  const planTNormal = planEmergencyCorridor(etaResult, { currentRelativeSeconds: arrivalSec + 12.0 }); // NORMAL

  console.log(`  Phase at t=0s: ${planT0.signals[0].currentPhase}`);
  console.log(`  Phase at t=${(arrivalSec - 4).toFixed(1)}s: ${planTPrep.signals[0].currentPhase}`);
  console.log(`  Phase at t=${(arrivalSec - 1).toFixed(1)}s: ${planTPriority.signals[0].currentPhase}`);
  console.log(`  Phase at t=${(arrivalSec + 1).toFixed(1)}s: ${planTPassing.signals[0].currentPhase}`);
  console.log(`  Phase at t=${(arrivalSec + 4.5).toFixed(1)}s: ${planTRestoring.signals[0].currentPhase}`);
  console.log(`  Phase at t=${(arrivalSec + 12).toFixed(1)}s: ${planTNormal.signals[0].currentPhase}`);

  assert(planTPrep.signals[0].currentPhase === 'PREPARING', 'TEST 5: Phase must be PREPARING before arrival');
  assert(planTPriority.signals[0].currentPhase === 'PRIORITY', 'TEST 5: Phase must be PRIORITY during green wave window');
  assert(planTPassing.signals[0].currentPhase === 'PASSING', 'TEST 5: Phase must be PASSING while crossing');
  assert(planTRestoring.signals[0].currentPhase === 'RESTORING', 'TEST 5: Phase must be RESTORING after passing');
  assert(planTNormal.signals[0].currentPhase === 'NORMAL', 'TEST 5: Phase must return to NORMAL after full cycle');
  console.log('✅ TEST 5 PASSED: Full 5-phase signal priority state machine verified.\n');
}

// ── TEST 6: No Upcoming Signals ──────────────────────────────────────
console.log('TEST 6: Route with zero upcoming signals');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);
  const etaResult = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: [], // No signals
  });

  const corridor = planEmergencyCorridor(etaResult);

  console.log('  Corridor Status:', corridor.status);
  console.log('  Signal Count:', corridor.signals.length);
  console.log('  Reason:', corridor.reason);

  assert(corridor.success === true, 'TEST 6: Must succeed with 0 signals');
  assert(corridor.status === 'NO_SIGNALS', 'TEST 6: Status must be NO_SIGNALS');
  assert(corridor.signals.length === 0, 'TEST 6: Signals array must be empty');
  assert(corridor.metrics.totalSignalsCount === 0, 'TEST 6: Metrics signal count must be 0');
  console.log('✅ TEST 6 PASSED: Zero-signal corridor handled cleanly.\n');
}

// ── TEST 7: No Route Available ───────────────────────────────────────
console.log('TEST 7: No route available failure handling');
{
  const failedEtaResult = calculateAmbulanceEta({
    routeResult: {
      success: false,
      route: [],
      roadIds: [],
      totalDistance: 0,
      totalEstimatedTravelTime: Infinity,
      costBreakdown: { baseTravelTime: 0, trafficDelay: 0, signalDelay: 0, totalCost: Infinity },
      reason: 'NO ROUTE AVAILABLE',
      edges: [],
    },
  });

  const corridor = planEmergencyCorridor(failedEtaResult);

  console.log('  Corridor Success:', corridor.success);
  console.log('  Corridor Status:', corridor.status);
  console.log('  Reason:', corridor.reason);

  assert(corridor.success === false, 'TEST 7: Must return success false');
  assert(corridor.status === 'FAILED', 'TEST 7: Status must be FAILED');
  assert(corridor.signals.length === 0, 'TEST 7: Signals array must be empty');
  console.log('✅ TEST 7 PASSED: Safe failure result returned when route is missing.\n');
}

console.log('====================================================');
console.log('ALL 7 DETERMINISTIC CORRIDOR TESTS PASSED PERFECTLY!');
console.log('====================================================');
