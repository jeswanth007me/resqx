import type {
  DecisionState,
  SafetyState,
  SignalState,
  SimulationState,
} from '../types/simulation';

const VALID_TRANSITIONS: Record<SignalState, SignalState[]> = {
  NORMAL: ['PREPARING'],
  RED: ['PREPARING'],
  GREEN: ['PREPARING'],
  PREPARING: ['PRIORITY', 'NORMAL'],
  PRIORITY: ['PASSING', 'RESTORING'],
  PASSING: ['RESTORING'],
  RESTORING: ['NORMAL'],
};

export const validateSignalAction = (
  state: SimulationState,
  decision: DecisionState,
): SafetyState => {
  if (decision.action === 'NO_ACTION') {
    return {
      status: 'IDLE',
      reason: 'No signal action requested',
    };
  }

  if (decision.action === 'RESTORE_SIGNAL') {
    const activePriority = state.signals.some(
      (signal) =>
        signal.state === 'PRIORITY' ||
        signal.state === 'PASSING' ||
        signal.state === 'PREPARING',
    );

    if (!activePriority) {
      return {
        status: 'BLOCKED',
        reason: 'No active emergency signal requires restoration',
      };
    }

    return {
      status: 'APPROVED',
      reason: 'Signal restoration is safe to request',
    };
  }

  if (
    decision.action === 'REQUEST_PRIORITY' &&
    decision.signalId
  ) {
    const signal = state.signals.find(
      (item) => item.id === decision.signalId,
    );

    if (!signal) {
      return {
        status: 'BLOCKED',
        reason: `Signal ${decision.signalId} does not exist`,
      };
    }

    const allowed = VALID_TRANSITIONS[signal.state].includes(
      'PREPARING',
    );

    if (!allowed) {
      return {
        status: 'BLOCKED',
        reason: `Invalid transition from ${signal.state} to PREPARING`,
      };
    }

    const anotherPrioritySignal = state.signals.some(
      (item) =>
        item.id !== signal.id &&
        (item.state === 'PRIORITY' ||
          item.state === 'PASSING'),
    );

    if (anotherPrioritySignal) {
      return {
        status: 'BLOCKED',
        reason: 'Another emergency signal action is already active',
      };
    }

    return {
      status: 'APPROVED',
      reason: `Signal ${signal.id} passed safety validation`,
    };
  }

  return {
    status: 'BLOCKED',
    reason: 'Unsupported signal action',
  };
};