import type {
  DecisionState,
  SignalState,
  SimulationState,
} from '../types/simulation';

const PREPARING_SECONDS = 2;
const PRIORITY_SECONDS = 3;
const PASSING_SECONDS = 2;
const RESTORING_SECONDS = 2;

type SignalTiming = {
  state: SignalState;
  startedAt: number;
};

const signalTimers = new Map<string, SignalTiming>();

const getDuration = (
  state: SignalState,
): number => {
  switch (state) {
    case 'PREPARING':
      return PREPARING_SECONDS;

    case 'PRIORITY':
      return PRIORITY_SECONDS;

    case 'PASSING':
      return PASSING_SECONDS;

    case 'RESTORING':
      return RESTORING_SECONDS;

    default:
      return 0;
  }
};

const getNextState = (
  state: SignalState,
): SignalState => {
  switch (state) {
    case 'PREPARING':
      return 'PRIORITY';

    case 'PRIORITY':
      return 'PASSING';

    case 'PASSING':
      return 'RESTORING';

    case 'RESTORING':
      return 'NORMAL';

    default:
      return state;
  }
};

export const applySignalDecision = (
  state: SimulationState,
  decision: DecisionState,
): SimulationState => {
  if (
    decision.action === 'REQUEST_PRIORITY' &&
    decision.signalId
  ) {
    const signal = state.signals.find(
      (item) => item.id === decision.signalId,
    );

    if (!signal) {
      return state;
    }

    signalTimers.set(signal.id, {
      state: 'PREPARING',
      startedAt: state.simulationTime,
    });

    return {
      ...state,

      signals: state.signals.map((item) =>
        item.id === signal.id
          ? {
              ...item,
              state: 'PREPARING',
            }
          : item,
      ),
    };
  }

  if (decision.action === 'RESTORE_SIGNAL') {
    return {
      ...state,

      signals: state.signals.map((signal) => {
        if (
          signal.state === 'PREPARING' ||
          signal.state === 'PRIORITY' ||
          signal.state === 'PASSING'
        ) {
          signalTimers.set(signal.id, {
            state: 'RESTORING',
            startedAt: state.simulationTime,
          });

          return {
            ...signal,
            state: 'RESTORING',
          };
        }

        return signal;
      }),
    };
  }

  return state;
};

export const advanceSignalStates = (
  state: SimulationState,
): SimulationState => {
  let changed = false;

  const signals = state.signals.map((signal) => {
    const timer = signalTimers.get(signal.id);

    if (!timer || timer.state !== signal.state) {
      return signal;
    }

    const duration = getDuration(signal.state);

    if (
      duration <= 0 ||
      state.simulationTime - timer.startedAt < duration
    ) {
      return signal;
    }

    const nextState = getNextState(
      signal.state,
    );

    changed = true;

    if (nextState === 'NORMAL') {
      signalTimers.delete(signal.id);
    } else {
      signalTimers.set(signal.id, {
        state: nextState,
        startedAt: state.simulationTime,
      });
    }

    return {
      ...signal,
      state: nextState,
    };
  });

  return changed
    ? {
        ...state,
        signals,
      }
    : state;
};