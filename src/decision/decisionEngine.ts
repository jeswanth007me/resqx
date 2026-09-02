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
 * - Validate the ETA received from telemetry
 * - Decide when emergency priority should be requested
 * - Request restoration after the ambulance has arrived
 *
 * NOT responsible for:
 * - Dijkstra routing
 * - traffic-aware route scoring
 * - ETA calculation
 * - corridor planning
 * - green-wave scheduling
 */

const PRIORITY_TRIGGER_ETA_SECONDS = 5;

export const evaluateDecision = (
  telemetry: Telemetry,
  state: SimulationState,
): DecisionState => {
  const nextSignal = telemetry.route.nextSignal;
  const eta = telemetry.ambulance.eta;

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

  // Telemetry references a signal that does not exist.
  const signal = telemetry.signals.find(
    (item) => item.id === nextSignal,
  );

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
    signal.state === 'PREPARING' ||
    signal.state === 'PRIORITY' ||
    signal.state === 'PASSING'
  ) {
    return {
      action: 'NO_ACTION',
      signalId: signal.id,
      reason: `Signal ${signal.id} already has an active emergency state`,
    };
  }

  // Only an actively travelling ambulance can trigger
  // predictive emergency priority.
  if (
    telemetry.ambulance.emergencyStatus !== 'EN_ROUTE' &&
    state.ambulance.status !== 'EN_ROUTE'
  ) {
    return {
      action: 'NO_ACTION',
      signalId: signal.id,
      reason: 'Emergency vehicle is not currently requesting priority',
    };
  }

  // Never make a priority decision using invalid ETA data.
  if (!Number.isFinite(eta) || eta < 0) {
    return {
      action: 'NO_ACTION',
      signalId: signal.id,
      reason: 'Ambulance ETA is unavailable or invalid',
    };
  }

  // ETA is still outside the priority trigger window.
  // Continue monitoring rather than activating the signal early.
  if (eta > PRIORITY_TRIGGER_ETA_SECONDS) {
    return {
      action: 'NO_ACTION',
      signalId: signal.id,
      reason:
        `Ambulance ETA to ${signal.id} is ${eta.toFixed(1)}s; ` +
        `continue monitoring`,
    };
  }

  // Ambulance is close enough that signal preparation
  // should begin now.
  return {
    action: 'REQUEST_PRIORITY',
    signalId: signal.id,
    reason:
      `Ambulance ETA to ${signal.id} is ${eta.toFixed(1)}s; ` +
      `priority threshold reached`,
  };
};