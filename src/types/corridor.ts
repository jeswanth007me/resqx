/**
 * ResQX Emergency Corridor & Predictive Green-Wave Types
 *
 * Defines contracts for corridor planning, signal priority state machines,
 * safety constraints, conflict detection, and performance metrics.
 */


export type SignalPriorityPhase =
  | 'NORMAL'
  | 'PREPARING'
  | 'PRIORITY'
  | 'PASSING'
  | 'RESTORING';

export type SignalPlanStatus =
  | 'APPROVED'
  | 'BLOCKED'
  | 'WAITING'
  | 'CONFLICT';

export type CorridorStatus =
  | 'ACTIVE'
  | 'PLANNED'
  | 'NO_SIGNALS'
  | 'FAILED';

export interface SignalSafetyFlags {
  hasSufficientPreparationTime: boolean;
  withinMaxDuration: boolean;
  hasConflictingPriority: boolean;
  isRestorationScheduled: boolean;
  warnings: string[];
}

export interface SignalPlan {
  signalId: string;
  signalName: string;
  roadId: string;
  distanceFromAmbulance: number; // in meters
  predictedArrivalSeconds: number; // relative arrival time from now in seconds
  predictedArrivalSimulationTime: number; // absolute simulation clock time

  // Predictive Schedule Windows (in relative seconds from now)
  prepareAt: number; // Start of PREPARING (yellow transition / pedestrian clearance)
  priorityStart: number; // Start of PRIORITY (green wave locked)
  priorityEnd: number; // End of PRIORITY / PASSING (ambulance tail clears junction)
  restoreAt: number; // End of RESTORING (phase returned to NORMAL)

  duration: number; // Total priority duration (priorityEnd - priorityStart)
  currentPhase: SignalPriorityPhase;
  status: SignalPlanStatus;
  reason: string;
  safetyFlags: SignalSafetyFlags;
  conflictingSignalIds: string[];
}

export interface CorridorMetrics {
  totalCorridorDistance: number; // Total route distance in meters
  totalSignalsCount: number; // Count of signals on the corridor
  predictedAmbulanceTravelTime: number; // Estimated travel time in seconds
  predictedSignalWaitingTime: number; // Predicted waiting time at signals under green wave
  uncontrolledEstimatedDelay: number; // Predicted delay without ResQX corridor override
  estimatedTimeSaved: number; // uncontrolledEstimatedDelay - predictedSignalWaitingTime
  totalCorridorDuration: number; // Total active schedule span from first prep to last restore
}

export interface CorridorPlannerConfig {
  preparationLeadTimeSeconds?: number; // e.g. 6s before arrival
  preArrivalPriorityBuffer?: number; // e.g. 2s before arrival green lock
  postPassageClearanceWindow?: number; // e.g. 3s after arrival clearance
  restorationDuration?: number; // e.g. 4s phase restoration
  minPreparationThresholdSeconds?: number; // e.g. 3s min threshold for safe prep
  maxPriorityDurationLimitSeconds?: number; // e.g. 30s safety cap
}

export interface CorridorPlan {
  corridorId: string;
  success: boolean;
  ambulanceId: string;
  routeRoadIds: string[];
  signals: SignalPlan[];
  metrics: CorridorMetrics;
  status: CorridorStatus;
  reason: string;
  timestamp: number;
}
