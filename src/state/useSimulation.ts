import { useEffect, useReducer } from 'react';
import { initialState, tick } from '../simulation/engine';
import { buildTelemetry } from '../telemetry/buildTelemetry';
import { evaluateDecision } from '../decision/decisionEngine';
import { validateSignalAction } from '../safety/safetyValidator';
import { MockSignalHardwareAdapter } from '../hardware';
import {
advanceSignalStates,
applySignalDecision,
} from '../signal/signalController';
import type { EmergencyEvent } from '../types/events';
import type { SimulationState } from '../types/simulation';

const hardwareAdapter = new MockSignalHardwareAdapter();

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

// 1. Advance the simulation.
let nextState = tick(
  state,
  action.delta,
);

nextState = advanceSignalStates(
  nextState,
);

// 2. Build telemetry from the updated simulation.
const telemetry = buildTelemetry(
  nextState,
);

// 3. Evaluate the emergency decision.
const decision = evaluateDecision(
  telemetry,
  nextState,
);

// 4. Validate the decision before changing signals.
const safety = validateSignalAction(
  nextState,
  decision,
);

let controlledState = nextState;

// 5. Create persistent audit events.
const newEvents: EmergencyEvent[] = [];

// 6. Apply only approved signal actions.
if (
  safety.status === 'APPROVED' &&
  decision.signalId
) {
  controlledState = applySignalDecision(
    nextState,
    decision,
  );

  const controlledSignal =
    controlledState.signals.find(
      (signal) =>
        signal.id === decision.signalId,
    );

  if (controlledSignal) {
    /*
     * The simulation supports RED/GREEN for
     * normal traffic, while the hardware adapter
     * only accepts emergency-control states.
     *
     * Therefore RED/GREEN are represented as
     * NORMAL at the hardware boundary.
     */
    const hardwareState =
      controlledSignal.state === 'RED' ||
      controlledSignal.state === 'GREEN'
        ? 'NORMAL'
        : controlledSignal.state;

    void hardwareAdapter.sendCommand({
      signalId: controlledSignal.id,
      state: hardwareState,
      timestamp:
        controlledState.simulationTime,
    });

    newEvents.push({
      id: `hardware-${controlledState.simulationTime}`,
      timestamp:
        controlledState.simulationTime,
      type: 'HARDWARE_SIGNAL_COMMAND_SENT',
      description:
        `${controlledSignal.id} hardware command sent: ${hardwareState}`,
      severity: 'SUCCESS',
      relatedSignal: controlledSignal.id,
      relatedUnit:
        controlledState.ambulance.id,
    });
  }
}

// 7. Record priority request.
if (decision.action === 'REQUEST_PRIORITY') {
  newEvents.push({
    id: `priority-${nextState.simulationTime}`,
    timestamp: nextState.simulationTime,
    type: 'SIGNAL_PRIORITY_REQUESTED',
    description:
      `${decision.signalId} Priority Requested`,
    severity: 'WARNING',
    relatedSignal:
      decision.signalId ?? undefined,
    relatedUnit:
      nextState.ambulance.id,
  });
}

// 8. Record approved decision.
if (
  decision.action !== 'NO_ACTION' &&
  safety.status === 'APPROVED'
) {
  newEvents.push({
    id: `approved-${nextState.simulationTime}`,
    timestamp: nextState.simulationTime,
    type: 'SIGNAL_ACTION_APPROVED',
    description: safety.reason,
    severity: 'SUCCESS',
    relatedSignal:
      decision.signalId ?? undefined,
    relatedUnit:
      nextState.ambulance.id,
  });
}

// 9. Record blocked decision.
if (
  decision.action !== 'NO_ACTION' &&
  safety.status === 'BLOCKED'
) {
  newEvents.push({
    id: `blocked-${nextState.simulationTime}`,
    timestamp: nextState.simulationTime,
    type: 'SIGNAL_ACTION_BLOCKED',
    description: safety.reason,
    severity: 'CRITICAL',
    relatedSignal:
      decision.signalId ?? undefined,
    relatedUnit:
      nextState.ambulance.id,
  });
}

return {
  ...controlledState,
  decision,
  safety,
  events: [
    ...state.events,
    ...newEvents,
  ],
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
