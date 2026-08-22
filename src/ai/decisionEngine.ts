import type { Telemetry } from '../types/telemetry';
import type { AIRecommendation } from '../types/ai';

/**
 * Pure, explainable decision engine that analyzes telemetry to produce
 * a structured AI recommendation.
 *
 * Rules Priority:
 * 1. Mission Complete / Arrival (Rule 6)
 * 2. Approaching RED signal (Rule 1)
 * 3. Signal already prioritized (Rule 2)
 * 4. High queue / Intersection congestion (Rule 3)
 * 5. High route congestion (Rule 4)
 * 6. Normal green signal / Optimal flow (Rule 5)
 */
export function decisionEngine(telemetry: Telemetry | null | undefined): AIRecommendation {
  const timestamp = Date.now();

  // Safe default fallback if telemetry is missing
  const defaultRec: AIRecommendation = {
    id: 'rec-default',
    recommendation: 'System initializing',
    reason: 'Waiting for live telemetry stream connection.',
    confidence: 100,
    action: 'DISMISS',
    timestamp
  };

  if (!telemetry || !telemetry.ambulance) {
    return defaultRec;
  }

  const { ambulance, route, signals, traffic } = telemetry;

  // 1. Mission Complete / Arrival (Rule 6)
  if (ambulance.emergencyStatus === 'ARRIVED' || route.nextSignal === null) {
    return {
      id: `rec-complete-${timestamp}`,
      recommendation: 'Mission complete',
      reason: `Priority asset ${ambulance.id} has successfully arrived at ${ambulance.destination}. All signal preemptions released.`,
      confidence: 100,
      action: 'DISMISS',
      timestamp
    };
  }

  const nextSignalId = route.nextSignal;
  const nextSignal = signals?.find(sig => sig.id === nextSignalId);

  // 2. Approaching RED Signal (Rule 1)
  if (nextSignal && nextSignal.state === 'RED') {
    // Confidence is higher when closer to the signal
    const dist = nextSignal.distanceFromAmbulance;
    const confidence = Math.max(65, Math.min(98, Math.round(100 - dist / 15)));
    return {
      id: `rec-preempt-${nextSignalId}-${timestamp}`,
      recommendation: `Prioritize ${nextSignalId} now`,
      reason: `${ambulance.id} is approaching signal ${nextSignalId} which is currently RED. Preemption override recommended to clear queue of ${nextSignal.queueLength} vehicles.`,
      confidence,
      targetSignal: nextSignalId,
      action: 'EXECUTE_OVERRIDE',
      timestamp
    };
  }

  // 3. Signal Already Prioritized (Rule 2)
  if (nextSignal && nextSignal.state === 'EMERGENCY_PRIORITY') {
    return {
      id: `rec-monitoring-${nextSignalId}-${timestamp}`,
      recommendation: `Monitoring ${nextSignalId} Priority`,
      reason: `Emergency signal priority is active on ${nextSignalId}. Current queue length: ${nextSignal.queueLength} vehicles. Monitoring intersection clearing.`,
      confidence: 99,
      targetSignal: nextSignalId,
      action: 'DISMISS',
      timestamp
    };
  }

  // 4. High Queue / Intersection Congestion (Rule 3)
  if (nextSignal && nextSignal.queueLength >= 5) {
    return {
      id: `rec-queue-${nextSignalId}-${timestamp}`,
      recommendation: `Clear ${nextSignalId} queue`,
      reason: `Signal ${nextSignalId} queue length has reached ${nextSignal.queueLength} vehicles. Adjust signal timing to prevent bottleneck ahead of ${ambulance.id}.`,
      confidence: 85,
      targetSignal: nextSignalId,
      action: 'ADJUST_TIMING',
      timestamp
    };
  }

  // 5. High Route Congestion (Rule 4)
  if (traffic && traffic.congestionLevel === 'HIGH') {
    return {
      id: `rec-congestion-${timestamp}`,
      recommendation: 'Manage corridor timing',
      reason: `High traffic volume detected along ${route.currentRoad} (${traffic.vehicleCount} vehicles). Recommend adjusting signal cycle timing on upcoming intersections.`,
      confidence: 75,
      action: 'ADJUST_TIMING',
      timestamp
    };
  }

  // 6. Normal / Optimal flow (Rule 5)
  if (nextSignal && nextSignal.state === 'GREEN') {
    return {
      id: `rec-normal-${nextSignalId}-${timestamp}`,
      recommendation: 'Corridor flow optimal',
      reason: `Upcoming signal ${nextSignalId} is GREEN. Ambulance speed is ${ambulance.speed} km/h with low delay risk. No immediate preemption required.`,
      confidence: 90,
      targetSignal: nextSignalId,
      action: 'DISMISS',
      timestamp
    };
  }

  // General Fallback
  return {
    id: `rec-monitor-${timestamp}`,
    recommendation: 'Monitoring traffic network',
    reason: `Ambulance ${ambulance.id} is en route to ${ambulance.destination}. Traffic congestion level is ${traffic?.congestionLevel || 'NORMAL'}.`,
    confidence: 80,
    action: 'DISMISS',
    timestamp
  };
}
