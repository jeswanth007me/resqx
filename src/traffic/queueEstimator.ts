/**
 * ResQX Queue Estimation Engine
 *
 * Derives physical queue length, stopped vehicle counts, crawl delays,
 * and congestion levels from live simulation telemetry.
 */

import type { TelemetryVehicle } from '../types/telemetry.ts';
import type { RoadTrafficMetrics, QueueEstimationConfig, RoadCongestionLevel } from '../types/queue.ts';

const DEFAULT_CONFIG: Required<QueueEstimationConfig> = {
  stoppedSpeedThresholdKmh: 5.0, // Vehicles < 5 km/h are stationary / queuing
  slowSpeedThresholdKmh: 18.0, // Vehicles 5-18 km/h are in crawling stop-and-go
  stoppedVehicleDelaySeconds: 4.0, // 4.0s startup delay per stopped vehicle
  slowVehicleDelaySeconds: 1.5, // 1.5s crawl delay per slowing vehicle
  averageVehicleLengthMeters: 7.5, // 4.5m vehicle + 3.0m safety gap
};

/**
 * Estimates detailed traffic and queue metrics for each road based on vehicle telemetry.
 */
export function estimateRoadQueues(
  vehicles: TelemetryVehicle[] = [],
  userConfig: QueueEstimationConfig = {}
): Map<string, RoadTrafficMetrics> {
  const config: Required<QueueEstimationConfig> = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  const roadGroups = new Map<string, TelemetryVehicle[]>();

  // Group non-emergency civilian vehicles by road ID
  for (const v of vehicles) {
    if (v.type === 'emergency' || v.id === 'AMB-01') continue;
    if (!v.road) continue;

    if (!roadGroups.has(v.road)) {
      roadGroups.set(v.road, []);
    }
    roadGroups.get(v.road)!.push(v);
  }

  const metricsMap = new Map<string, RoadTrafficMetrics>();

  for (const [roadId, roadVehicles] of roadGroups) {
    const totalCount = roadVehicles.length;
    let stoppedCount = 0;
    let slowCount = 0;
    let speedSum = 0;

    for (const v of roadVehicles) {
      const speed = Math.max(0, v.speedKmh);
      speedSum += speed;

      if (speed < config.stoppedSpeedThresholdKmh) {
        stoppedCount += 1;
      } else if (speed < config.slowSpeedThresholdKmh) {
        slowCount += 1;
      }
    }

    const avgSpeed = totalCount > 0 ? Math.round((speedSum / totalCount) * 10) / 10 : 40.0;
    const queueLengthMeters = Math.round(stoppedCount * config.averageVehicleLengthMeters * 10) / 10;
    const queueDelay = Math.round(
      (stoppedCount * config.stoppedVehicleDelaySeconds + slowCount * config.slowVehicleDelaySeconds) * 10
    ) / 10;

    let congestionLevel: RoadCongestionLevel = 'LOW';
    if (stoppedCount >= 4 || avgSpeed < 10) {
      congestionLevel = 'HIGH';
    } else if (stoppedCount >= 2 || avgSpeed < 20) {
      congestionLevel = 'MODERATE';
    }

    metricsMap.set(roadId, {
      roadId,
      vehicleCount: totalCount,
      stoppedVehicleCount: stoppedCount,
      slowVehicleCount: slowCount,
      averageSpeedKmh: avgSpeed,
      queueLengthMeters,
      estimatedQueueDelaySeconds: queueDelay,
      congestionLevel,
      densityVehiclesPerKm: Math.round((totalCount / 0.3) * 10) / 10,
    });
  }

  return metricsMap;
}

/**
 * Calculates deterministic queue delay for a given number of stopped and slow vehicles.
 */
export function calculateQueueDelayFromCounts(
  stoppedCount: number,
  slowCount: number = 0,
  config: QueueEstimationConfig = {}
): number {
  const stoppedDelay = config.stoppedVehicleDelaySeconds ?? DEFAULT_CONFIG.stoppedVehicleDelaySeconds;
  const slowDelay = config.slowVehicleDelaySeconds ?? DEFAULT_CONFIG.slowVehicleDelaySeconds;
  return Math.max(0, Math.round((stoppedCount * stoppedDelay + slowCount * slowDelay) * 10) / 10);
}
