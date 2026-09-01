import type { TelemetryData } from '../types/telemetry';
import type { AIRecommendation } from '../types/ai';

/**
 * Pure, explainable decision engine that analyzes telemetry to produce
 * a structured AI recommendation.
 */
export function decisionEngine(telemetry: TelemetryData | null | undefined): AIRecommendation {
  const timestamp = telemetry?.simulation?.elapsedTime ?? 0;

  const defaultRec: AIRecommendation = {
    id: 'rec-default',
    recommendation: 'Insufficient telemetry',
    reason: 'Insufficient telemetry to generate a reliable emergency recommendation.',
    confidence: 50,
    action: 'DISMISS',
    timestamp,
  };

  if (!telemetry) {
    return defaultRec;
  }

  const { ambulance, signals, traffic, mission } = telemetry;

  if (!ambulance) {
    return {
      id: `rec-insufficient-ambulance-${timestamp}`,
      recommendation: 'Insufficient telemetry',
      reason: 'Ambulance telemetry block is missing. Monitoring status.',
      confidence: 50,
      action: 'DISMISS',
      timestamp,
    };
  }

  const ambStatus = ambulance.status ?? 'STAGED';
  const destination = mission?.destination ?? 'HOSPITAL';

  // Rule 3 — Ambulance Staged
  if (ambStatus === 'STAGED') {
    return {
      id: `rec-staged-${timestamp}`,
      recommendation: 'Emergency standby',
      reason: `Priority asset ${ambulance.id} is staged. Signal priority is not required until the ambulance begins its emergency route.`,
      confidence: 90,
      action: 'DISMISS',
      timestamp,
    };
  }

  // Rule 4 — Mission Complete / Arrival
  if (ambStatus === 'ARRIVED' || ambulance.nextSignal === 'HOSPITAL') {
    return {
      id: `rec-complete-${timestamp}`,
      recommendation: 'Mission complete',
      reason: `Priority asset ${ambulance.id} has successfully arrived at ${destination}. All signal overrides released.`,
      confidence: 100,
      action: 'DISMISS',
      timestamp,
    };
  }

  const nextSignalId = ambulance.nextSignal ?? 'SIG-01';
  const nextSignal = Array.isArray(signals) ? signals.find((sig) => sig.id === nextSignalId) : undefined;
  const dist = nextSignal ? nextSignal.distanceFromAmbulance : ambulance.distanceToNextSignal ?? 100;
  const sigState = nextSignal ? (nextSignal.emergencyState || nextSignal.state) : 'NORMAL';
  const congestionLevel = traffic?.level ?? 'LOW';

  // Rule 5 — Approaching RED / PREPARING signal
  if (sigState === 'RED' || sigState === 'PREPARING' || sigState === 'NORMAL') {
    let confidenceWeight = Math.max(50, 100 - dist / 5);

    if (congestionLevel === 'HIGH') {
      confidenceWeight += 5;
    }
    const confidence = Math.max(70, Math.min(98, Math.round(confidenceWeight)));

    const congestionDetails =
      congestionLevel === 'HIGH'
        ? ` and corridor traffic density is HIGH`
        : ` (${Math.round(dist)}m remaining)`;

    return {
      id: `rec-preempt-${nextSignalId}-${timestamp}`,
      recommendation: `Prioritize ${nextSignalId}`,
      reason: `${ambulance.id} is approaching ${nextSignalId}${congestionDetails}, recommending emergency green wave preemption.`,
      confidence,
      targetSignal: nextSignalId || undefined,
      action: 'EXECUTE_OVERRIDE',
      timestamp,
    };
  }

  // Rule 6 — Emergency Priority Already Active
  if (sigState === 'EMERGENCY PRIORITY' || sigState === 'EMERGENCY_PRIORITY') {
    return {
      id: `rec-monitoring-${nextSignalId}-${timestamp}`,
      recommendation: 'Priority already active',
      reason: `${nextSignalId} is already in emergency priority for approaching ${ambulance.id}. Monitoring traffic clearance.`,
      confidence: 99,
      targetSignal: nextSignalId || undefined,
      action: 'DISMISS',
      timestamp,
    };
  }

  // Rule 7 — Green Signal / RESTORED
  if (sigState === 'GREEN' || sigState === 'RESTORED') {
    return {
      id: `rec-normal-${nextSignalId}-${timestamp}`,
      recommendation: 'Signal favorable',
      reason: `Upcoming signal ${nextSignalId} is favorable for approaching ${ambulance.id}; monitoring conditions.`,
      confidence: 90,
      targetSignal: nextSignalId || undefined,
      action: 'DISMISS',
      timestamp,
    };
  }

  // General Fallback (Default Monitoring)
  return {
    id: `rec-monitor-${timestamp}`,
    recommendation: 'Monitoring traffic network',
    reason: `Ambulance ${ambulance.id} is en route to ${destination}. Traffic flow level is ${congestionLevel}.`,
    confidence: 80,
    action: 'DISMISS',
    timestamp,
  };
}
