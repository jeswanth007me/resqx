/**
 * ResQX Ambulance ETA Types
 *
 * Defines contracts for deterministic travel time calculations,
 * remaining distance tracking, and per-junction arrival predictions.
 */

import type { Point } from './simulation.ts';
import type { RouteResult, RoadEdge } from './routing.ts';

export interface JunctionArrival {
  signalId: string;
  name: string;
  roadId: string;
  position?: Point;
  distanceFromAmbulance: number; // in meters
  predictedArrivalSeconds: number; // relative seconds from now
  predictedArrivalSimulationTime?: number; // absolute simulation clock seconds
}

export interface PerRoadEta {
  roadId: string;
  roadName: string;
  remainingDistance: number; // in meters
  estimatedTravelTime: number; // in seconds
  baseTravelTime: number; // in seconds (free-flow kinematic)
  trafficDelay: number; // in seconds
  signalDelay: number; // in seconds
  isCurrentRoad: boolean;
  isCompleted: boolean;
}

export interface EtaCostBreakdown {
  freeFlowTime: number; // Distance / effectiveSpeed
  trafficDelay: number;
  signalDelay: number;
  totalEstimatedTime: number;
}

export interface AmbulanceTelemetryInput {
  id?: string;
  position?: Point;
  currentRoadId?: string;
  speedKmh?: number; // Speed in km/h
  speedMs?: number; // Speed in m/s
  progressOnCurrentRoad?: number; // 0.0 to 1.0
  status?: string; // 'STAGED' | 'EN_ROUTE' | 'ARRIVED'
}

export interface SignalInput {
  id: string;
  name?: string;
  position?: Point;
  road: string;
  state?: string;
  queueLength?: number;
  distanceFromAmbulance?: number;
}

export interface EtaInput {
  routeResult: RouteResult;
  ambulance?: AmbulanceTelemetryInput;
  signals?: SignalInput[];
  currentSimulationTime?: number;
  defaultCruisingSpeedKmh?: number; // Default emergency speed when stopped/staged (e.g. 50 km/h)
}

export interface EtaResult {
  success: boolean;
  totalRemainingDistance: number; // in meters
  estimatedTravelTime: number; // in seconds
  formattedEta: string; // MM:SS format (e.g., "00:45")
  effectiveSpeedKmh: number; // Speed used for calculation in km/h
  effectiveSpeedMs: number; // Speed used for calculation in m/s
  isArrived: boolean;
  costBreakdown: EtaCostBreakdown;
  perRoadEta: PerRoadEta[];
  junctionArrivals: JunctionArrival[];
  assumptions: string;
  edges: RoadEdge[];
}
