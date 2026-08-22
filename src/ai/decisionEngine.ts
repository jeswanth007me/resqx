import type { Telemetry } from '../types/telemetry';
import type { AIRecommendation } from '../types/ai';

/**
 * Pure, explainable decision engine that analyzes telemetry to produce
 * a structured AI recommendation.
 *
 * Rules Priority:
 * 1. Safe fallback for missing telemetry (Rules 1 & 2)
 * 2. Ambulance Staged (Rule 3)
 * 3. Mission Complete / Arrival (Rule 4)
 * 4. Approaching RED signal (Rule 5)
 * 5. Signal already prioritized (Rule 6)
 * 6. Signal is GREEN (Rule 7)
 * 7. Signal is NORMAL (Rule 8)
 * 8. High queue / Intersection congestion (Rule 10)
 * 9. High traffic / Route congestion (Rule 9)
 */
export function decisionEngine(telemetry: Telemetry | null | undefined): AIRecommendation {
  // Use logical telemetry timestamp for synchronization. Default to 0 if null/undefined.
  const timestamp = telemetry ? telemetry.timestamp : 0;

  // Safe default fallback if telemetry is null/undefined (Rule 1)
  const defaultRec: AIRecommendation = {
    id: 'rec-default',
    recommendation: 'Insufficient telemetry',
    reason: 'Insufficient telemetry to generate a reliable emergency recommendation.',
    confidence: 50,
    action: 'DISMISS',
    timestamp
  };

  if (!telemetry) {
    return defaultRec;
  }

  // Defensive validation of top-level properties (Rule 2)
  const { ambulance, route, signals, traffic } = telemetry;

  if (!ambulance) {
    return {
      id: `rec-insufficient-ambulance-${timestamp}`,
      recommendation: 'Insufficient telemetry',
      reason: 'Ambulance telemetry block is missing. Monitoring status.',
      confidence: 50,
      action: 'DISMISS',
      timestamp
    };
  }

  // Rule 3 — Ambulance Staged
  if (ambulance.emergencyStatus === 'STAGED') {
    return {
      id: `rec-staged-${timestamp}`,
      recommendation: 'Emergency standby',
      reason: `Priority asset ${ambulance.id} is staged. Signal priority is not required until the ambulance begins its emergency route.`,
      confidence: 90,
      action: 'DISMISS',
      timestamp
    };
  }

  // Rule 4 — Mission Complete / Arrival
  if (ambulance.emergencyStatus === 'ARRIVED' || (route && route.nextSignal === null)) {
    return {
      id: `rec-complete-${timestamp}`,
      recommendation: 'Mission complete',
      reason: `Priority asset ${ambulance.id} has successfully arrived at ${ambulance.destination}. All signal overrides released.`,
      confidence: 100,
      action: 'DISMISS',
      timestamp
    };
  }

  // Further check route to prevent crashes (Rule 2)
  if (!route) {
    return {
      id: `rec-insufficient-route-${timestamp}`,
      recommendation: 'Insufficient telemetry',
      reason: 'Ambulance routing data is unavailable. Monitoring status.',
      confidence: 50,
      action: 'DISMISS',
      timestamp
    };
  }

  const nextSignalId = route.nextSignal;
  const nextSignal = nextSignalId && Array.isArray(signals) ? signals.find(sig => sig.id === nextSignalId) : undefined;

  // Rule 5 — Approaching RED Signal
  if (nextSignal && nextSignal.state === 'RED') {
    const dist = nextSignal.distanceFromAmbulance;
    // Base confidence scales up as distance to signal decreases
    let confidenceWeight = 100 - dist / 15;
    
    // Rule 10: queueLength increases preemption priority confidence
    if (nextSignal.queueLength > 0) {
      confidenceWeight += Math.min(10, nextSignal.queueLength * 1.5);
    }
    // Rule 9: high route congestion increases confidence
    if (traffic?.congestionLevel === 'HIGH') {
      confidenceWeight += 5;
    }
    const confidence = Math.max(70, Math.min(98, Math.round(confidenceWeight)));

    const congestionDetails = traffic?.congestionLevel === 'HIGH'
      ? ` and traffic congestion is HIGH (queue length: ${nextSignal.queueLength} vehicles)`
      : ` (queue length: ${nextSignal.queueLength} vehicles)`;

    return {
      id: `rec-preempt-${nextSignalId}-${timestamp}`,
      recommendation: `Prioritize ${nextSignalId}`,
      reason: `${ambulance.id} is approaching ${nextSignalId} while the signal is RED${congestionDetails}, increasing potential emergency delay.`,
      confidence,
      targetSignal: nextSignalId || undefined,
      action: 'EXECUTE_OVERRIDE',
      timestamp
    };
  }

  // Rule 6 — Emergency Priority Already Active
  if (nextSignal && nextSignal.state === 'EMERGENCY_PRIORITY') {
    return {
      id: `rec-monitoring-${nextSignalId}-${timestamp}`,
      recommendation: 'Priority already active',
      reason: `${nextSignalId} is already in emergency priority for the approaching ambulance ${ambulance.id}. Monitoring traffic clearance.`,
      confidence: 99,
      targetSignal: nextSignalId || undefined,
      action: 'DISMISS',
      timestamp
    };
  }

  // Rule 7 — Green Signal
  if (nextSignal && nextSignal.state === 'GREEN') {
    return {
      id: `rec-normal-${nextSignalId}-${timestamp}`,
      recommendation: 'Signal favorable',
      reason: `Upcoming signal ${nextSignalId} is GREEN for the approaching ambulance ${ambulance.id}; no override required.`,
      confidence: 90,
      targetSignal: nextSignalId || undefined,
      action: 'DISMISS',
      timestamp
    };
  }

  // Rule 8 — Normal Signal (no priority required)
  if (nextSignal && nextSignal.state === 'NORMAL') {
    return {
      id: `rec-normal-${nextSignalId}-${timestamp}`,
      recommendation: 'Corridor flow normal',
      reason: `Upcoming signal ${nextSignalId} is in normal state. Ambulance ${ambulance.id} has sufficient flow; monitoring conditions.`,
      confidence: 80,
      targetSignal: nextSignalId || undefined,
      action: 'DISMISS',
      timestamp
    };
  }

  // Rule 10: Queue build-up on generic signal
  if (nextSignal && nextSignal.queueLength >= 5) {
    return {
      id: `rec-queue-${nextSignalId}-${timestamp}`,
      recommendation: `Clear ${nextSignalId} queue`,
      reason: `Signal ${nextSignalId} queue has reached ${nextSignal.queueLength} vehicles. Timing adjustments recommended to avoid bottlenecks ahead of ${ambulance.id}.`,
      confidence: 85,
      targetSignal: nextSignalId || undefined,
      action: 'ADJUST_TIMING',
      timestamp
    };
  }

  // Rule 9: General High Congestion fallback
  if (traffic && traffic.congestionLevel === 'HIGH') {
    return {
      id: `rec-congestion-${timestamp}`,
      recommendation: 'Manage corridor timing',
      reason: `Corridor congestion level is HIGH (${traffic.vehicleCount} vehicles). Recommend timing adjustments on upcoming nodes to clear general flow.`,
      confidence: 75,
      action: 'ADJUST_TIMING',
      timestamp
    };
  }

  // General Fallback (Default Monitoring)
  return {
    id: `rec-monitor-${timestamp}`,
    recommendation: 'Monitoring traffic network',
    reason: `Ambulance ${ambulance.id} is en route to ${ambulance.destination}. Traffic flow level is ${traffic?.congestionLevel || 'NORMAL'}.`,
    confidence: 80,
    action: 'DISMISS',
    timestamp
  };
}
