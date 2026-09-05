/**
 * ResQX Deterministic Ambulance ETA Engine
 *
 * Computes deterministic remaining distance, kinematic travel times,
 * traffic/signal delay adjustments, and predicted junction arrival times.
 */

import type {
  EtaInput,
  EtaResult,
  EtaCostBreakdown,
  PerRoadEta,
  JunctionArrival,
  SignalInput,
} from '../types/eta.ts';
import type { RoadEdge } from '../types/routing.ts';

const DEFAULT_EMERGENCY_SPEED_KMH = 50; // 50 km/h (~13.89 m/s) nominal emergency cruising speed
const MIN_SPEED_THRESHOLD_KMH = 3; // Speeds below 3 km/h indicate stopped/staged state
const MAX_SPEED_CLAMP_KMH = 120; // Safety clamp for unrealistic speeds

/**
 * Formats a duration in seconds into MM:SS format (e.g. 45 -> "00:45", 85 -> "01:25").
 */
export function formatSecondsToMmSs(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '--:--';
  }
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Deterministically calculates the ambulance ETA and upcoming junction arrival times.
 */
export function calculateAmbulanceEta(input: EtaInput): EtaResult {
  const {
    routeResult,
    ambulance,
    signals = [],
    currentSimulationTime = 0,
    defaultCruisingSpeedKmh = DEFAULT_EMERGENCY_SPEED_KMH,
  } = input;

  // If routing failed or no edges exist, return safe failure
  if (!routeResult.success || !routeResult.edges || routeResult.edges.length === 0) {
    return {
      success: false,
      totalRemainingDistance: 0,
      estimatedTravelTime: Infinity,
      formattedEta: '--:--',
      effectiveSpeedKmh: 0,
      effectiveSpeedMs: 0,
      isArrived: false,
      costBreakdown: {
        freeFlowTime: 0,
        trafficDelay: 0,
        signalDelay: 0,
        totalEstimatedTime: Infinity,
      },
      perRoadEta: [],
      junctionArrivals: [],
      assumptions: 'Cannot calculate ETA: No valid route provided.',
      edges: [],
    };
  }

  // 1. Resolve Effective Speed
  let effectiveSpeedKmh = defaultCruisingSpeedKmh;
  let speedSource = 'default cruising speed';

  if (ambulance?.speedKmh !== undefined && ambulance.speedKmh > MIN_SPEED_THRESHOLD_KMH) {
    effectiveSpeedKmh = Math.min(MAX_SPEED_CLAMP_KMH, ambulance.speedKmh);
    speedSource = `current telemetry speed (${effectiveSpeedKmh.toFixed(1)} km/h)`;
  } else if (ambulance?.speedMs !== undefined && ambulance.speedMs * 3.6 > MIN_SPEED_THRESHOLD_KMH) {
    effectiveSpeedKmh = Math.min(MAX_SPEED_CLAMP_KMH, ambulance.speedMs * 3.6);
    speedSource = `current telemetry speed (${effectiveSpeedKmh.toFixed(1)} km/h)`;
  } else {
    speedSource = `nominal emergency standby speed (${effectiveSpeedKmh} km/h)`;
  }

  const effectiveSpeedMs = effectiveSpeedKmh / 3.6;

  // 2. Check Arrival State
  const isArrived =
    ambulance?.status === 'ARRIVED' ||
    (ambulance?.currentRoadId === routeResult.roadIds[routeResult.roadIds.length - 1] &&
      (ambulance?.progressOnCurrentRoad ?? 0) >= 1);

  if (isArrived) {
    return {
      success: true,
      totalRemainingDistance: 0,
      estimatedTravelTime: 0,
      formattedEta: '00:00',
      effectiveSpeedKmh,
      effectiveSpeedMs,
      isArrived: true,
      costBreakdown: {
        freeFlowTime: 0,
        trafficDelay: 0,
        signalDelay: 0,
        totalEstimatedTime: 0,
      },
      perRoadEta: routeResult.edges.map((edge) => ({
        roadId: edge.id,
        roadName: edge.name,
        remainingDistance: 0,
        estimatedTravelTime: 0,
        baseTravelTime: 0,
        trafficDelay: 0,
        signalDelay: 0,
        isCurrentRoad: false,
        isCompleted: true,
      })),
      junctionArrivals: [],
      assumptions: 'Ambulance has arrived at destination.',
      edges: routeResult.edges,
    };
  }

  // 3. Locate Ambulance along the Route
  const edges = routeResult.edges;
  let currentRoadIndex = -1;

  if (ambulance?.currentRoadId) {
    currentRoadIndex = edges.findIndex((e) => e.id === ambulance.currentRoadId);
  }

  // If ambulance road is not on route, default to start of route (index 0)
  if (currentRoadIndex === -1) {
    currentRoadIndex = 0;
  }

  const currentRoadProgress = Math.max(0, Math.min(1, ambulance?.progressOnCurrentRoad ?? 0));

  // 4. Compute Per-Road Remaining Distance & Travel Times
  let totalRemainingDistance = 0;
  let totalFreeFlowTime = 0;
  let totalTrafficDelay = 0;
  let totalSignalDelay = 0;

  const perRoadEta: PerRoadEta[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    let remainingDist = 0;
    let isCurrent = false;
    let isCompleted = false;

    if (i < currentRoadIndex) {
      // Already completed
      remainingDist = 0;
      isCompleted = true;
    } else if (i === currentRoadIndex) {
      // Current active road
      remainingDist = edge.distance * (1 - currentRoadProgress);
      isCurrent = true;
    } else {
      // Upcoming road
      remainingDist = edge.distance;
    }

    const roadRatio = edge.distance > 0 ? remainingDist / edge.distance : 0;
    const baseTime = remainingDist / effectiveSpeedMs;
    const trafficDelay = edge.trafficDelay * roadRatio;
    const signalDelay = edge.signalDelay * (remainingDist > 0 ? 1 : 0);
    const estimatedTime = isCompleted ? 0 : baseTime + trafficDelay + signalDelay;

    perRoadEta.push({
      roadId: edge.id,
      roadName: edge.name,
      remainingDistance: Math.round(remainingDist * 10) / 10,
      estimatedTravelTime: Math.round(estimatedTime * 10) / 10,
      baseTravelTime: Math.round(baseTime * 10) / 10,
      trafficDelay: Math.round(trafficDelay * 10) / 10,
      signalDelay: Math.round(signalDelay * 10) / 10,
      isCurrentRoad: isCurrent,
      isCompleted,
    });

    if (!isCompleted) {
      totalRemainingDistance += remainingDist;
      totalFreeFlowTime += baseTime;
      totalTrafficDelay += trafficDelay;
      totalSignalDelay += signalDelay;
    }
  }

  const totalEstimatedTravelTime = totalFreeFlowTime + totalTrafficDelay + totalSignalDelay;
  const costBreakdown: EtaCostBreakdown = {
    freeFlowTime: Math.round(totalFreeFlowTime * 10) / 10,
    trafficDelay: Math.round(totalTrafficDelay * 10) / 10,
    signalDelay: Math.round(totalSignalDelay * 10) / 10,
    totalEstimatedTime: Math.round(totalEstimatedTravelTime * 10) / 10,
  };

  // 5. Predict Per-Junction / Signal Arrival Times
  const junctionArrivals = calculateJunctionArrivals({
    edges,
    signals,
    currentRoadIndex,
    currentRoadProgress,
    effectiveSpeedMs,
    currentSimulationTime,
  });

  const formattedEta = formatSecondsToMmSs(totalEstimatedTravelTime);
  const assumptions = `Estimated at ${speedSource}. Free-flow: ${costBreakdown.freeFlowTime}s, Traffic Delay: +${costBreakdown.trafficDelay}s, Signal Delay: +${costBreakdown.signalDelay}s.`;

  return {
    success: true,
    totalRemainingDistance: Math.round(totalRemainingDistance * 10) / 10,
    estimatedTravelTime: Math.round(totalEstimatedTravelTime * 10) / 10,
    formattedEta,
    effectiveSpeedKmh: Math.round(effectiveSpeedKmh * 10) / 10,
    effectiveSpeedMs: Math.round(effectiveSpeedMs * 10) / 10,
    isArrived: false,
    costBreakdown,
    perRoadEta,
    junctionArrivals,
    assumptions,
    edges,
  };
}

