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
    route: ['SIG-01', 'SIG-03', 'HOSPITAL'],
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

  // Dynamic route lookup
  const routeRoads = ['ROAD-01', 'ROAD-03'];
  const currentRoadId = progress < 0.5 ? routeRoads[0] : routeRoads[1];
  const road = state.roads.find((item) => item.id === currentRoadId) ?? state.roads[0];
  const roadProgress = progress < 0.5 ? progress * 2 : (progress - 0.5) * 2;
  const position = progress >= 1 ? HOSPITAL : pointOnRoad(road, roadProgress);

  // Signal priority state progression along route
  const signal = progress < 0.45 ? 'SIG-01' : progress < 0.95 ? 'SIG-03' : null;

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
  const currentRoadId = state.ambulance.progress < 0.5 ? 'ROAD-01' : 'ROAD-03';
  const progressOnCurrentRoad = state.ambulance.progress < 0.5 ? state.ambulance.progress * 2 : (state.ambulance.progress - 0.5) * 2;

  const etaResult = calculateAmbulanceEta({
    routeResult,
    ambulance: {
      speedKmh: state.ambulance.speed,
      currentRoadId,
      progressOnCurrentRoad,
      status: state.ambulance.status,
    },
    signals: [
      { id: 'SIG-01', name: 'North Corridor Signal', road: 'ROAD-01' },
      { id: 'SIG-03', name: 'Central Junction Signal', road: 'ROAD-03' },
    ],
  });

  // Map 2D coordinates (300, y) to SUMO viewport coordinates (100, 300 -> 100, 0)
  const sumoY = 300 - (state.ambulance.position.y / 545) * 300;

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

    return {
      id: sig.id,
      state: sig.state === 'RED' ? 'rrrGG' : 'GGGrr',
      emergencyState,
      distanceFromAmbulance: Math.hypot(
        sig.position.x - state.ambulance.position.x,
        sig.position.y - state.ambulance.position.y
      ),
    };
  });

  const nextSignal = state.ambulance.progress < 0.45 ? 'SIG-01' : state.ambulance.progress < 0.95 ? 'SIG-03' : 'HOSPITAL';
  const distToNext = nextSignal === 'SIG-01' ? Math.max(0, 150 - state.ambulance.position.y) : nextSignal === 'SIG-03' ? Math.max(0, 400 - state.ambulance.position.y) : 0;

  const signalsPrioritized = state.signals.filter((s) => s.state === 'EMERGENCY_PRIORITY' || (s.state as string) === 'PRIORITY').length;
  const intersectionsCleared = state.ambulance.progress >= 0.95 ? 2 : state.ambulance.progress >= 0.45 ? 1 : 0;

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