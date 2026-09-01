/**
 * ResQX Queue-Aware Traffic Intelligence & Scenario Tests
 *
 * Deterministic test suite verifying:
 * 1. Zero queue -> base free-flow edge cost
 * 2. Increasing queue -> deterministically increases edge travel cost
 * 3. High queue on preferred route -> triggers dynamic rerouting to cheaper bypass
 * 4. Road blockage scenario -> safely excludes blocked road and routes via bypass
 * 5. Queue on one road does not contaminate unrelated roads
 * 6. Missing/empty vehicle telemetry handled safely with sensible defaults
 * 7. Real telemetry queue estimation correctly measures stopped vehicles (< 5 km/h)
 * 8. Scenario switching (NORMAL -> HIGH_TRAFFIC -> ROAD_BLOCKAGE)
 */

import { getDefaultCityGraph } from '../../routing/graph.ts';
import { calculateAmbulanceRoute } from '../../routing/engine.ts';
import { calculateEdgeCost } from '../../routing/dijkstra.ts';
import { estimateRoadQueues, calculateQueueDelayFromCounts } from '../queueEstimator.ts';
import { applyScenarioToGraph } from '../scenarios.ts';
import type { TelemetryVehicle } from '../../types/telemetry.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Queue-Aware Traffic Intelligence Tests');
console.log('====================================================\n');

// ── TEST 1: Zero Queue Free-Flow Cost ────────────────────────────────
console.log('TEST 1: Zero queue free-flow edge cost');
{
  const graph = getDefaultCityGraph();
  const road03 = graph.edges.get('ROAD-03')!;

  const cost = calculateEdgeCost(road03);
  console.log('  ROAD-03 Base Travel Time:', road03.baseTravelTime, 's');
  console.log('  ROAD-03 Calculated Cost:', cost, 's');

  assert(cost === road03.baseTravelTime, 'TEST 1: Zero queue cost must equal base travel time (25s)');
  console.log('✅ TEST 1 PASSED: Free-flow cost verified with 0 queue.\n');
}

// ── TEST 2: Increasing Queue Deterministically Increases Cost ────────
console.log('TEST 2: Increasing queue deterministically increases cost');
{
  const delay0 = calculateQueueDelayFromCounts(0, 0); // 0 stopped -> 0s
  const delay3 = calculateQueueDelayFromCounts(3, 0); // 3 stopped -> 3 * 4s = 12s
  const delay6 = calculateQueueDelayFromCounts(6, 2); // 6 stopped + 2 slow -> 6*4 + 2*1.5 = 27s

  console.log('  0 stopped vehicles queue delay:', delay0, 's');
  console.log('  3 stopped vehicles queue delay:', delay3, 's');
  console.log('  6 stopped + 2 slow queue delay:', delay6, 's');

  assert(delay0 === 0, 'TEST 2: 0 stopped must produce 0s delay');
  assert(delay3 === 12, 'TEST 2: 3 stopped must produce 12s delay');
  assert(delay6 === 27, 'TEST 2: 6 stopped + 2 slow must produce 27s delay');
  console.log('✅ TEST 2 PASSED: Queue delay scales deterministically with vehicle counts.\n');
}

// ── TEST 3: High Queue on Preferred Route Triggers Dynamic Reroute ───
console.log('TEST 3: High queue on preferred route triggers dynamic rerouting');
{
  const baseGraph = getDefaultCityGraph();
  const normalRoute = calculateAmbulanceRoute(baseGraph);

  // Apply High Traffic scenario
  const highTrafficGraph = applyScenarioToGraph(baseGraph, 'HIGH_TRAFFIC');
  const highTrafficRoute = calculateAmbulanceRoute(highTrafficGraph);

  console.log('  NORMAL Scenario Route:', normalRoute.roadIds.join(' → '), `(${normalRoute.totalEstimatedTravelTime}s)`);
  console.log('  HIGH_TRAFFIC Scenario Route:', highTrafficRoute.roadIds.join(' → '), `(${highTrafficRoute.totalEstimatedTravelTime}s)`);
  console.log('  Rerouting Reason:', highTrafficRoute.reason);

  assert(
    JSON.stringify(normalRoute.roadIds) === JSON.stringify(['ROAD-01', 'ROAD-03']),
    'TEST 3: Normal route must be direct corridor'
  );
  assert(
    highTrafficRoute.roadIds.includes('ROAD-03') === false,
    'TEST 3: High traffic must reroute away from queued ROAD-03'
  );
  assert(
    highTrafficRoute.totalEstimatedTravelTime === 79,
    'TEST 3: Detour route cost must be 79s (< 86s congested direct corridor)'
  );
  console.log('✅ TEST 3 PASSED: High traffic queue successfully triggered bypass selection.\n');
}

