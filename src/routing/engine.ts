/**
 * ResQX Routing Engine API
 *
 * Provides high-level functions for route planning, graph synchronization,
 * and emergency corridor optimization.
 */

import type { SimulationState } from '../types/simulation.ts';
import type { RoadGraph, RouteResult } from '../types/routing.ts';
import { getDefaultCityGraph, cloneRoadGraph, setEdgeTrafficDelay, setEdgeSignalDelay } from './graph.ts';
import { findOptimalRoute } from './dijkstra.ts';

export interface RoutingEngineOptions {
  originNodeId?: string;
  destinationNodeId?: string;
}

/**
 * Calculates the best emergency route for the ambulance.
 */
export function calculateAmbulanceRoute(
  graph: RoadGraph = getDefaultCityGraph(),
  options: RoutingEngineOptions = {}
): RouteResult {
  const origin = options.originNodeId ?? 'NODE_NORTH';
  const destination = options.destinationNodeId ?? 'NODE_HOSPITAL';
  return findOptimalRoute(graph, origin, destination);
}

/**
 * Updates a road graph's dynamic delays based on live simulation state.
 */
export function syncGraphWithSimulation(
  baseGraph: RoadGraph,
  state: SimulationState
): RoadGraph {
  const graph = cloneRoadGraph(baseGraph);

  // Sync traffic vehicle counts to edges
  const edgeVehicleCounts = new Map<string, number>();
  for (const vehicle of state.vehicles) {
    edgeVehicleCounts.set(vehicle.road, (edgeVehicleCounts.get(vehicle.road) ?? 0) + 1);
  }

  for (const [roadId, count] of edgeVehicleCounts) {
    // 5 seconds delay per queued vehicle on that road segment
    setEdgeTrafficDelay(graph, roadId, count * 5);
  }

  // Sync signal states to edges
  for (const signal of state.signals) {
    if (signal.state === 'RED') {
      // Add delay based on signal queue length or standard red phase
      const delay = Math.max(5, signal.queueLength * 3);
      setEdgeSignalDelay(graph, signal.road, delay);
    } else if (signal.state === 'GREEN' || signal.state === 'EMERGENCY_PRIORITY') {
      setEdgeSignalDelay(graph, signal.road, 0);
    }
  }

  return graph;
}
