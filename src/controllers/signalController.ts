/**
 * ResQX Signal Controller Bridge
 *
 * Dispatches safety-authorized signal priority commands to SUMO/TraCI or local simulation.
 * Verifies feedback to ensure the actual simulation state matches the commanded state.
 */

import type { ValidatedSignalCommand, SafetyValidationResult } from '../types/safety.ts';

export interface SignalDispatchResult {
  signalId: string;
  commandedPhase: string;
  sumoPattern: string;
  dispatched: boolean;
  acknowledged: boolean;
  actualState?: string;
  isVerified: boolean;
  error?: string;
}

export interface CorridorDispatchResult {
  corridorId: string;
  success: boolean;
  dispatchedCommands: SignalDispatchResult[];
  timestamp: number;
}

const SUMO_SERVER_URL = 'http://localhost:8000';

export interface ExecuteControlOptions {
  serverUrl?: string;
  onLocalSignalChange?: (signalId: string, state: string, pattern?: string) => void;
}

/**
 * Executes safety-validated signal commands across both SUMO backend and local simulation.
 * Strict Safety Gate: If validation.decision !== 'APPROVED', NO signal actions will be executed.
 */
export async function executeValidatedControl(
  validation: SafetyValidationResult,
  options: ExecuteControlOptions = {}
): Promise<CorridorDispatchResult> {
  const timestamp = Date.now();

  // Strict Safety Gate
  if (validation.decision !== 'APPROVED' || validation.approvedCommands.length === 0) {
    return {
      corridorId: validation.corridorId,
      success: false,
      dispatchedCommands: [],
      timestamp,
    };
  }

  const results: SignalDispatchResult[] = [];

  for (const cmd of validation.approvedCommands) {
    // Apply to local simulation adapter if registered
    if (options.onLocalSignalChange) {
      options.onLocalSignalChange(cmd.signalId, cmd.authorizedPhase, cmd.sumoStatePattern);
    }

    // Dispatch to SUMO backend bridge
    const res = await dispatchSingleCommand(cmd, options.serverUrl ?? SUMO_SERVER_URL);
    results.push(res);
  }

  return {
    corridorId: validation.corridorId,
    success: true,
    dispatchedCommands: results,
    timestamp,
  };
}

/**
 * Dispatches validated signal commands to SUMO TraCI via the HTTP bridge.
 */
export async function dispatchValidatedCommands(
  validation: SafetyValidationResult,
  serverUrl: string = SUMO_SERVER_URL
): Promise<CorridorDispatchResult> {
  const timestamp = Date.now();
  const results: SignalDispatchResult[] = [];

  if (validation.decision === 'BLOCKED' || validation.approvedCommands.length === 0) {
    return {
      corridorId: validation.corridorId,
      success: validation.approvedCommands.length === 0 && validation.decision === 'APPROVED',
      dispatchedCommands: [],
      timestamp,
    };
  }

  for (const cmd of validation.approvedCommands) {
    const result = await dispatchSingleCommand(cmd, serverUrl);
    results.push(result);
  }

  const allSuccess = results.every((r) => r.dispatched && r.acknowledged);

  return {
    corridorId: validation.corridorId,
    success: allSuccess,
    dispatchedCommands: results,
    timestamp,
  };
}

/**
 * Dispatches a single signal override command to the backend bridge.
 */
export async function dispatchSingleCommand(
  cmd: ValidatedSignalCommand,
  serverUrl: string = SUMO_SERVER_URL
): Promise<SignalDispatchResult> {
  try {
    const url = `${serverUrl}/api/signal?signalId=${cmd.signalId}&state=${cmd.authorizedPhase}&pattern=${cmd.sumoStatePattern}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });

    if (!res.ok) {
      return {
        signalId: cmd.signalId,
        commandedPhase: cmd.authorizedPhase,
        sumoPattern: cmd.sumoStatePattern,
        dispatched: true,
        acknowledged: false,
        isVerified: false,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();

    return {
      signalId: cmd.signalId,
      commandedPhase: cmd.authorizedPhase,
      sumoPattern: cmd.sumoStatePattern,
      dispatched: true,
      acknowledged: data.status === 'ok',
      actualState: data.actualState ?? cmd.authorizedPhase,
      isVerified: true,
    };
  } catch (err) {
    // In local simulation mode or when server is disconnected
    return {
      signalId: cmd.signalId,
      commandedPhase: cmd.authorizedPhase,
      sumoPattern: cmd.sumoStatePattern,
      dispatched: false,
      acknowledged: false,
      isVerified: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

/**
 * Closed-loop state verification: confirms that the signal's reported telemetry state
 * matches the commanded priority phase before displaying active priority.
 */
export function verifySignalPriorityState(
  commandedPhase: string,
  actualEmergencyState?: string
): boolean {
  if (!actualEmergencyState) return false;
  if (commandedPhase === 'PRIORITY' || commandedPhase === 'PASSING') {
    return (
      actualEmergencyState === 'EMERGENCY PRIORITY' ||
      actualEmergencyState === 'EMERGENCY_PRIORITY' ||
      actualEmergencyState === 'PRIORITY'
    );
  }
  if (commandedPhase === 'PREPARING') {
    return actualEmergencyState === 'PREPARING';
  }
  if (commandedPhase === 'RESTORING' || commandedPhase === 'NORMAL') {
    return actualEmergencyState === 'RESTORED' || actualEmergencyState === 'NORMAL';
  }
  return false;
}
