import type {
  DecisionState,
  SimulationState,
} from '../types/simulation';
import type { Telemetry } from '../types/telemetry';

/**
 * RESQX DECISION ENGINE
 *
 * Lightweight, deterministic and explainable rules.
 *
 * This is NOT machine learning.
 *
 * Responsibilities:
 * - Read current telemetry
 * - Identify the ambulance's next signal
 * - Request emergency signal priority
 * - Request restoration after the ambulance has arrived
 *
 * NOT responsible for:
 * - Dijkstra routing
 * - traffic-aware route scoring
 * - ETA calculation
 * - corridor planning
 * - green-wave scheduling
 */
export const evaluateDecision = (
  telemetry: Telemetry,
  state: SimulationState,
): DecisionState => {
  const nextSignal = telemetry.route.nextSignal;

  // Ambulance has completed the mission.
  if (telemetry.ambulance.emergencyStatus === 'ARRIVED') {
    return {
      action: 'RESTORE_SIGNAL',
      signalId: null,
      reason: 'Ambulance has reached the destination',
    };
  }

  // No upcoming signal.
  if (!nextSignal) {
    return {
      action: 'NO_ACTION',
      signalId: null,
      reason: 'No upcoming signal detected',
    };
  }

  const signal = telemetry.signals.find(
    (item) => item.id === nextSignal,
  );

  // Telemetry references a signal that does not exist.
  if (!signal) {
    return {
      action: 'NO_ACTION',
      signalId: nextSignal,
      reason: 'Upcoming signal is not present in telemetry',
    };
  }

  // Do not repeatedly request priority for a signal
  // that is already handling the emergency.
  if (
    signal.state === 'PRIORITY' ||
    signal.state === 'PASSING' ||
    signal.state === 'PREPARING'
  ) {
    return {
      action: 'NO_ACTION',
      signalId: signal.id,
      reason: `Signal ${signal.id} already has an active emergency state`,
    };
  }

  // Emergency vehicle is actively approaching the signal.
  if (
    telemetry.ambulance.emergencyStatus === 'EN_ROUTE' ||
    state.ambulance.status === 'EN_ROUTE'
  ) {
    return {
      action: 'REQUEST_PRIORITY',
      signalId: signal.id,
      reason: `Emergency ambulance approaching ${signal.id}`,
    };
  }

  return {
    action: 'NO_ACTION',
    signalId: signal.id,
    reason: 'Emergency vehicle is not currently requesting priority',
  };
};