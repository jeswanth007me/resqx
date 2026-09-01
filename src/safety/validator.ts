/**
 * ResQX Emergency Signal Safety Validator
 *
 * Implements strict, deterministic safety rules before allowing any corridor
 * signal override to be dispatched to SUMO/TraCI or local simulation.
 *
 * Core Rules:
 * 1. Signal Existence & Network Topology Verification
 * 2. Preparation Lead-Time Threshold Validation
 * 3. Priority Duration Cap & Timeout Protection (≤ 30s)
 * 4. Intersecting Cross-Traffic Conflict Prevention
 * 5. Guaranteed Restoration Schedule Check
 */

import type { CorridorPlan, SignalPlan } from '../types/corridor.ts';
import type {
  SafetyValidationResult,
  ValidatedSignalCommand,
  BlockedSignalCommand,
  ValidationDecision,
} from '../types/safety.ts';

const KNOWN_VALID_SIGNALS = new Set(['SIG-01', 'SIG-02', 'SIG-03', 'SIG-04']);
const MAX_ALLOWED_PRIORITY_DURATION_SEC = 30.0;
const MIN_SAFE_PREPARATION_TIME_SEC = 3.0;

/**
 * Validates an entire CorridorPlan and authorizes executable signal commands.
 */
export function validateCorridorPlan(
  corridorPlan: CorridorPlan,
  activeNetworkSignals: string[] = Array.from(KNOWN_VALID_SIGNALS)
): SafetyValidationResult {
  const timestamp = Date.now();
  const approvedCommands: ValidatedSignalCommand[] = [];
  const blockedCommands: BlockedSignalCommand[] = [];
  const validationNotes: string[] = [];

  if (!corridorPlan.success || corridorPlan.signals.length === 0) {
    return {
      decision: corridorPlan.status === 'NO_SIGNALS' ? 'APPROVED' : 'BLOCKED',
      allSafe: corridorPlan.status === 'NO_SIGNALS',
      corridorId: corridorPlan.corridorId,
      timestamp,
      approvedCommands: [],
      blockedCommands: [],
      validationNotes: [
        corridorPlan.status === 'NO_SIGNALS'
          ? 'Route has 0 signals; no override commands needed.'
          : 'Corridor plan is in FAILED state.',
      ],
      safetySummary: corridorPlan.reason,
    };
  }

  const validSignalSet = new Set(activeNetworkSignals);

  for (const signalPlan of corridorPlan.signals) {
    const singleValidation = validateSingleSignal(signalPlan, validSignalSet);

    if (singleValidation.decision === 'APPROVED') {
      approvedCommands.push(singleValidation.command!);
      validationNotes.push(`Signal ${signalPlan.signalId}: APPROVED for phase ${signalPlan.currentPhase}.`);
    } else {
      blockedCommands.push(singleValidation.blockedCommand!);
      validationNotes.push(
        `Signal ${signalPlan.signalId}: ${singleValidation.decision} - ${singleValidation.blockedCommand!.rejectionReasons.join('; ')}`
      );
    }
  }

  const allSafe = blockedCommands.length === 0;
  let overallDecision: ValidationDecision = 'APPROVED';

  if (!allSafe) {
    const hasBlocked = blockedCommands.some((b) => b.decision === 'BLOCKED');
    overallDecision = hasBlocked ? 'BLOCKED' : 'HOLD';
  }

  const safetySummary = allSafe
    ? `Safety validation PASSED across all ${approvedCommands.length} signals. Safe to dispatch.`
    : `Safety validation flagged ${blockedCommands.length} signal(s) with safety constraints.`;

  return {
    decision: overallDecision,
    allSafe,
    corridorId: corridorPlan.corridorId,
    timestamp,
    approvedCommands,
    blockedCommands,
    validationNotes,
    safetySummary,
  };
}

/**
 * Validates a single SignalPlan against all critical safety invariants.
 */
export function validateSingleSignal(
  plan: SignalPlan,
  validSignals: Set<string> = KNOWN_VALID_SIGNALS
): {
  decision: ValidationDecision;
  command?: ValidatedSignalCommand;
  blockedCommand?: BlockedSignalCommand;
} {
  const rejections: string[] = [];
  let isHoldOnly = false;

  // 1. Signal Existence in Network
  if (!validSignals.has(plan.signalId)) {
    rejections.push(`SIGNAL_NOT_FOUND: Signal ID '${plan.signalId}' does not exist in active SUMO network.`);
  }

  // 2. Conflict Check
  if (plan.status === 'CONFLICT' || plan.safetyFlags.hasConflictingPriority) {
    rejections.push(
      `CONFLICT_DETECTED: Active priority conflict with intersecting cross-streets [${plan.conflictingSignalIds.join(', ')}].`
    );
  }

  // 3. Priority Duration Cap (Safety timeout)
  if (plan.duration > MAX_ALLOWED_PRIORITY_DURATION_SEC) {
    rejections.push(
      `DURATION_EXCEEDED: Requested priority duration ${plan.duration}s exceeds maximum safety cap (${MAX_ALLOWED_PRIORITY_DURATION_SEC}s).`
    );
  }

  // 4. Preparation Time Verification
  if (!plan.safetyFlags.hasSufficientPreparationTime && plan.currentPhase === 'NORMAL') {
    rejections.push(
      `INSUFFICIENT_PREP_TIME: Arrival in ${plan.predictedArrivalSeconds}s is below safe yellow clearance window (${MIN_SAFE_PREPARATION_TIME_SEC}s).`
    );
    isHoldOnly = true; // Non-fatal hold
  }

  // 5. Guaranteed Restoration Verification
  if (!plan.safetyFlags.isRestorationScheduled || plan.restoreAt <= plan.priorityEnd) {
    rejections.push('MISSING_RESTORATION: Plan does not contain a valid post-passage restoration schedule.');
  }

  if (rejections.length > 0) {
    const decision: ValidationDecision = isHoldOnly && rejections.length === 1 ? 'HOLD' : 'BLOCKED';
    return {
      decision,
      blockedCommand: {
        signalId: plan.signalId,
        decision: isHoldOnly ? 'HOLD' : 'BLOCKED',
        rejectionReasons: rejections,
        fallbackAction: isHoldOnly ? 'HOLD_NORMAL_CYCLE' : 'RELEASE_PRIORITY',
      },
    };
  }

  // Map to executable SUMO TraCI state patterns
  let sumoPattern = '0'; // default cyclic program
  if (plan.currentPhase === 'PREPARING') {
    sumoPattern = 'yyyrr'; // Corridor yellow clearance
  } else if (plan.currentPhase === 'PRIORITY' || plan.currentPhase === 'PASSING') {
    sumoPattern = 'GGGrr'; // Corridor emergency green priority
  } else if (plan.currentPhase === 'RESTORING' || plan.currentPhase === 'NORMAL') {
    sumoPattern = '0'; // Restore standard cycle program
  }

  return {
    decision: 'APPROVED',
    command: {
      signalId: plan.signalId,
      signalName: plan.signalName,
      roadId: plan.roadId,
      authorizedPhase: plan.currentPhase,
      priorityStart: plan.priorityStart,
      priorityEnd: plan.priorityEnd,
      restoreAt: plan.restoreAt,
      timeoutSeconds: MAX_ALLOWED_PRIORITY_DURATION_SEC,
      sumoStatePattern: sumoPattern,
      reason: plan.reason,
    },
  };
}
