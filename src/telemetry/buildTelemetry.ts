import type { SimulationState } from '../types/simulation';
import type { Telemetry } from '../types/telemetry';

const SIGNAL_PROGRESS: Record<string, number> = {
  'SIG-01': 1 / 6,
  'SIG-02': 1 / 3,
  'SIG-03': 2 / 3,
};

export const buildTelemetry = (
  state: SimulationState,
): Telemetry => {
  const nextSignal = state.ambulance.currentSignal;

  const signalProgress = nextSignal
    ? SIGNAL_PROGRESS[nextSignal]
    : undefined;

  const remainingProgress =
    signalProgress !== undefined
      ? Math.max(
          0,
          signalProgress - state.ambulance.progress,
        )
      : 0;

  const eta =
    nextSignal && signalProgress !== undefined
      ? Math.max(
          0,
          Math.round(
            (remainingProgress * 900) /
              state.ambulance.speed,
          ),
        )
      : 0;

  return {
    timestamp: state.simulationTime,

    ambulance: {
      id: state.ambulance.id,
      position: state.ambulance.position,
      speed: state.ambulance.speed,
      destination: state.ambulance.destination,
      eta,
      emergencyStatus: state.ambulance.status,
    },

    route: {
      currentRoad:
        state.roads[
          Math.min(
            2,
            Math.floor(state.ambulance.progress * 3),
          )
        ]?.id ?? 'ROAD-03',

      nextSignal,

      remainingDistance: Math.max(
        0,
        Math.round(
          (1 - state.ambulance.progress) * 760,
        ),
      ),
    },

    signals: state.signals.map((signal) => ({
      id: signal.id,
      state: signal.state,
      distanceFromAmbulance: Math.round(
        Math.hypot(
          signal.position.x -
            state.ambulance.position.x,
          signal.position.y -
            state.ambulance.position.y,
        ),
      ),
      queueLength: signal.queueLength,
    })),

    traffic: {
      vehicleCount: state.vehicles.length,
      congestionLevel:
        state.vehicles.length > 6
          ? 'HIGH'
          : state.vehicles.length > 3
            ? 'MODERATE'
            : 'LOW',
    },
  };
};