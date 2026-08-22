import type { SimulationState } from '../types/simulation';
import type { TelemetryData } from '../types/telemetry';

export const buildTelemetry = (state: SimulationState): TelemetryData => ({
  simulation: {
    running: state.isRunning,
    step: Math.floor(state.simulationTime),
    elapsedTime: state.simulationTime,
  },
  ambulance: {
    id: state.ambulance.id,
    status: state.ambulance.status,
    x: state.ambulance.position.x,
    y: state.ambulance.position.y,
    speedKmh: state.ambulance.speed,
    currentRoad: state.roads[Math.min(2, Math.floor(state.ambulance.progress * 3))]?.id ?? 'E_CORRIDOR_1',
    nextSignal: state.ambulance.currentSignal ?? 'SIG-01',
    distanceToNextSignal: Math.max(0, Math.round((1 - state.ambulance.progress) * 100)),
    etaSeconds: Math.max(0, Math.round((1 - state.ambulance.progress) * 28)),
  },
  signals: state.signals.map((signal) => ({
    id: signal.id,
    state: signal.state,
    emergencyState: signal.state === 'EMERGENCY_PRIORITY' ? 'EMERGENCY PRIORITY' : 'NORMAL',
    distanceFromAmbulance: Math.round(Math.hypot(signal.position.x - state.ambulance.position.x, signal.position.y - state.ambulance.position.y)),
  })),
  traffic: {
    level: state.vehicles.length > 6 ? 'HIGH' : state.vehicles.length > 3 ? 'MODERATE' : 'LOW',
    vehicleCount: state.vehicles.length,
    vehicles: [
      {
        id: state.ambulance.id,
        type: 'emergency',
        x: state.ambulance.position.x,
        y: state.ambulance.position.y,
        speedKmh: state.ambulance.speed,
        road: 'E_CORRIDOR_1',
        lane: 'E_CORRIDOR_1_0',
        angle: 180,
      },
      ...state.vehicles.map((v) => ({
        id: v.id,
        type: 'car' as const,
        x: 100 + (v.progress * 300),
        y: 200,
        speedKmh: v.speed,
        road: v.road,
        lane: `${v.road}_0`,
        angle: 90,
        color: v.color,
      })),
    ],
  },
  mission: {
    origin: 'N_START',
    destination: state.ambulance.destination,
    elapsedTime: state.simulationTime,
    estimatedNormalTime: 45.0,
    estimatedResQXTime: 28.0,
    timeSaved: Math.max(0, Math.round(45.0 - state.simulationTime)),
    signalsPrioritized: 2,
    intersectionsCleared: state.ambulance.progress >= 1 ? 2 : state.ambulance.progress >= 0.5 ? 1 : 0,
  },
});