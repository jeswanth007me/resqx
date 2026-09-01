/**
 * ResQX Dijkstra Routing Engine
 *
 * Implements a deterministic Dijkstra shortest path algorithm with dynamic edge weighting.
 * Edge costs combine:
 *   edgeCost = baseTravelTime + trafficDelay + queueDelay + signalDelay
 * Blocked roads are strictly excluded from traversal.
 */

import type { CostBreakdown, RoadEdge, RoadGraph, RouteResult } from '../types/routing.ts';

/**
 * Calculates the dynamic emergency travel cost for an edge in seconds.
 * Returns Infinity if the road is blocked or invalid.
 */
export function calculateEdgeCost(edge: RoadEdge): number {
  if (edge.blocked) {
    return Infinity;
  }
  const base = Math.max(0, edge.baseTravelTime);
  const traffic = Math.max(0, edge.trafficDelay);
  const queue = Math.max(0, edge.queueDelay ?? 0);
  const signal = Math.max(0, edge.signalDelay);
  return base + traffic + queue + signal;
}

/**
 * Finds the optimal emergency route from origin to destination using Dijkstra's algorithm.
 *
 * @param graph The road network graph
 * @param originNodeId ID of origin intersection node
 * @param destinationNodeId ID of target intersection node (e.g. NODE_HOSPITAL)
 * @returns RouteResult with path, road IDs, total distance, travel time, and explanation.
 */
export function findOptimalRoute(
  graph: RoadGraph,
  originNodeId: string,
  destinationNodeId: string
): RouteResult {
  // Validate presence of origin and destination nodes
  if (!graph.nodes.has(originNodeId) || !graph.nodes.has(destinationNodeId)) {
    return createFailureResult(
      `Origin (${originNodeId}) or Destination (${destinationNodeId}) does not exist in graph.`
    );
  }

  if (originNodeId === destinationNodeId) {
    return {
      success: true,
      route: [originNodeId],
      roadIds: [],
      totalDistance: 0,
      totalEstimatedTravelTime: 0,
      costBreakdown: {
        baseTravelTime: 0,
        trafficDelay: 0,
        queueDelay: 0,
        signalDelay: 0,
        totalCost: 0,
      },
      reason: 'Ambulance is already at destination.',
      edges: [],
    };
  }

  // Dijkstra data structures
  const distances = new Map<string, number>();
  const previous = new Map<string, { prevNodeId: string; edge: RoadEdge }>();
  const unvisited = new Set<string>();

  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, Infinity);
    unvisited.add(nodeId);
  }

  distances.set(originNodeId, 0);

  while (unvisited.size > 0) {
    // Find node with minimum distance in unvisited set
    let currentNodeId: string | null = null;
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId) ?? Infinity;
      if (dist < minDistance) {
        minDistance = dist;
        currentNodeId = nodeId;
      }
    }

    // If no reachable unvisited node remains, stop
    if (currentNodeId === null || minDistance === Infinity) {
      break;
    }

    // If we reached destination, we can finish early
    if (currentNodeId === destinationNodeId) {
      break;
    }

    unvisited.delete(currentNodeId);

    // Examine outgoing edges
    const outgoingEdgeIds = graph.adjacency.get(currentNodeId) ?? [];
    for (const edgeId of outgoingEdgeIds) {
      const edge = graph.edges.get(edgeId);
      if (!edge || edge.blocked) {
        continue;
      }

      const neighborNodeId = edge.to;
      if (!unvisited.has(neighborNodeId)) {
        continue;
      }

      const cost = calculateEdgeCost(edge);
      if (cost === Infinity) {
        continue;
      }

      const candidateDist = minDistance + cost;
      const currentNeighborDist = distances.get(neighborNodeId) ?? Infinity;

      if (candidateDist < currentNeighborDist) {
        distances.set(neighborNodeId, candidateDist);
        previous.set(neighborNodeId, { prevNodeId: currentNodeId, edge });
      }
    }
  }

  const destinationDistance = distances.get(destinationNodeId) ?? Infinity;

  // If destination is unreachable, return clean failure
  if (destinationDistance === Infinity || !previous.has(destinationNodeId)) {
    return createFailureResult(
      'NO ROUTE AVAILABLE: All paths to destination are blocked or disconnected.'
    );
  }

  // Reconstruct path backwards from destination to origin
  const pathNodes: string[] = [destinationNodeId];
  const pathEdges: RoadEdge[] = [];
  let curr = destinationNodeId;

  while (curr !== originNodeId) {
    const step = previous.get(curr);
    if (!step) break;
    pathEdges.unshift(step.edge);
    curr = step.prevNodeId;
    pathNodes.unshift(curr);
  }

  // Calculate totals and breakdown
  let totalDistance = 0;
  let totalBase = 0;
  let totalTraffic = 0;
  let totalQueue = 0;
  let totalSignal = 0;

  for (const edge of pathEdges) {
    totalDistance += edge.distance;
    totalBase += edge.baseTravelTime;
    totalTraffic += edge.trafficDelay;
    totalQueue += edge.queueDelay ?? 0;
    totalSignal += edge.signalDelay;
  }

  const totalCost = totalBase + totalTraffic + totalQueue + totalSignal;
  const costBreakdown: CostBreakdown = {
    baseTravelTime: totalBase,
    trafficDelay: totalTraffic,
    queueDelay: totalQueue,
    signalDelay: totalSignal,
    totalCost,
  };

  const roadIds = pathEdges.map((e) => e.id);
  const reason = generateSelectionReason(roadIds, costBreakdown, graph);

  return {
    success: true,
    route: pathNodes,
    roadIds,
    totalDistance,
    totalEstimatedTravelTime: totalCost,
    costBreakdown,
    reason,
    edges: pathEdges,
  };
}

