/**
 * ResQX Experimental Benchmarking Types
 *
 * Defines contracts for Baseline vs ResQX reproducible experiments,
 * stop detection, waiting time measurement, and scenario comparisons.
 */

import type { TrafficScenarioType } from '../traffic/scenarios.ts';

export type ExperimentMode = 'BASELINE' | 'RESQX';
export type ExperimentStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INCOMPLETE';

export interface ExperimentConfig {
  experimentId: string;
  scenario: TrafficScenarioType;
  mode: ExperimentMode;
  seed?: number;
  startTime: number;
  ambulanceId: string;
  origin: string;
  destination: string;
  maxSimulationTimeSeconds: number;
  stopSpeedThresholdKmh?: number; // Speed threshold below which vehicle is stationary (default: 3.0 km/h)
  minStopDurationSeconds?: number; // Duration stationary before counting as a distinct stop (default: 1.0s)
}

export interface ExperimentMetrics {
  travelTimeSeconds: number; // Actual measured travel duration
  distanceMeters: number; // Actual distance traversed
  stopsCount: number; // Count of distinct complete stops
  waitingTimeSeconds: number; // Cumulative seconds stationary (speed <= threshold)
  redSignalWaitingSeconds: number; // Waiting seconds specifically at red traffic lights
  priorityEventsCount: number; // Number of traffic light priority overrides triggered
  routeChangesCount: number; // Number of dynamic rerouting decisions executed
  corridorDurationSeconds: number; // Duration the green-wave corridor remained active
  startSimulationTime: number; // Simulation timestamp when ambulance departed
  arrivalSimulationTime: number; // Simulation timestamp when ambulance arrived
  simulationDurationSeconds: number; // Total simulation clock time elapsed
  averageSpeedKmh: number; // Mean operating speed over the run
}

export interface ExperimentRun {
  id: string;
  config: ExperimentConfig;
  metrics: ExperimentMetrics;
  status: ExperimentStatus;
  isCompleted: boolean;
  timestamp: number;
  errorReason?: string;
}

export interface ExperimentComparison {
  scenario: TrafficScenarioType;
  baseline: ExperimentMetrics;
  resqx: ExperimentMetrics;
  timeSavedSeconds: number; // baseline.travelTimeSeconds - resqx.travelTimeSeconds
  percentageImprovement: number; // ((baseline - resqx) / baseline) * 100
  stopReduction: number; // baseline.stopsCount - resqx.stopsCount
  waitingTimeReductionSeconds: number; // baseline.waitingTimeSeconds - resqx.waitingTimeSeconds
  distanceDifferenceMeters: number; // resqx.distanceMeters - baseline.distanceMeters
  status: 'COMPLETED' | 'INCOMPLETE' | 'FAILED';
  summary: string;
}

export interface ScenarioBenchmark {
  scenario: TrafficScenarioType;
  runs: {
    baseline: ExperimentRun;
    resqx: ExperimentRun;
  }[];
  aggregateComparison?: ExperimentComparison;
}
