/**
 * ResQX — Unified Telemetry Contract
 *
 * Single source of truth shared between SUMO, AI/Backend, and React.
 */

export interface TelemetryVehicle {
  id: string;
  type: 'emergency' | 'car';
  x: number;
  y: number;
  speedKmh: number;
  road: string;
  lane: string;
  angle: number;
  color?: string;
}

export interface TelemetrySignal {
  id: string;
  state: string; // SUMO TL raw string e.g. "GGGrr"
  emergencyState: string; // "NORMAL" | "PREPARING" | "EMERGENCY PRIORITY" | "RESTORED"
  distanceFromAmbulance: number;
}

export interface TelemetryData {
  simulation: {
    running: boolean;
    step: number;
    elapsedTime: number;
    speed?: number;
  };
  ambulance: {
    id: string;
    status: string;
    x: number;
    y: number;
    speedKmh: number;
    angle?: number;
    currentRoad: string;
    nextSignal: string;
    distanceToNextSignal: number;
    etaSeconds: number;
  };
  signals: TelemetrySignal[];
  traffic: {
    level: 'LOW' | 'MODERATE' | 'HIGH';
    vehicleCount: number;
    vehicles: TelemetryVehicle[];
  };
  mission: {
    origin: string;
    destination: string;
    elapsedTime: number;
    estimatedNormalTime: number;
    estimatedResQXTime: number;
    timeSaved: number;
    signalsPrioritized: number;
    intersectionsCleared: number;
  };
}

/** Legacy type export for backward compatibility */
export type Telemetry = TelemetryData;