function createFailureResult(reason: string): RouteResult {
  return {
    success: false,
    route: [],
    roadIds: [],
    totalDistance: 0,
    totalEstimatedTravelTime: Infinity,
    costBreakdown: {
      baseTravelTime: 0,
      trafficDelay: 0,
      queueDelay: 0,
      signalDelay: 0,
      totalCost: Infinity,
    },
    reason,
    edges: [],
  };
}

function generateSelectionReason(roadIds: string[], breakdown: CostBreakdown, graph?: RoadGraph): string {
  const parts: string[] = [];
  if (breakdown.trafficDelay > 0) {
    parts.push(`+${breakdown.trafficDelay}s traffic delay`);
  }
  if (breakdown.queueDelay && breakdown.queueDelay > 0) {
    parts.push(`+${breakdown.queueDelay}s queue delay`);
  }
  if (breakdown.signalDelay > 0) {
    parts.push(`+${breakdown.signalDelay}s signal delay`);
  }

  // Check if primary road (ROAD-03) had heavy queue or was blocked
  let comparisonNote = '';
  if (graph) {
    const road03 = graph.edges.get('ROAD-03');
    if (road03) {
      if (road03.blocked && !roadIds.includes('ROAD-03')) {
        comparisonNote = ' (ROAD-03 blocked by incident; alternate corridor selected)';
      } else if (road03.queueDelay && road03.queueDelay > 15 && !roadIds.includes('ROAD-03')) {
        comparisonNote = ` (Direct ROAD-03 had heavy queue of +${road03.queueDelay}s delay; bypass selected)`;
      }
    }
  }

  const detail = parts.length > 0 ? ` (Base: ${breakdown.baseTravelTime}s, ${parts.join(', ')})` : ` (Base: ${breakdown.baseTravelTime}s)`;
  return `Lowest emergency travel cost under current traffic (${breakdown.totalCost}s total)${detail}${comparisonNote}: ${roadIds.join(' → ')}.`;
}
