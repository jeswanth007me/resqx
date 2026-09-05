/**
 * ResQX Ambulance ETA Engine Tests
 *
 * Deterministic test suite verifying:
 * 1. Constant ambulance speed calculation (time = distance / speed)
 * 2. Different route lengths (short vs long corridor)
 * 3. Traffic delay influence (+traffic delay added to kinematic time)
 * 4. Signal delay influence (+signal delay added)
 * 5. Zero / very low speed handling (fallback emergency speed applied safely)
 * 6. Destination reached state (0m distance, 0s ETA, isArrived true)
 * 7. Per-junction arrival prediction (SIG-01 -> SIG-02 -> SIG-03 arrival timings)
 */

import { getDefaultCityGraph, setEdgeTrafficDelay, setEdgeSignalDelay } from '../graph.ts';
import { calculateAmbulanceRoute } from '../engine.ts';
import { calculateAmbulanceEta } from '../eta.ts';
import type { SignalInput } from '../../types/eta.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Ambulance ETA Engine — Deterministic Tests');
console.log('====================================================\n');

// Sample test signals
const testSignals: SignalInput[] = [
  { id: 'SIG-01', name: 'North Gate', road: 'ROAD-01', position: { x: 300, y: 150 } },
  { id: 'SIG-02', name: 'Central Avenue', road: 'ROAD-02', position: { x: 300, y: 275 } },
  { id: 'SIG-03', name: 'Hospital Approach', road: 'ROAD-03', position: { x: 300, y: 400 } },
  { id: 'SIG-04', name: 'South Corridor', road: 'ROAD-03', position: { x: 300, y: 525 } },
];

// ── TEST 1: Constant Ambulance Speed ─────────────────────────────────
console.log('TEST 1: Constant ambulance speed calculation');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph); // ROAD-01 (235m) + ROAD-03 (270m) = 505m

  // At 50 km/h (13.8889 m/s), kinematic time = 505 / (50 / 3.6) = 36.36s
  const result = calculateAmbulanceEta({
    routeResult,
    ambulance: {
      speedKmh: 50,
      currentRoadId: 'ROAD-01',
      progressOnCurrentRoad: 0,
      status: 'EN_ROUTE',
    },
    signals: testSignals,
  });

  console.log('  Remaining Distance:', result.totalRemainingDistance, 'm');
  console.log('  Effective Speed:', result.effectiveSpeedKmh, 'km/h');
  console.log('  Estimated Travel Time:', result.estimatedTravelTime, 's');
  console.log('  Formatted ETA:', result.formattedEta);

  assert(result.success === true, 'TEST 1: ETA calculation should succeed');
  assert(result.totalRemainingDistance === 505, 'TEST 1: Total distance should be 505m');
  assert(Math.abs(result.estimatedTravelTime - 36.4) < 0.2, 'TEST 1: Time should be ~36.4s');
  assert(result.formattedEta === '00:36', 'TEST 1: Formatted ETA should be 00:36');
  console.log('✅ TEST 1 PASSED: Constant speed travel time calculated accurately.\n');
}

