/**
 * ResQX Safety Validator Types
 *
 * Defines contracts for corridor plan safety validation, priority command authorization,
 * timeout protection, and conflict prevention.
 */

import type { SignalPlan } from './corridor.ts';

export type ValidationDecision = 'APPROVED' | 'HOLD' | 'BLOCKED';

export interface ValidatedSignalCommand {
  signalId: string;
  signalName: string;
  roadId: string;
  authorizedPhase: SignalPlan['currentPhase'];
  priorityStart: number;
  priorityEnd: number;
  restoreAt: number;
  timeoutSeconds: number;
  sumoStatePattern: string; // 'GGGrr' for Priority, 'yyyrr' for Preparing, '0' for Normal/Restore
  reason: string;
}

export interface BlockedSignalCommand {
  signalId: string;
  decision: 'HOLD' | 'BLOCKED';
  rejectionReasons: string[];
  fallbackAction: 'HOLD_NORMAL_CYCLE' | 'RELEASE_PRIORITY' | 'MANUAL_OVERRIDE_REQUIRED';
}

export interface SafetyValidationResult {
  decision: ValidationDecision;
  allSafe: boolean;
  corridorId: string;
  timestamp: number;
  approvedCommands: ValidatedSignalCommand[];
  blockedCommands: BlockedSignalCommand[];
  validationNotes: string[];
  safetySummary: string;
}
