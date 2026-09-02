import { useEffect, useReducer } from 'react';
import { initialState, tick } from '../simulation/engine';
import { buildTelemetry } from '../telemetry/buildTelemetry';
import { evaluateDecision } from '../decision/decisionEngine';
import { validateSignalAction } from '../safety/safetyValidator';
import {
  advanceSignalStates,
  applySignalDecision,
} from '../signal/signalController';
import type { SimulationState } from '../types/simulation';

type Action =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | {
      type: 'SPEED';
      speed: SimulationState['speed'];
    }
  | {
      type: 'EMERGENCY_START';
    }
  | {
      type: 'SCENARIO';
      scenario: string;
    }
  | {
      type: 'TICK';
      delta: number;
    };
const reducer = (
  state: SimulationState,
  action: Action,
): SimulationState => {
  if (action.type === 'START') {
    return {
      ...state,
      isRunning: true,
    };
  }

  if (action.type === 'PAUSE') {
    return {
      ...state,
      isRunning: false,
    };
  }

  if (action.type === 'RESET') {
    return initialState();
  }

  if (action.type === 'SPEED') {
    return {
      ...state,
      speed: action.speed,
    };
  }
if (action.type === 'EMERGENCY_START') {
  return {
    ...state,
    isRunning: true,
    ambulance: {
      ...state.ambulance,
      status: 'EN_ROUTE',
    },
  };
}

if (action.type === 'SCENARIO') {
  return {
    ...state,
    scenario: action.scenario,
  };
}

  if (action.type === 'TICK') {
    if (!state.isRunning) {
      return state;
    }

    // 1. Advance the existing simulation.
    let nextState = tick(
  state,
  action.delta,
);

nextState = advanceSignalStates(
  nextState,
);

    // 2. Convert simulation state into the
    // existing ResQX telemetry contract.
    const telemetry = buildTelemetry(
      nextState,
    );

    // 3. Run the ResQX Decision Engine.
    const decision = evaluateDecision(
      telemetry,
      nextState,
    );

    // 4. Validate the requested signal action
    // before allowing it to modify simulation state.
    const safety = validateSignalAction(
      nextState,
      decision,
    );

    // 5. Only approved decisions can reach
    // the signal-control layer.
    if (safety.status === 'APPROVED') {
      const controlledState =
        applySignalDecision(
          nextState,
          decision,
        );

      return {
        ...controlledState,
        decision,
        safety,
      };
    }

    // 6. Blocked or idle decisions do not
    // modify the signal state.
    return {
      ...nextState,
      decision,
      safety,
    };
  }

  return state;
};

export const useSimulation = () => {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    initialState,
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      dispatch({
        type: 'TICK',
        delta: 0.1,
      });
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return {
    state,
    dispatch,
  };
};