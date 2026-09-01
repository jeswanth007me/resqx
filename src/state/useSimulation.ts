import { useEffect, useReducer } from 'react';
import { initialState, tick } from '../simulation/engine';
import type { SimulationState, SignalState } from '../types/simulation';

export type Action =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SPEED'; speed: SimulationState['speed'] }
  | { type: 'TICK'; delta: number }
  | { type: 'OVERRIDE_SIGNAL'; signalId: string; state: SignalState };

const reducer = (state: SimulationState, action: Action): SimulationState => {
  if (action.type === 'START') return { ...state, isRunning: true };
  if (action.type === 'PAUSE') return { ...state, isRunning: false };
  if (action.type === 'RESET') return initialState();
  if (action.type === 'SPEED') return { ...state, speed: action.speed };
  if (action.type === 'OVERRIDE_SIGNAL') {
    return {
      ...state,
      signals: state.signals.map(sig =>
        sig.id === action.signalId ? { ...sig, state: action.state } : sig
      )
    };
  }
  if (action.type === 'TICK') return state.isRunning ? tick(state, action.delta) : state;
  return state;
};

export const useSimulation = () => {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    const interval = window.setInterval(() => dispatch({ type: 'TICK', delta: .1 }), 100);
    return () => window.clearInterval(interval);
  }, []);

  return { state, dispatch };
};