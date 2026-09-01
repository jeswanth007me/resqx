/**
 * ResQX Queue-Aware Traffic Intelligence Types
 *
 * Defines contracts for real-time queue estimation, stopped-vehicle metrics,
 * congestion scoring, and dynamic queue-delay calculations.
 */

export type RoadCongestionLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'BLOCKED';

export interface RoadTrafficMetrics {
  roadId: string;
  vehicleCount: number;
  stoppedVehicleCount: number; // Vehicles with speed < stoppedSpeedThreshold
  slowVehicleCount: number; // Vehicles with speed between stopped and slow thresholds
  averageSpeedKmh: number; // Mean speed of non-emergency vehicles on this road
  queueLengthMeters: number; // Estimated physical queue length in meters
  estimatedQueueDelaySeconds: number; // Queue clearance penalty in seconds
  congestionLevel: RoadCongestionLevel;
  densityVehiclesPerKm: number;
}

export interface QueueEstimationConfig {
  stoppedSpeedThresholdKmh?: number; // Speed below which a vehicle is considered stopped (default: 5 km/h)
  slowSpeedThresholdKmh?: number; // Speed below which a vehicle is considered in congested crawl (default: 18 km/h)
  stoppedVehicleDelaySeconds?: number; // Startup/clearance delay added per stopped vehicle (default: 4.0s)
  slowVehicleDelaySeconds?: number; // Crawl delay added per slow vehicle (default: 1.5s)
  averageVehicleLengthMeters?: number; // Physical length + safe inter-vehicle headway (default: 7.5m)
}
