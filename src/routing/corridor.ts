/**
 * ResQX Emergency Corridor & Predictive Green-Wave Planner
 *
 * Translates RouteResult and EtaResult junction arrival predictions into an
 * ordered, safety-constrained, conflict-aware predictive signal priority schedule.
 */

import type { EtaResult, JunctionArrival } from '../types/eta.ts';
import type {
  CorridorPlan,
  CorridorPlannerConfig,
  CorridorMetrics,
  SignalPlan,
  SignalPriorityPhase,
  SignalPlanStatus,
  SignalSafetyFlags,
} from '../types/corridor.ts';

const DEFAULT_CONFIG: Required<CorridorPlannerConfig> = {
  preparationLeadTimeSeconds: 6.0, // 6s lead time to initiate yellow/clearance
  preArrivalPriorityBuffer: 2.0, // 2s before arrival signal is locked GREEN
  postPassageClearanceWindow: 3.0, // 3s hold after arrival for full intersection clearance
  restorationDuration: 4.0, // 4s phase restoration transition back to normal
  minPreparationThresholdSeconds: 3.0, // Minimum 3s needed for safe yellow/pedestrian cycle
  maxPriorityDurationLimitSeconds: 30.0, // Maximum 30s priority window cap
};

// Known intersection conflict matrix (signals sharing conflicting physical crossing paths)
const KNOWN_SIGNAL_CONFLICTS: Record<string, string[]> = {
  'SIG-02': ['SIG-02-CROSS', 'SIG-CENTRAL-PED'],
  'SIG-02-CROSS': ['SIG-02'],
  'SIG-04': ['SIG-04-CROSS'],
};

export interface PlanCorridorOptions {
  ambulanceId?: string;
  config?: CorridorPlannerConfig;
  activeExternalConflictingSignals?: string[]; // IDs of any external conflicting priorities
  currentRelativeSeconds?: number; // Relative evaluation time (default 0 = now)
}

/**
 * Plans an optimal, safety-validated emergency corridor and predictive green wave schedule.
 */
export function planEmergencyCorridor(
  etaResult: EtaResult,
  options: PlanCorridorOptions = {}
): CorridorPlan {
  const {
    ambulanceId = 'AMB-01',
    config: userConfig = {},
    activeExternalConflictingSignals = [],
    currentRelativeSeconds = 0,
  } = options;

  const config: Required<CorridorPlannerConfig> = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  const timestamp = Date.now();
  const corridorId = `CORRIDOR-${ambulanceId}-${timestamp}`;

  // 1. Validation: If route or ETA failed, return safe failure
  if (!etaResult.success || !etaResult.edges || etaResult.edges.length === 0) {
    return {
      corridorId,
      success: false,
      ambulanceId,
      routeRoadIds: [],
      signals: [],
      metrics: createEmptyMetrics(),
      status: 'FAILED',
      reason: 'Cannot plan emergency corridor: No valid route or ETA result available.',
      timestamp,
    };
  }

  const junctionArrivals = etaResult.junctionArrivals || [];

  // 2. If no signals exist on the route, return valid zero-signal corridor
  if (junctionArrivals.length === 0) {
    return {
      corridorId,
      success: true,
      ambulanceId,
      routeRoadIds: etaResult.edges.map((e) => e.id),
      signals: [],
      metrics: {
        totalCorridorDistance: etaResult.totalRemainingDistance,
        totalSignalsCount: 0,
        predictedAmbulanceTravelTime: etaResult.estimatedTravelTime,
        predictedSignalWaitingTime: 0,
        uncontrolledEstimatedDelay: 0,
        estimatedTimeSaved: 0,
        totalCorridorDuration: 0,
      },
      status: 'NO_SIGNALS',
      reason: 'Emergency route contains zero traffic signals; free corridor navigation.',
      timestamp,
    };
  }

  // 3. Generate Signal Priority Schedule for each upcoming junction
  const signalPlans: SignalPlan[] = [];
  const scheduledSignalWindows: Array<{ id: string; start: number; end: number }> = [];

  for (const arrival of junctionArrivals) {
    const plan = scheduleSignalPriority({
      arrival,
      config,
      currentRelativeSeconds,
      activeExternalConflictingSignals,
      existingSchedules: scheduledSignalWindows,
    });

    signalPlans.push(plan);
    if (plan.status === 'APPROVED') {
      scheduledSignalWindows.push({
        id: plan.signalId,
        start: plan.priorityStart,
        end: plan.priorityEnd,
      });
    }
  }

  // 4. Calculate Corridor Metrics
  const metrics = calculateCorridorMetrics(etaResult, signalPlans);
  const allApproved = signalPlans.every((s) => s.status === 'APPROVED');
  const hasConflicts = signalPlans.some((s) => s.status === 'CONFLICT');

  let status: CorridorPlan['status'] = 'PLANNED';
  if (hasConflicts) {
    status = 'ACTIVE';
  } else if (allApproved) {
    status = 'ACTIVE';
  }

  const reason = generateCorridorReason(signalPlans, metrics);

  return {
    corridorId,
    success: true,
    ambulanceId,
    routeRoadIds: etaResult.edges.map((e) => e.id),
    signals: signalPlans,
    metrics,
    status,
    reason,
    timestamp,
  };
}

