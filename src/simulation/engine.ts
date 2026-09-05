/**
 * ResQX Deterministic Local Simulation Engine
 *
 * Runs deterministic city traffic simulation as a robust local fallback
 * when Eclipse SUMO is not actively connected.
 */

import type { Point, Road, SimulationState } from '../types/simulation.ts';
import type { TelemetryData, TelemetrySignal, TelemetryVehicle } from '../types/telemetry.ts';
import { HOSPITAL, roads, signals, vehicles } from './city.ts';
import { getDefaultCityGraph } from '../routing/graph.ts';
import { calculateAmbulanceRoute } from '../routing/engine.ts';
import { calculateAmbulanceEta } from '../routing/eta.ts';

export const INITIAL_ROUTE = ['ROAD-01', 'ROAD-03'];

export const initialState = (): SimulationState => ({
  simulationTime: 0,
  isRunning: false,
  speed: 1,
  roads,
  signals,
  vehicles,
  selectedSignal: 'SIG-01',
  selectedAmbulance: 'AMB-01',
  scenario: 'INITIAL EMERGENCY RUN',
  ambulance: {
    id: 'AMB-01',
    position: { x: 300, y: 40 },
    route: ['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04', 'HOSPITAL'],
    destination: 'HOSPITAL',
    speed: 52,
    status: 'STAGED',
    currentSignal: 'SIG-01',
    progress: 0,
  },
});

export const pointOnRoad = (road: Road, progress: number): Point => {
  const target = Math.max(0, Math.min(1, progress)) * road.length;
  let travelled = 0;
  for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1];
    const end = road.points[index];
    const segment = Math.hypot(end.x - start.x, end.y - start.y);
    if (travelled + segment >= target) {
      const ratio = segment > 0 ? (target - travelled) / segment : 0;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    travelled += segment;
  }
  return road.points[road.points.length - 1];
};

export const tick = (state: SimulationState, deltaSeconds: number): SimulationState => {
  const elapsed = deltaSeconds * state.speed;
  // Scaled for ~125s scenario at 1x, ~62s at 2x, ~25s at 5x
  const progress = Math.min(1, state.ambulance.progress + (elapsed * state.ambulance.speed) / 6500);

  // Dynamic route lookup across 3-road corridor (ROAD-01 → ROAD-03 → ROAD-04)
  // Segment ratios correspond to relative road lengths:
  //   ROAD-01 = 235m  -> 0.44
  //   ROAD-03 = 270m  -> 0.51
  //   ROAD-04 =  15m  -> 0.05
  const routeRoads = ['ROAD-01', 'ROAD-03', 'ROAD-04'];
  let currentRoadId = routeRoads[0];
  let roadProgress = progress * (235 / 520);
  if (progress >= 0.44) {
    currentRoadId = routeRoads[1];
    roadProgress = (progress - 0.44) * (270 / 270);
  }
  if (progress >= 0.95) {
    currentRoadId = routeRoads[2];
    roadProgress = (progress - 0.95) * 1;
  }
  const road = state.roads.find((item) => item.id === currentRoadId) ?? state.roads[0];
  const position = progress >= 1 ? HOSPITAL : pointOnRoad(road, Math.min(1, roadProgress));

  // Signal priority state progression along 4-signal corridor
  const signal =
    progress < 0.22
      ? 'SIG-01'
      : progress < 0.47
      ? 'SIG-02'
      : progress < 0.71
      ? 'SIG-03'
      : progress < 0.96
      ? 'SIG-04'
      : null;

  // Signals are controlled via the canonical Decision Engine -> Safety Validator -> Signal Controller pipeline
  const updatedSignals = state.signals;

  return {
    ...state,
    simulationTime: state.simulationTime + elapsed,
    signals: updatedSignals,
    ambulance: {
      ...state.ambulance,
      progress,
      position,
      currentSignal: signal,
      status: progress >= 1 ? 'ARRIVED' : 'EN_ROUTE',
    },
    vehicles: state.vehicles.map((vehicle) => {
      const redSignal = updatedSignals.find((item) => item.road === vehicle.road && item.state === 'RED');
      const stoppedAtRed = redSignal && vehicle.road === 'ROAD-02' && vehicle.progress >= 0.45 && vehicle.progress <= 0.58;
      return {
        ...vehicle,
        progress: stoppedAtRed ? vehicle.progress : (vehicle.progress + (elapsed * vehicle.speed) / 6500) % 1,
      };
    }),
  };
};

/**
 * Converts internal SimulationState to standard unified TelemetryData contract.
 */
