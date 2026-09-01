import type {
  DecisionState,
  SimulationState,
} from '../types/simulation';

export const applySignalDecision = (
  state: SimulationState,
  decision: DecisionState,
): SimulationState => {
  if (
    decision.action === 'REQUEST_PRIORITY' &&
    decision.signalId
  ) {
    return {
      ...state,
      signals: state.signals.map((signal) =>
        signal.id === decision.signalId
          ? {
              ...signal,
              state:
                signal.state === 'PREPARING'
                  ? 'PRIORITY'
                  : 'PREPARING',
            }
          : signal,
      ),
    };
  }

  if (decision.action === 'RESTORE_SIGNAL') {
    return {
      ...state,
      signals: state.signals.map((signal) =>
        signal.state === 'PRIORITY' ||
        signal.state === 'PASSING' ||
        signal.state === 'PREPARING'
          ? {
              ...signal,
              state: 'RESTORING',
            }
          : signal,
      ),
    };
  }

  return state;
};