/**
 * Calculates predictive priority schedule, safety flags, and phase for a single signal.
 */
function scheduleSignalPriority({
  arrival,
  config,
  currentRelativeSeconds,
  activeExternalConflictingSignals,
  existingSchedules,
}: {
  arrival: JunctionArrival;
  config: Required<CorridorPlannerConfig>;
  currentRelativeSeconds: number;
  activeExternalConflictingSignals: string[];
  existingSchedules: Array<{ id: string; start: number; end: number }>;
}): SignalPlan {
  const arrivalSec = arrival.predictedArrivalSeconds;

  // Schedule Timeline Windows (relative to now)
  const prepareAt = Math.max(0, arrivalSec - config.preparationLeadTimeSeconds);
  const priorityStart = Math.max(0, arrivalSec - config.preArrivalPriorityBuffer);
  const priorityEnd = arrivalSec + config.postPassageClearanceWindow;
  const restoreAt = priorityEnd + config.restorationDuration;
  const duration = priorityEnd - priorityStart;

  // Safety Checks
  const warnings: string[] = [];
  const hasSufficientPreparationTime = arrivalSec >= config.minPreparationThresholdSeconds;
  if (!hasSufficientPreparationTime) {
    warnings.push(
      `INSUFFICIENT_PREPARATION_TIME: Arrival in ${arrivalSec.toFixed(1)}s is below minimum safe threshold (${config.minPreparationThresholdSeconds}s). Immediate override applied.`
    );
  }

  const withinMaxDuration = duration <= config.maxPriorityDurationLimitSeconds;
  if (!withinMaxDuration) {
    warnings.push(
      `EXCEEDS_MAX_DURATION: Priority duration ${duration.toFixed(1)}s exceeds safety cap of ${config.maxPriorityDurationLimitSeconds}s.`
    );
  }

  // Conflict Detection
  const knownConflicts = KNOWN_SIGNAL_CONFLICTS[arrival.signalId] ?? [];
  const conflictingSignalIds: string[] = [];

  // Check against active external conflicting priorities
  for (const conflictId of knownConflicts) {
    if (activeExternalConflictingSignals.includes(conflictId)) {
      conflictingSignalIds.push(conflictId);
    }
  }

  // Check against other overlapping schedules in this corridor
  for (const sched of existingSchedules) {
    if (knownConflicts.includes(sched.id)) {
      // Overlap condition
      if (priorityStart < sched.end && priorityEnd > sched.start) {
        conflictingSignalIds.push(sched.id);
      }
    }
  }

  const hasConflictingPriority = conflictingSignalIds.length > 0;
  let status: SignalPlanStatus = 'APPROVED';

  if (hasConflictingPriority) {
    status = 'CONFLICT';
    warnings.push(
      `SIGNAL_CONFLICT: Intersecting priority conflict with signal(s) [${conflictingSignalIds.join(', ')}].`
    );
  }

  const safetyFlags: SignalSafetyFlags = {
    hasSufficientPreparationTime,
    withinMaxDuration,
    hasConflictingPriority,
    isRestorationScheduled: true,
    warnings,
  };

  // Determine Current Phase based on current relative evaluation time
  const currentPhase = determineCurrentPhase({
    t: currentRelativeSeconds,
    prepareAt,
    priorityStart,
    arrivalSec,
    priorityEnd,
    restoreAt,
  });

  const reason = generateSignalReason(arrival, currentPhase, status, conflictingSignalIds);

  return {
    signalId: arrival.signalId,
    signalName: arrival.name,
    roadId: arrival.roadId,
    distanceFromAmbulance: arrival.distanceFromAmbulance,
    predictedArrivalSeconds: arrivalSec,
    predictedArrivalSimulationTime: arrival.predictedArrivalSimulationTime ?? arrivalSec,
    prepareAt: Math.round(prepareAt * 10) / 10,
    priorityStart: Math.round(priorityStart * 10) / 10,
    priorityEnd: Math.round(priorityEnd * 10) / 10,
    restoreAt: Math.round(restoreAt * 10) / 10,
    duration: Math.round(duration * 10) / 10,
    currentPhase,
    status,
    reason,
    safetyFlags,
    conflictingSignalIds,
  };
}

