/**
 * ResQX Simulation Scenario Engine
 *
 * Implements deterministic traffic scenarios that modify road network queues,
 * delays, and blockages to demonstrate dynamic rerouting.
 */

import type { RoadGraph } from '../types/routing.ts';
import { cloneRoadGraph, setEdgeQueueDelay, setEdgeTrafficDelay, setEdgeBlocked } from '../routing/graph.ts';

export type TrafficScenarioType = 'NORMAL' | 'HIGH_TRAFFIC' | 'ROAD_BLOCKAGE';

export interface ScenarioDefinition {
  id: TrafficScenarioType;
  name: string;
  description: string;
  expectedRoute: string[];
}

export const SCENARIOS: Record<TrafficScenarioType, ScenarioDefinition> = {
  NORMAL: {
    id: 'NORMAL',
    name: 'Normal Traffic Baseline',
    description: 'Free-flow standard conditions across all corridors. Direct North-to-Hospital link is fastest.',
    expectedRoute: ['ROAD-01', 'ROAD-03'],
  },
  HIGH_TRAFFIC: {
    id: 'HIGH_TRAFFIC',
    name: 'Heavy Corridor Congestion',
    description: 'Heavy queue backlog on ROAD-03 (8 stopped vehicles, +32s queue delay). Detour via West Corridor selected.',
    expectedRoute: ['ROAD-01', 'ROAD-02-W', 'ROAD-04', 'ROAD-06'],
  },
  ROAD_BLOCKAGE: {
    id: 'ROAD_BLOCKAGE',
    name: 'Emergency Road Closure',
    description: 'Direct ROAD-03 blocked by incident. Dijkstra excludes blocked road and safely reroutes via West Bypass.',
    expectedRoute: ['ROAD-01', 'ROAD-02-W', 'ROAD-04', 'ROAD-06'],
  },
};

/**
 * Applies a deterministic scenario's conditions to a RoadGraph.
 */
export function applyScenarioToGraph(baseGraph: RoadGraph, scenario: TrafficScenarioType): RoadGraph {
  const graph = cloneRoadGraph(baseGraph);

  if (scenario === 'NORMAL') {
    // Reset all delays and blockages to baseline
    for (const edge of graph.edges.values()) {
      edge.trafficDelay = 0;
      edge.queueDelay = 0;
      edge.blocked = false;
    }
  } else if (scenario === 'HIGH_TRAFFIC') {
    // Inject heavy traffic queue specifically on ROAD-03
    // Direct corridor base is 20s (ROAD-01) + 25s (ROAD-03) = 45s.
    // Injecting 36s queue delay on ROAD-03 brings direct cost to 45 + 36 = 81s.
    // West Bypass cost is 79s (ROAD-01 20s + ROAD-02-W 20s + ROAD-04 24s + ROAD-06 15s = 79s).
    // 79s < 81s, so ResQX selects West Bypass deterministically!
    setEdgeQueueDelay(graph, 'ROAD-03', 36);
    setEdgeTrafficDelay(graph, 'ROAD-03', 5);
  } else if (scenario === 'ROAD_BLOCKAGE') {
    // Completely block ROAD-03 (accident closure)
    setEdgeBlocked(graph, 'ROAD-03', true);
  }

  return graph;
}