// ── TEST 4: Road Blockage Scenario Rerouting ─────────────────────────
console.log('TEST 4: Road blockage scenario exclusion');
{
  const baseGraph = getDefaultCityGraph();
  const blockedGraph = applyScenarioToGraph(baseGraph, 'ROAD_BLOCKAGE');
  const blockedRoute = calculateAmbulanceRoute(blockedGraph);

  console.log('  ROAD_BLOCKAGE Scenario Route:', blockedRoute.roadIds.join(' → '), `(${blockedRoute.totalEstimatedTravelTime}s)`);
  console.log('  Blockage Reason:', blockedRoute.reason);

  assert(blockedRoute.success === true, 'TEST 4: Route calculation must succeed with alternate bypass');
  assert(
    blockedRoute.roadIds.includes('ROAD-03') === false,
    'TEST 4: Route must completely exclude blocked ROAD-03'
  );
  assert(blockedRoute.roadIds.length === 4, 'TEST 4: Alternate bypass route must be selected');
  console.log('✅ TEST 4 PASSED: Blocked road excluded and alternate route activated.\n');
}

// ── TEST 5: Queue on One Road Does Not Contaminate Other Roads ───────
console.log('TEST 5: Queue isolation across independent road edges');
{
  const baseGraph = getDefaultCityGraph();
  const modifiedGraph = applyScenarioToGraph(baseGraph, 'HIGH_TRAFFIC');

  const road01 = modifiedGraph.edges.get('ROAD-01')!;
  const road04 = modifiedGraph.edges.get('ROAD-04')!;
  const road03 = modifiedGraph.edges.get('ROAD-03')!;

  console.log('  ROAD-01 Queue Delay:', road01.queueDelay ?? 0, 's');
  console.log('  ROAD-04 Queue Delay:', road04.queueDelay ?? 0, 's');
  console.log('  ROAD-03 Queue Delay (Targeted):', road03.queueDelay ?? 0, 's');

  assert((road01.queueDelay ?? 0) === 0, 'TEST 5: ROAD-01 queue must remain 0');
  assert((road04.queueDelay ?? 0) === 0, 'TEST 5: ROAD-04 queue must remain 0');
  assert((road03.queueDelay ?? 0) > 0, 'TEST 5: ROAD-03 queue must be set');
  console.log('✅ TEST 5 PASSED: Queue delay strictly isolated to target road segment.\n');
}

// ── TEST 6: Telemetry Queue Estimator ────────────────────────────────
console.log('TEST 6: Real vehicle telemetry queue estimation');
{
  const sampleVehicles: TelemetryVehicle[] = [
    { id: 'CAR-01', type: 'car', x: 100, y: 180, speedKmh: 1.2, road: 'ROAD-03', lane: 'ROAD-03_0', angle: 180 }, // Stopped
    { id: 'CAR-02', type: 'car', x: 100, y: 170, speedKmh: 2.0, road: 'ROAD-03', lane: 'ROAD-03_0', angle: 180 }, // Stopped
    { id: 'CAR-03', type: 'car', x: 100, y: 160, speedKmh: 12.0, road: 'ROAD-03', lane: 'ROAD-03_0', angle: 180 }, // Slow crawl
    { id: 'CAR-04', type: 'car', x: 50, y: 200, speedKmh: 45.0, road: 'ROAD-02', lane: 'ROAD-02_0', angle: 90 }, // Free flow
  ];

  const metrics = estimateRoadQueues(sampleVehicles);
  const road03Metrics = metrics.get('ROAD-03');

  console.log('  ROAD-03 Vehicles:', road03Metrics?.vehicleCount);
  console.log('  ROAD-03 Stopped Vehicles (<5 km/h):', road03Metrics?.stoppedVehicleCount);
  console.log('  ROAD-03 Estimated Queue Length:', road03Metrics?.queueLengthMeters, 'm');
  console.log('  ROAD-03 Queue Delay:', road03Metrics?.estimatedQueueDelaySeconds, 's');
  console.log('  ROAD-03 Congestion Level:', road03Metrics?.congestionLevel);

  assert(road03Metrics !== undefined, 'TEST 6: Must produce metrics for ROAD-03');
  assert(road03Metrics!.stoppedVehicleCount === 2, 'TEST 6: Must detect 2 stopped vehicles');
  assert(road03Metrics!.queueLengthMeters === 15.0, 'TEST 6: 2 * 7.5m = 15.0m queue length');
  assert(road03Metrics!.estimatedQueueDelaySeconds === 9.5, 'TEST 6: 2*4.0s + 1*1.5s = 9.5s delay');
  console.log('✅ TEST 6 PASSED: Telemetry queue estimation accurately computed physical metrics.\n');
}

// ── TEST 7: Missing/Empty Telemetry Handled Safely ───────────────────
console.log('TEST 7: Empty telemetry graceful fallback');
{
  const metrics = estimateRoadQueues([]);
  assert(metrics.size === 0, 'TEST 7: Empty vehicles must produce empty map without error');
  console.log('✅ TEST 7 PASSED: Empty telemetry handled safely without crash.\n');
}

console.log('====================================================');
console.log('ALL 7 QUEUE INTELLIGENCE TESTS PASSED PERFECTLY!');
console.log('====================================================');