/**
 * Maps time `t` into the 5-phase signal priority state machine.
 */
function determineCurrentPhase({
  t,
  prepareAt,
  priorityStart,
  arrivalSec,
  priorityEnd,
  restoreAt,
}: {
  t: number;
  prepareAt: number;
  priorityStart: number;
  arrivalSec: number;
  priorityEnd: number;
  restoreAt: number;
}): SignalPriorityPhase {
  if (t < prepareAt) {
    return 'NORMAL';
  }
  if (t < priorityStart) {
    return 'PREPARING';
  }
  if (t < arrivalSec) {
    return 'PRIORITY';
  }
  if (t < priorityEnd) {
    return 'PASSING';
  }
  if (t < restoreAt) {
    return 'RESTORING';
  }
  return 'NORMAL';
}

function calculateCorridorMetrics(etaResult: EtaResult, signals: SignalPlan[]): CorridorMetrics {
  const totalDistance = etaResult.totalRemainingDistance;
  const travelTime = etaResult.estimatedTravelTime;

  // Uncontrolled delay calculation from baseline edge costs
  let uncontrolledDelay = 0;
  for (const edge of etaResult.edges) {
    uncontrolledDelay += edge.signalDelay;
  }
  if (uncontrolledDelay === 0 && signals.length > 0) {
    // If telemetry lacked signalDelay, use standard baseline 12s red cycle delay per signal
    uncontrolledDelay = signals.length * 12;
  }

  // Predicted delay with green wave: 0s if approved, otherwise penalty for conflicts
  let predictedWaitingTime = 0;
  for (const sig of signals) {
    if (sig.status === 'CONFLICT') {
      predictedWaitingTime += 8; // delay waiting for conflict resolution
    }
  }

  const estimatedTimeSaved = Math.max(0, uncontrolledDelay - predictedWaitingTime);

  const firstPrepare = signals.length > 0 ? Math.min(...signals.map((s) => s.prepareAt)) : 0;
  const lastRestore = signals.length > 0 ? Math.max(...signals.map((s) => s.restoreAt)) : 0;
  const totalCorridorDuration = Math.round((lastRestore - firstPrepare) * 10) / 10;

  return {
    totalCorridorDistance: Math.round(totalDistance * 10) / 10,
    totalSignalsCount: signals.length,
    predictedAmbulanceTravelTime: Math.round(travelTime * 10) / 10,
    predictedSignalWaitingTime: Math.round(predictedWaitingTime * 10) / 10,
    uncontrolledEstimatedDelay: Math.round(uncontrolledDelay * 10) / 10,
    estimatedTimeSaved: Math.round(estimatedTimeSaved * 10) / 10,
    totalCorridorDuration,
  };
}

function generateSignalReason(
  arrival: JunctionArrival,
  phase: SignalPriorityPhase,
  status: SignalPlanStatus,
  conflicts: string[]
): string {
  if (status === 'CONFLICT') {
    return `Priority conflict with intersecting signal(s) [${conflicts.join(', ')}]; hold safety clearance.`;
  }

  switch (phase) {
    case 'NORMAL':
      return `Ambulance approaching (${arrival.distanceFromAmbulance}m away); scheduled to prepare in ${arrival.predictedArrivalSeconds.toFixed(1)}s.`;
    case 'PREPARING':
      return `Ambulance arrival in ${arrival.predictedArrivalSeconds.toFixed(1)}s; initiating yellow clearance and pedestrian lockout.`;
    case 'PRIORITY':
      return `Ambulance approaching junction; green wave preemption active.`;
    case 'PASSING':
      return `Ambulance traversing intersection; holding clearance priority green.`;
    case 'RESTORING':
      return `Ambulance successfully cleared junction; restoring normal cycle.`;
  }
}

function generateCorridorReason(signals: SignalPlan[], metrics: CorridorMetrics): string {
  const signalCount = signals.length;
  if (signalCount === 0) {
    return 'Direct route with 0 signal interruptions.';
  }
  const sequence = signals.map((s) => s.signalId).join(' → ');
  return `Synchronized predictive green-wave corridor across ${signalCount} signals (${sequence}). Estimated ${metrics.estimatedTimeSaved}s saved.`;
}

function createEmptyMetrics(): CorridorMetrics {
  return {
    totalCorridorDistance: 0,
    totalSignalsCount: 0,
    predictedAmbulanceTravelTime: Infinity,
    predictedSignalWaitingTime: 0,
    uncontrolledEstimatedDelay: 0,
    estimatedTimeSaved: 0,
    totalCorridorDuration: 0,
  };
}