export function simulationStateToTelemetry(state: SimulationState): TelemetryData {
  const graph = getDefaultCityGraph();
  const routeResult = calculateAmbulanceRoute(graph);

  // Determine current road and progress
  // ROAD-01: 0.0 to 0.47 (y=40 to y=275) - 235 units
  // ROAD-03: 0.47 to 1.0 (y=275 to y=545) - 270 units
  // Total: 505 units
  const totalDistance = 505; // 235 (ROAD-01) + 270 (ROAD-03)
  const p = state.ambulance.progress * totalDistance; // Convert progress to actual distance along route

  let currentRoadId = 'ROAD-01';
  let progressOnCurrentRoad = 0;

  if (p <= 235) {
    // On ROAD-01
    currentRoadId = 'ROAD-01';
    progressOnCurrentRoad = p / 235;
  } else {
    // On ROAD-03
    currentRoadId = 'ROAD-03';
    progressOnCurrentRoad = (p - 235) / 270;
  }

  const etaResult = calculateAmbulanceEta({
    routeResult,
    ambulance: {
      speedKmh: state.ambulance.speed,
      currentRoadId,
      progressOnCurrentRoad,
      status: state.ambulance.status,
    },
    signals: [
      { id: 'SIG-01', name: 'North Corridor Signal', road: 'ROAD-01', position: { x: 300, y: 150 } },
      { id: 'SIG-02', name: 'Central Intersection Signal', road: 'ROAD-02', position: { x: 300, y: 275 } },
      { id: 'SIG-03', name: 'Hospital Approach Signal', road: 'ROAD-03', position: { x: 300, y: 400 } },
      { id: 'SIG-04', name: 'South Corridor Signal', road: 'ROAD-03', position: { x: 300, y: 525 } },
    ],
  });

  // Map local simulation coordinates to SUMO viewport coordinates
  // Local Y: 40 (N_START) to 545 (HOSPITAL)
  // SUMO Y: 400.0 (N_START) to 10.0 (HOSPITAL) - note: Y decreases as we go south
  const localY = state.ambulance.position.y;
  const sumoY = 400 - ((localY - 40) / (545 - 40)) * (400 - 10); // Maps 40->545 to 400->10

  const telemetryVehicles: TelemetryVehicle[] = [
    {
      id: 'AMB-01',
      type: 'emergency',
      x: 100.0,
      y: Math.round(sumoY * 10) / 10,
      speedKmh: state.ambulance.status === 'ARRIVED' ? 0 : state.ambulance.speed,
      road: currentRoadId,
      lane: `${currentRoadId}_0`,
      angle: 180.0,
      color: '#FF5451',
    },
    ...state.vehicles.map((v, i) => ({
      id: v.id,
      type: 'car' as const,
      x: 100.0 + (i % 2 === 0 ? -40 : 40),
      y: 200.0 - i * 50,
      speedKmh: v.speed,
      road: v.road,
      lane: `${v.road}_0`,
      angle: 90.0,
      color: v.color,
    })),
  ];

  const telemetrySignals: TelemetrySignal[] = state.signals.map((sig) => {
    let emergencyState = 'NORMAL';
    if (sig.state === 'EMERGENCY_PRIORITY' || (sig.state as string) === 'PRIORITY' || (sig.state as string) === 'PASSING') {
      emergencyState = 'EMERGENCY PRIORITY';
    } else if (sig.state === 'GREEN' || (sig.state as string) === 'PREPARING') {
      emergencyState = 'PREPARING';
    } else if ((sig.state as string) === 'RESTORING' || (sig.state as string) === 'RESTORED') {
      emergencyState = 'RESTORED';
    }

    // Natural corridor priority progression when running in local simulation
    if (state.ambulance.status === 'EN_ROUTE') {
      if (sig.id === 'SIG-01') {
        if (state.ambulance.progress < 0.22) emergencyState = 'EMERGENCY PRIORITY';
        else emergencyState = 'RESTORED';
      } else if (sig.id === 'SIG-02') {
        if (state.ambulance.progress >= 0.20 && state.ambulance.progress < 0.47) emergencyState = 'EMERGENCY PRIORITY';
        else if (state.ambulance.progress >= 0.47) emergencyState = 'RESTORED';
      } else if (sig.id === 'SIG-03') {
        if (state.ambulance.progress >= 0.45 && state.ambulance.progress < 0.71) emergencyState = 'EMERGENCY PRIORITY';
        else if (state.ambulance.progress >= 0.71) emergencyState = 'RESTORED';
      } else if (sig.id === 'SIG-04') {
        // SIG-04 is on ROAD-03 at local Y=525
        // Progress on ROAD-03: 0 = y=275 (SIG-01 area), 1 = y=545 (hospital)
        // SIG-04 at local Y=525 is at progress = (525-275)/(545-275) = 250/270 ≈ 0.926
        const sig04ProgressOnRoad03 = (525 - 275) / (545 - 275); // 250/270 ≈ 0.9259
        if (state.ambulance.progress >= 0.47 && state.ambulance.progress < 0.47 + sig04ProgressOnRoad03 * 0.53) {
          // Approaching SIG-04 on ROAD-03
          emergencyState = 'EMERGENCY PRIORITY';
        } else if (state.ambulance.progress >= 0.47 + sig04ProgressOnRoad03 * 0.53) {
          // Passed SIG-04
          emergencyState = 'RESTORED';
        }
      }
    } else if (state.ambulance.status === 'ARRIVED') {
      emergencyState = 'RESTORED';
    }

    return {
      id: sig.id,
      state: emergencyState === 'EMERGENCY PRIORITY' ? 'GGGrr' : sig.state === 'RED' ? 'rrrGG' : 'GGGrr',
      emergencyState,
      distanceFromAmbulance: Math.hypot(
        sig.position.x - state.ambulance.position.x,
        sig.position.y - state.ambulance.position.y
      ),
    };
  });

  // Determine next signal based on progress
  const progress = state.ambulance.progress;
  let nextSignal: string | null = null;
  if (progress < 0.22) {
    nextSignal = 'SIG-01';
  } else if (progress < 0.47) {
    nextSignal = 'SIG-02';
  } else {
    // On ROAD-03
    const progressOnRoad03 = (progress - 0.47) / 0.53; // 0 to 1 along ROAD-03
    if (progressOnRoad03 < 0.463) { // Before SIG-03 (y=400 is 46.3% of ROAD-03: (400-275)/270 = 125/270 ≈ 0.463)
      nextSignal = 'SIG-03';
    } else if (progressOnRoad03 < 0.926) { // Before SIG-04 (y=525 is 92.6% of ROAD-03: (525-275)/270 = 250/270 ≈ 0.926)
      nextSignal = 'SIG-04';
    } else {
      nextSignal = 'HOSPITAL';
    }
  }

  let distToNext = 0;
  if (nextSignal === 'SIG-01') distToNext = Math.max(0, 275 - state.ambulance.position.y); // Distance to y=275 on ROAD-01
  else if (nextSignal === 'SIG-02') distToNext = Math.max(0, Math.abs(275 - state.ambulance.position.y)); // On ROAD-02 or approaching
  else if (nextSignal === 'SIG-03') distToNext = Math.max(0, 400 - state.ambulance.position.y); // Distance to y=400
  else if (nextSignal === 'SIG-04') distToNext = Math.max(0, 525 - state.ambulance.position.y); // Distance to y=525
  else distToNext = Math.max(0, 545 - state.ambulance.position.y); // Distance to y=545 (hospital)

  if (state.ambulance.status === 'ARRIVED') {
    distToNext = 0;
  }

  const signalsPrioritized = telemetrySignals.filter(
    (s) => s.emergencyState === 'EMERGENCY PRIORITY' || (s.emergencyState as string) === 'PRIORITY'
  ).length;
  const intersectionsCleared =
    state.ambulance.progress >= 0.96 ? 4 : state.ambulance.progress >= 0.71 ? 3 : state.ambulance.progress >= 0.47 ? 2 : state.ambulance.progress >= 0.22 ? 1 : 0;

  const remainingEtaSeconds = Math.max(0, Math.round((1 - state.ambulance.progress) * 125));
  const etaSeconds = Number.isFinite(etaResult.estimatedTravelTime) && etaResult.estimatedTravelTime > 0
    ? Math.round(etaResult.estimatedTravelTime)
    : remainingEtaSeconds;

  return {
    simulation: {
      running: state.isRunning,
      step: Math.round(state.simulationTime),
      elapsedTime: Math.round(state.simulationTime * 10) / 10,
      speed: state.speed,
    },
    ambulance: {
      id: 'AMB-01',
      status: state.ambulance.status,
      x: 100.0,
      y: Math.round(sumoY * 10) / 10,
      speedKmh: state.ambulance.status === 'ARRIVED' ? 0 : state.ambulance.speed,
      angle: 180.0,
      currentRoad: currentRoadId,
      nextSignal,
      distanceToNextSignal: Math.round(distToNext),
      etaSeconds,
    },
    signals: telemetrySignals,
    traffic: {
      level: 'MODERATE',
      vehicleCount: telemetryVehicles.length,
      vehicles: telemetryVehicles,
    },
    mission: {
      origin: 'N_START',
      destination: 'HOSPITAL',
      elapsedTime: Math.round(state.simulationTime * 10) / 10,
      estimatedNormalTime: 180.0,
      estimatedResQXTime: 125.0,
      timeSaved: Math.max(0, Math.round(state.ambulance.progress * 55.0 * 10) / 10),
      signalsPrioritized,
      intersectionsCleared,
    },
  };
}