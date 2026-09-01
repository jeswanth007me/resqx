/**
 * ResQX Experimental Benchmarking & Performance Comparison Tests
 *
 * Deterministic test suite verifying:
 * 1. Travel time calculation from simulation start to arrival
 * 2. Stop detection and count aggregation
 * 3. Waiting time calculation (red-phase delay vs queue waiting)
 * 4. Baseline experiment execution & metric capture
 * 5. ResQX experiment execution & metric capture
 * 6. Comparison calculation (time saved, percentage improvement, stop reduction)
 * 7. Zero-value protection (strict divide-by-zero guard)
 * 8. Incomplete/failed experiment handling
 * 9. Scenario benchmark aggregation across NORMAL, HIGH_TRAFFIC, and ROAD_BLOCKAGE
 * 10. JSON experiment export serialization
 */

import {
  runBaselineExperiment,
  runResQXExperiment,
  compareExperiments,
  benchmarkScenario,
  exportExperimentToJson,
  createExperimentConfig,
} from '../benchmarkEngine.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Experimental Benchmarking Tests');
console.log('====================================================\n');

// ── TEST 1: Baseline Experiment Execution & Metrics ───────────────────
console.log('TEST 1: Baseline experiment execution (NORMAL scenario)');
{
  const baseline = runBaselineExperiment('NORMAL');

  console.log('  Baseline Status:', baseline.status);
  console.log('  Baseline Travel Time:', baseline.metrics.travelTimeSeconds, 's');
  console.log('  Baseline Stops:', baseline.metrics.stopsCount);
  console.log('  Baseline Waiting Time:', baseline.metrics.waitingTimeSeconds, 's');
  console.log('  Baseline Priority Events:', baseline.metrics.priorityEventsCount);

  assert(baseline.status === 'COMPLETED', 'TEST 1: Baseline must complete successfully');
  assert(baseline.metrics.travelTimeSeconds > 0, 'TEST 1: Travel time must be positive');
  assert(baseline.metrics.stopsCount === 2, 'TEST 1: Baseline must incur 2 uncoordinated signal stops');
  assert(baseline.metrics.priorityEventsCount === 0, 'TEST 1: Baseline must have 0 priority events');
  console.log('✅ TEST 1 PASSED: Baseline experiment metrics accurately captured.\n');
}

// ── TEST 2: ResQX Experiment Execution & Metrics ──────────────────────
console.log('TEST 2: ResQX experiment execution (NORMAL scenario)');
{
  const resqx = runResQXExperiment('NORMAL');

  console.log('  ResQX Status:', resqx.status);
  console.log('  ResQX Travel Time:', resqx.metrics.travelTimeSeconds, 's');
  console.log('  ResQX Stops:', resqx.metrics.stopsCount);
  console.log('  ResQX Waiting Time:', resqx.metrics.waitingTimeSeconds, 's');
  console.log('  ResQX Priority Events:', resqx.metrics.priorityEventsCount);

  assert(resqx.status === 'COMPLETED', 'TEST 2: ResQX must complete successfully');
  assert(resqx.metrics.travelTimeSeconds > 0, 'TEST 2: Travel time must be positive');
  assert(resqx.metrics.stopsCount === 0, 'TEST 2: ResQX green wave must eliminate stops (0 stops)');
  assert(resqx.metrics.waitingTimeSeconds === 0, 'TEST 2: ResQX pre-cleared corridor must have 0s waiting');
  assert(resqx.metrics.priorityEventsCount === 2, 'TEST 2: ResQX must execute 2 signal priority overrides');
  console.log('✅ TEST 2 PASSED: ResQX experiment metrics accurately captured.\n');
}

// ── TEST 3: Baseline vs ResQX Comparison Engine ───────────────────────
console.log('TEST 3: Baseline vs ResQX comparison calculation');
{
  const baseline = runBaselineExperiment('NORMAL');
  const resqx = runResQXExperiment('NORMAL');
  const comparison = compareExperiments(baseline, resqx);

  console.log('  Time Saved:', comparison.timeSavedSeconds, 's');
  console.log('  Percentage Improvement:', comparison.percentageImprovement, '%');
  console.log('  Stop Reduction:', comparison.stopReduction, 'stops eliminated');
  console.log('  Waiting Reduction:', comparison.waitingTimeReductionSeconds, 's');
  console.log('  Summary:', comparison.summary);

  assert(comparison.status === 'COMPLETED', 'TEST 3: Comparison status must be COMPLETED');
  assert(comparison.timeSavedSeconds === 24, 'TEST 3: ResQX must save 24s in NORMAL scenario');
  assert(comparison.percentageImprovement === 39.7, 'TEST 3: Improvement percentage must be 39.7%');
  assert(comparison.stopReduction === 2, 'TEST 3: Stop reduction must be 2 stops');
  assert(comparison.waitingTimeReductionSeconds === 24, 'TEST 3: Waiting reduction must be 24s');
  console.log('✅ TEST 3 PASSED: Comparison metrics calculated accurately.\n');
}

