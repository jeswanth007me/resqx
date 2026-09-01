/**
 * ResQX Dijkstra Routing Engine Tests
 *
 * Deterministic test suite verifying:
 * TEST 1: Normal traffic -> calculate valid best route.
 * TEST 2: Traffic penalty increase on preferred route -> dynamic rerouting to cheaper alternative.
 * TEST 3: Block preferred road -> route avoids blocked road.
 * TEST 4: Block all possible routes -> safe "NO ROUTE AVAILABLE" failure result.
 */

import { getDefaultCityGraph, setEdgeTrafficDelay, setEdgeBlocked } from '../graph.ts';
import { calculateEdgeCost } from '../dijkstra.ts';
import { calculateAmbulanceRoute } from '../engine.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Dijkstra Routing Engine — Deterministic Tests');
console.log('====================================================\n');

// ── TEST 1: Normal Traffic ───────────────────────────────────────────
console.log('TEST 1: Normal traffic conditions');
{
  const graph = getDefaultCityGraph();
  const result = calculateAmbulanceRoute(graph);

  console.log('  Selected Route:', result.roadIds.join(' → '));
  console.log('  Total Cost:', result.totalEstimatedTravelTime, 'sec');
  console.log('  Total Distance:', result.totalDistance, 'm');
  console.log('  Reason:', result.reason);

  assert(result.success === true, 'TEST 1: Route calculation should succeed');
  assert(
    JSON.stringify(result.roadIds) === JSON.stringify(['ROAD-01', 'ROAD-03']),
    'TEST 1: Should select direct central corridor [ROAD-01, ROAD-03]'
  );
  assert(result.totalEstimatedTravelTime === 45, 'TEST 1: Base cost should be 20s + 25s = 45s');
  assert(result.totalDistance === 505, 'TEST 1: Total distance should be 235m + 270m = 505m');
  console.log('✅ TEST 1 PASSED: Preferred direct route selected under normal traffic.\n');
}

// ── TEST 2: Traffic Penalty on Preferred Route ───────────────────────
console.log('TEST 2: Traffic congestion penalty on preferred route');
{
  const graph = getDefaultCityGraph();

  // Primary route base cost is 45s (ROAD-01: 20s + ROAD-03: 25s)
  // West detour base cost is: ROAD-01 (20s) + ROAD-02-W (20s) + ROAD-04 (24s) + ROAD-06 (15s) = 79s
  // Adding 60s traffic penalty to ROAD-03 makes primary route cost = 20s + (25s + 60s) = 105s
  setEdgeTrafficDelay(graph, 'ROAD-03', 60);

  const result = calculateAmbulanceRoute(graph);

  console.log('  Selected Route:', result.roadIds.join(' → '));
  console.log('  Total Cost:', result.totalEstimatedTravelTime, 'sec');
  console.log('  Cost Breakdown:', JSON.stringify(result.costBreakdown));
  console.log('  Reason:', result.reason);

  assert(result.success === true, 'TEST 2: Route calculation should succeed');
  assert(
    result.roadIds.includes('ROAD-03') === false,
    'TEST 2: Should reroute away from congested ROAD-03'
  );
  assert(
    JSON.stringify(result.roadIds) === JSON.stringify(['ROAD-01', 'ROAD-02-W', 'ROAD-04', 'ROAD-06']) ||
    JSON.stringify(result.roadIds) === JSON.stringify(['ROAD-01', 'ROAD-02-E', 'ROAD-05', 'ROAD-07']),
    'TEST 2: Should select detour route (79s cost < 105s congested primary route)'
  );
  assert(result.totalEstimatedTravelTime === 79, 'TEST 2: Detour cost should be 79s');
  console.log('✅ TEST 2 PASSED: Dynamic rerouting selected cheaper alternative path under heavy traffic.\n');
}

// ── TEST 3: Block Road on Preferred Route ────────────────────────────
console.log('TEST 3: Block road on preferred route');
{
  const graph = getDefaultCityGraph();

  // Block ROAD-03 completely (e.g., accident/road closure)
  setEdgeBlocked(graph, 'ROAD-03', true);

  const edgeCost = calculateEdgeCost(graph.edges.get('ROAD-03')!);
  assert(edgeCost === Infinity, 'TEST 3: Blocked edge cost must evaluate to Infinity');

  const result = calculateAmbulanceRoute(graph);

  console.log('  Selected Route:', result.roadIds.join(' → '));
  console.log('  Total Cost:', result.totalEstimatedTravelTime, 'sec');
  console.log('  Reason:', result.reason);

  assert(result.success === true, 'TEST 3: Alternate route must be found');
  assert(
    result.roadIds.includes('ROAD-03') === false,
    'TEST 3: Route must NOT include blocked ROAD-03'
  );
  assert(
    result.roadIds.length === 4,
    'TEST 3: Detour route should consist of 4 edges to bypass blocked section'
  );
  console.log('✅ TEST 3 PASSED: Dijkstra successfully avoided the blocked road and navigated via bypass.\n');
}

// ── TEST 4: Block All Possible Routes ────────────────────────────────
console.log('TEST 4: Block all possible routes to destination');
{
  const graph = getDefaultCityGraph();

  // Block all hospital arrival entry edges: ROAD-03, ROAD-06, ROAD-07
  setEdgeBlocked(graph, 'ROAD-03', true);
  setEdgeBlocked(graph, 'ROAD-06', true);
  setEdgeBlocked(graph, 'ROAD-07', true);

  const result = calculateAmbulanceRoute(graph);

  console.log('  Success:', result.success);
  console.log('  Route:', result.roadIds);
  console.log('  Total Estimated Travel Time:', result.totalEstimatedTravelTime);
  console.log('  Reason:', result.reason);

  assert(result.success === false, 'TEST 4: Success must be false when destination is unreachable');
  assert(result.roadIds.length === 0, 'TEST 4: Road IDs array must be empty');
  assert(result.totalEstimatedTravelTime === Infinity, 'TEST 4: Travel time must be Infinity');
  assert(
    result.reason.startsWith('NO ROUTE AVAILABLE'),
    'TEST 4: Must return safe "NO ROUTE AVAILABLE" failure message without crashing'
  );
  console.log('✅ TEST 4 PASSED: Safe NO ROUTE AVAILABLE response returned when graph is fully blocked.\n');
}

console.log('====================================================');
console.log('ALL 4 DETERMINISTIC ROUTING TESTS PASSED PERFECTLY!');
console.log('====================================================');