/**
 * Calculates deterministic arrival seconds for each signal along the remaining route.
 */
function calculateJunctionArrivals({
  edges,
  signals,
  currentRoadIndex,
  currentRoadProgress,
  effectiveSpeedMs,
  currentSimulationTime,
}: {
  edges: RoadEdge[];
  signals: SignalInput[];
  currentRoadIndex: number;
  currentRoadProgress: number;
  effectiveSpeedMs: number;
  currentSimulationTime: number;
}): JunctionArrival[] {
  const arrivals: JunctionArrival[] = [];

  // Cumulative distance tracker along the remaining route
  let cumulativeDist = 0;
  let cumulativeDelays = 0;

  for (let i = currentRoadIndex; i < edges.length; i++) {
    const edge = edges[i];
    const isCurrent = i === currentRoadIndex;
    const progress = isCurrent ? currentRoadProgress : 0;
    const remainingEdgeDist = edge.distance * (1 - progress);

    // Find signals on this road
    const roadSignals = signals.filter((s) => s.road === edge.id);

    for (const sig of roadSignals) {
      // Estimate signal position along road (or 0.5 middle of road if not positioned)
      let sigProgressAlongEdge = 0.5;
      if (sig.position && edge.points && edge.points.length >= 2) {
        const start = edge.points[0];
        const end = edge.points[edge.points.length - 1];
        const totalSpan = Math.hypot(end.x - start.x, end.y - start.y);
        if (totalSpan > 0) {
          const sigDist = Math.hypot(sig.position.x - start.x, sig.position.y - start.y);
          sigProgressAlongEdge = Math.max(0.05, Math.min(0.98, sigDist / totalSpan));
        }
      }

      if (isCurrent && sigProgressAlongEdge < progress) {
        // Ambulance has already passed this signal on the current road
        continue;
      }

      const distToSigFromRoadStart = edge.distance * (sigProgressAlongEdge - progress);
      const totalDistToSignal = cumulativeDist + Math.max(0, distToSigFromRoadStart);

      const kinematicTimeToSig = totalDistToSignal / effectiveSpeedMs;
      const predictedArrivalSeconds = Math.round((kinematicTimeToSig + cumulativeDelays) * 10) / 10;
      const predictedArrivalSimulationTime =
        Math.round((currentSimulationTime + predictedArrivalSeconds) * 10) / 10;

      arrivals.push({
        signalId: sig.id,
        name: sig.name ?? sig.id,
        roadId: edge.id,
        position: sig.position,
        distanceFromAmbulance: Math.round(totalDistToSignal * 10) / 10,
        predictedArrivalSeconds,
        predictedArrivalSimulationTime,
      });
    }

    cumulativeDist += remainingEdgeDist;
    cumulativeDelays += edge.trafficDelay * (remainingEdgeDist / (edge.distance || 1)) + edge.signalDelay;
  }

  // Sort chronologically by arrival time
  arrivals.sort((a, b) => a.predictedArrivalSeconds - b.predictedArrivalSeconds);
  return arrivals;
}