// ── TEST 2: Different Route Lengths ──────────────────────────────────
console.log('TEST 2: Different route lengths scaling');
{
  const graph = getDefaultCityGraph();

  // Short route: only ROAD-01 (235m)
  const shortRoute = {
    ...calculateAmbulanceRoute(graph),
    edges: [graph.edges.get('ROAD-01')!],
    roadIds: ['ROAD-01'],
    totalDistance: 235,
  };

  // Long route: ROAD-01 + ROAD-02-W + ROAD-04 + ROAD-06 (235 + 220 + 270 + 155 = 880m)
  const longRoute = {
    ...calculateAmbulanceRoute(graph),
    edges: [
      graph.edges.get('ROAD-01')!,
      graph.edges.get('ROAD-02-W')!,
      graph.edges.get('ROAD-04')!,
      graph.edges.get('ROAD-06')!,
    ],
    roadIds: ['ROAD-01', 'ROAD-02-W', 'ROAD-04', 'ROAD-06'],
    totalDistance: 880,
  };

  const speed = 72; // 72 km/h = 20 m/s
  const shortEta = calculateAmbulanceEta({
    routeResult: shortRoute,
    ambulance: { speedKmh: speed, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
  });

  const longEta = calculateAmbulanceEta({
    routeResult: longRoute,
    ambulance: { speedKmh: speed, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
  });

  console.log('  Short Route Distance:', shortEta.totalRemainingDistance, 'm → Travel Time:', shortEta.estimatedTravelTime, 's');
  console.log('  Long Route Distance:', longEta.totalRemainingDistance, 'm → Travel Time:', longEta.estimatedTravelTime, 's');

  // Short: 235 / 20 = 11.75s (~11.8s)
  // Long: 880 / 20 = 44.0s
  assert(Math.abs(shortEta.estimatedTravelTime - 11.8) < 0.2, 'TEST 2: Short route should take ~11.8s');
  assert(Math.abs(longEta.estimatedTravelTime - 44.0) < 0.2, 'TEST 2: Long route should take 44.0s');
  assert(longEta.estimatedTravelTime > shortEta.estimatedTravelTime, 'TEST 2: Longer route should take longer');
  console.log('✅ TEST 2 PASSED: ETA correctly scales with route distance.\n');
}

// ── TEST 3: Traffic Delay Influence ──────────────────────────────────
console.log('TEST 3: Traffic delay addition to kinematic time');
{
  const graph = getDefaultCityGraph();
  setEdgeTrafficDelay(graph, 'ROAD-03', 15); // +15s traffic delay on ROAD-03

  const routeResult = calculateAmbulanceRoute(graph);
  const eta = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
  });

  console.log('  Free-Flow Time:', eta.costBreakdown.freeFlowTime, 's');
  console.log('  Traffic Delay:', eta.costBreakdown.trafficDelay, 's');
  console.log('  Total Estimated Time:', eta.estimatedTravelTime, 's');

  // Free flow 36.4s + 15s traffic = 51.4s
  assert(eta.costBreakdown.trafficDelay === 15, 'TEST 3: Traffic delay breakdown must be 15s');
  assert(Math.abs(eta.estimatedTravelTime - 51.4) < 0.2, 'TEST 3: Total time must reflect +15s traffic delay');
  console.log('✅ TEST 3 PASSED: Traffic delay successfully added to estimated arrival time.\n');
}

// ── TEST 4: Signal Delay Influence ───────────────────────────────────
console.log('TEST 4: Signal delay addition');
{
  const graph = getDefaultCityGraph();
  setEdgeSignalDelay(graph, 'ROAD-01', 8); // +8s signal delay on ROAD-01

  const routeResult = calculateAmbulanceRoute(graph);
  const eta = calculateAmbulanceEta({
    routeResult,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
  });

  console.log('  Free-Flow Time:', eta.costBreakdown.freeFlowTime, 's');
  console.log('  Signal Delay:', eta.costBreakdown.signalDelay, 's');
  console.log('  Total Estimated Time:', eta.estimatedTravelTime, 's');

  assert(eta.costBreakdown.signalDelay === 8, 'TEST 4: Signal delay breakdown must be 8s');
  assert(Math.abs(eta.estimatedTravelTime - 44.4) < 0.2, 'TEST 4: Total time must reflect +8s signal delay');
  console.log('✅ TEST 4 PASSED: Signal red-phase delay correctly incorporated.\n');
}

// ── TEST 5: Zero / Very Low Speed Handling ───────────────────────────
console.log('TEST 5: Zero/staged ambulance speed fallback');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);

  const eta = calculateAmbulanceEta({
    routeResult,
    ambulance: {
      speedKmh: 0, // Ambulance is currently staged/stopped at origin
      currentRoadId: 'ROAD-01',
      progressOnCurrentRoad: 0,
      status: 'STAGED',
    },
    defaultCruisingSpeedKmh: 50,
  });

  console.log('  Reported Speed: 0 km/h');
  console.log('  Effective Fallback Speed:', eta.effectiveSpeedKmh, 'km/h');
  console.log('  Estimated Travel Time:', eta.estimatedTravelTime, 's');
  console.log('  Assumptions:', eta.assumptions);

  assert(eta.success === true, 'TEST 5: Must succeed without dividing by zero');
  assert(Number.isFinite(eta.estimatedTravelTime), 'TEST 5: Travel time must be finite');
  assert(eta.effectiveSpeedKmh === 50, 'TEST 5: Effective speed must fallback to 50 km/h');
  console.log('✅ TEST 5 PASSED: Zero/staged speed safely handled with nominal emergency speed.\n');
}