// ── TEST 4: High-Traffic Scenario Benchmarking ────────────────────────
console.log('TEST 4: High-Traffic scenario comparative benchmark');
{
  const benchmark = benchmarkScenario('HIGH_TRAFFIC');
  const comp = benchmark.aggregateComparison!;

  console.log('  Scenario:', benchmark.scenario);
  console.log('  Baseline Travel Time:', comp.baseline.travelTimeSeconds, 's');
  console.log('  ResQX Travel Time (Bypass Detour):', comp.resqx.travelTimeSeconds, 's');
  console.log('  Time Saved:', comp.timeSavedSeconds, 's');
  console.log('  Percentage Improvement:', comp.percentageImprovement, '%');

  assert(comp.baseline.travelTimeSeconds === 75.4, 'TEST 4: Baseline in HIGH_TRAFFIC must be 75.4s');
  assert(comp.resqx.travelTimeSeconds === 63.4, 'TEST 4: ResQX bypass route must be 63.4s');
  assert(comp.timeSavedSeconds === 12, 'TEST 4: Time saved must be 12s');
  console.log('✅ TEST 4 PASSED: High-traffic benchmark verified.\n');
}

// ── TEST 5: Road Blockage Scenario Benchmarking ───────────────────────
console.log('TEST 5: Road Blockage scenario comparative benchmark');
{
  const benchmark = benchmarkScenario('ROAD_BLOCKAGE');
  const comp = benchmark.aggregateComparison!;

  console.log('  Scenario:', benchmark.scenario);
  console.log('  ResQX Travel Time:', comp.resqx.travelTimeSeconds, 's');
  console.log('  ResQX Route Changes:', comp.resqx.routeChangesCount);

  assert(comp.resqx.travelTimeSeconds === 63.4, 'TEST 5: ResQX detour route travel time must be 63.4s');
  assert(comp.resqx.routeChangesCount === 1, 'TEST 5: Route changes count must be 1');
  console.log('✅ TEST 5 PASSED: Road blockage benchmark verified.\n');
}

// ── TEST 6: Zero-Value & Divide-by-Zero Protection ───────────────────
console.log('TEST 6: Zero-value and divide-by-zero protection');
{
  const emptyRun = {
    id: 'EXP-EMPTY',
    config: createExperimentConfig('NORMAL', 'BASELINE'),
    metrics: {
      travelTimeSeconds: 0,
      distanceMeters: 0,
      stopsCount: 0,
      waitingTimeSeconds: 0,
      redSignalWaitingSeconds: 0,
      priorityEventsCount: 0,
      routeChangesCount: 0,
      corridorDurationSeconds: 0,
      startSimulationTime: 0,
      arrivalSimulationTime: 0,
      simulationDurationSeconds: 0,
      averageSpeedKmh: 0,
    },
    status: 'COMPLETED' as const,
    isCompleted: true,
    timestamp: Date.now(),
  };

  const comp = compareExperiments(emptyRun, emptyRun);
  console.log('  Zero-travel comparison percentage:', comp.percentageImprovement);

  assert(comp.percentageImprovement === 0, 'TEST 6: Percentage must be 0 (no NaN/Infinity)');
  assert(!isNaN(comp.percentageImprovement), 'TEST 6: Percentage must not be NaN');
  assert(isFinite(comp.percentageImprovement), 'TEST 6: Percentage must be finite');
  console.log('✅ TEST 6 PASSED: Divide-by-zero guard verified.\n');
}

// ── TEST 7: Incomplete/Failed Experiment Handling ────────────────────
console.log('TEST 7: Incomplete experiment handling');
{
  const failedRun = {
    id: 'EXP-FAILED',
    config: createExperimentConfig('NORMAL', 'BASELINE'),
    metrics: {
      travelTimeSeconds: 0,
      distanceMeters: 0,
      stopsCount: 0,
      waitingTimeSeconds: 0,
      redSignalWaitingSeconds: 0,
      priorityEventsCount: 0,
      routeChangesCount: 0,
      corridorDurationSeconds: 0,
      startSimulationTime: 0,
      arrivalSimulationTime: 0,
      simulationDurationSeconds: 0,
      averageSpeedKmh: 0,
    },
    status: 'FAILED' as const,
    isCompleted: false,
    timestamp: Date.now(),
  };

  const validRun = runResQXExperiment('NORMAL');
  const comp = compareExperiments(failedRun, validRun);

  console.log('  Comparison Status with Failed Run:', comp.status);
  console.log('  Summary:', comp.summary);

  assert(comp.status === 'INCOMPLETE', 'TEST 7: Status must be INCOMPLETE');
  console.log('✅ TEST 7 PASSED: Incomplete experiment handled cleanly.\n');
}

// ── TEST 8: JSON Export Serialization ────────────────────────────────
console.log('TEST 8: JSON experiment export serialization');
{
  const benchmark = benchmarkScenario('NORMAL');
  const jsonStr = exportExperimentToJson(benchmark.aggregateComparison!);
  const parsed = JSON.parse(jsonStr);

  console.log('  Export Benchmark Version:', parsed.benchmarkVersion);
  console.log('  Export Scenario:', parsed.scenario);
  console.log('  Export Time Saved:', parsed.improvements.timeSavedSeconds, 's');

  assert(parsed.benchmarkVersion === 'ResQX-SIH-2026-v1.0', 'TEST 8: Version must match');
  assert(parsed.scenario === 'NORMAL', 'TEST 8: Scenario must be NORMAL');
  assert(parsed.improvements.timeSavedSeconds === 24, 'TEST 8: Time saved must be 24');
  console.log('✅ TEST 8 PASSED: JSON experiment export format verified.\n');
}

console.log('====================================================');
console.log('ALL 8 EXPERIMENTAL BENCHMARKING TESTS PASSED!');
console.log('====================================================');
