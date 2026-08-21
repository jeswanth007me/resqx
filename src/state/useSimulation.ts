import { useEffect, useReducer } from 'react';
import { initialState, tick } from '../simulation/engine';
import type { SimulationState } from '../types/simulation';
type Action = { type: 'START' } | { type: 'PAUSE' } | { type: 'RESET' } | { type: 'SPEED'; speed: SimulationState['speed'] } | { type: 'TICK'; delta: number };
const reducer = (state: SimulationState, action: Action): SimulationState => action.type === 'START' ? { ...state, isRunning: true } : action.type === 'PAUSE' ? { ...state, isRunning: false } : action.type === 'RESET' ? initialState() : action.type === 'SPEED' ? { ...state, speed: action.speed } : state.isRunning ? tick(state, action.delta) : state;
export const useSimulation = () => { const [state, dispatch] = useReducer(reducer, undefined, initialState); useEffect(() => { const interval = window.setInterval(() => dispatch({ type: 'TICK', delta: .1 }), 100); return () => window.clearInterval(interval); }, []); return { state, dispatch }; };