/**
 * ResQX Shared Types — Simulation Contracts
 *
 * These types define the integration boundary between the simulation engine,
 * the frontend UI, and the AI/backend systems.
 *
 * Rules:
 * - NO simulation algorithms in this file
 * - NO UI logic in this file
 * - These are pure data contracts
 */

// ─── Primitives ──────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

// ─── Signal Types ────────────────────────────────────────────────────

export type SignalState =
  | 'NORMAL'
  | 'RED'
  | 'GREEN'
  | 'PREPARING'
  | 'PRIORITY'
  | 'PASSING'
  | 'RESTORING'
  | 'EMERGENCY_PRIORITY';

export interface TrafficSignal {
  id: string;
  name: string;
  position: Point;
  state: SignalState;
  road: string;
  queueLength: number;
  distanceFromAmbulance?: number;
}

/** @deprecated Use TrafficSignal instead. Kept for backward compatibility. */
export type Signal = TrafficSignal;

// ─── Road & Route ────────────────────────────────────────────────────

export interface Road {
  id: string;
  name: string;
  points: Point[];
  length: number;
}

export type CongestionLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface Route {
  id: string;
  name: string;
  roads: string[];
  signals: string[];
  distance: number;
  estimatedTime: number;
  congestion: CongestionLevel;
}

// ─── Vehicles ────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  road: string;
  progress: number;
  speed: number;
  color: string;
}

export type AmbulanceStatus = 'STAGED' | 'EN_ROUTE' | 'ARRIVED';

export interface Ambulance {
  id: string;
  position: Point;
  route: string[];
  destination: string;
  speed: number;
  status: AmbulanceStatus;
  currentSignal: string | null;
  progress: number;
  eta?: number;
}

// ─── Traffic ─────────────────────────────────────────────────────────

export interface TrafficState {
  vehicleCount: number;
  congestionLevel: CongestionLevel;
  averageSpeed?: number;
  density?: number;
}

// ─── Officer ─────────────────────────────────────────────────────────

export interface Officer {
  id: string;
  name: string;
  role: string;
  sector: string;
  onDuty: boolean;
}

// ─── Simulation State ────────────────────────────────────────────────

export interface SimulationState {
  simulationTime: number;
  isRunning: boolean;
  speed: 1 | 2 | 5;
  ambulance: Ambulance;
  vehicles: Vehicle[];
  signals: TrafficSignal[];
  roads: Road[];
  selectedSignal: string | null;
  selectedAmbulance: string | null;
  scenario: string;
  route?: Route;
  traffic?: TrafficState;
}