// ── TEST 6: Destination Reached ──────────────────────────────────────
console.log('TEST 6: Destination reached condition');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);

  const eta = calculateAmbulanceEta({
    routeResult,
    ambulance: {
      speedKmh: 0,
      currentRoadId: 'ROAD-03',
      progressOnCurrentRoad: 1.0,
      status: 'ARRIVED',
    },
  });

  console.log('  Is Arrived:', eta.isArrived);
  console.log('  Remaining Distance:', eta.totalRemainingDistance, 'm');
  console.log('  Estimated Travel Time:', eta.estimatedTravelTime, 's');
  console.log('  Formatted ETA:', eta.formattedEta);

  assert(eta.isArrived === true, 'TEST 6: isArrived must be true');
  assert(eta.totalRemainingDistance === 0, 'TEST 6: Remaining distance must be 0m');
  assert(eta.estimatedTravelTime === 0, 'TEST 6: Estimated travel time must be 0s');
  assert(eta.formattedEta === '00:00', 'TEST 6: Formatted ETA must be 00:00');
  console.log('✅ TEST 6 PASSED: Reached state returns 0 remaining distance and 00:00 ETA.\n');
}

// ── TEST 7: Per-Junction Arrival Prediction ──────────────────────────
console.log('TEST 7: Per-junction arrival prediction for Corridor Planner');
{
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph); // ROAD-01 -> ROAD-03

  const eta = calculateAmbulanceEta({
    routeResult,
    ambulance: {
      speedKmh: 54, // 54 km/h = 15 m/s
      currentRoadId: 'ROAD-01',
      progressOnCurrentRoad: 0,
      status: 'EN_ROUTE',
    },
    signals: testSignals,
    currentSimulationTime: 10,
  });

  console.log('  Upcoming Junction Arrivals:');
  for (const junc of eta.junctionArrivals) {
    console.log(
      `    ${junc.signalId} (${junc.name}) → Distance: ${junc.distanceFromAmbulance}m | Arrival in: ${junc.predictedArrivalSeconds}s | Sim Clock: ${junc.predictedArrivalSimulationTime}s`
    );
  }

  assert(eta.junctionArrivals.length >= 3, 'TEST 7: Must predict arrival for signals along route');
  assert(
    eta.junctionArrivals[0].signalId === 'SIG-01',
    'TEST 7: First predicted signal must be SIG-01'
  );
  assert(
    eta.junctionArrivals[1].signalId === 'SIG-03',
    'TEST 7: Second predicted signal must be SIG-03'
  );
  assert(
    eta.junctionArrivals[2].signalId === 'SIG-04',
    'TEST 7: Third predicted signal must be SIG-04'
  );
  assert(
    eta.junctionArrivals[0].predictedArrivalSeconds < eta.junctionArrivals[1].predictedArrivalSeconds,
    'TEST 7: Signals must be ordered chronologically'
  );
  assert(
    eta.junctionArrivals[1].predictedArrivalSeconds < eta.junctionArrivals[2].predictedArrivalSeconds,
    'TEST 7: Signals must be ordered chronologically'
  );
  assert(
    eta.junctionArrivals[2].predictedArrivalSeconds <= eta.estimatedTravelTime,
    'TEST 7: Intermediate signals must arrive before final destination arrival'
  );
  console.log('✅ TEST 7 PASSED: Per-junction arrival times accurately predicted for corridor planning.\n');
}

console.log('====================================================');
console.log('ALL 7 DETERMINISTIC ETA TESTS PASSED PERFECTLY!');
console.log('====================================================');
