/**
 * ResQX Road Network Graph Model
 *
 * Models city intersections as Nodes and road segments as weighted Edges.
 * Provides functions for constructing, updating, and querying the road network.
 */

import type { IntersectionNode, RoadEdge, RoadGraph } from '../types/routing.ts';
import { HOSPITAL } from '../simulation/city.ts';

/**
 * Creates an empty or pre-populated RoadGraph.
 */
export function createRoadGraph(
  nodes: IntersectionNode[] = [],
  edges: RoadEdge[] = []
): RoadGraph {
  const nodeMap = new Map<string, IntersectionNode>();
  const edgeMap = new Map<string, RoadEdge>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    edgeMap.set(edge.id, edge);
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    adjacency.get(edge.from)!.push(edge.id);
  }

  return { nodes: nodeMap, edges: edgeMap, adjacency };
}

/**
 * Creates the standard ResQX deterministic city road network graph.
 *
 * Topology Overview:
 * - NODE_NORTH (North Dispatch): Ambulance origin (300, 40)
 * - NODE_CENTRAL (Central Intersection): Hub crossing Central Ave & North Corridor (300, 275)
 * - NODE_WEST (West Intersection): West end of Central Ave (80, 275)
 * - NODE_EAST (East Intersection): East end of Central Ave (520, 275)
 * - NODE_WEST_SOUTH (West Bypass Junction): Detour route corner (185, 440)
 * - NODE_EAST_SOUTH (East Bypass Junction): Detour route corner (415, 440)
 * - NODE_HOSPITAL (Hospital Arrival): Destination facility (300, 545)
 */
export function getDefaultCityGraph(): RoadGraph {
  const nodes: IntersectionNode[] = [
    { id: 'NODE_NORTH', name: 'North Dispatch Area', position: { x: 300, y: 40 } },
    { id: 'NODE_CENTRAL', name: 'Central Intersection (SIG-02)', position: { x: 300, y: 275 } },
    { id: 'NODE_WEST', name: 'West Junction', position: { x: 80, y: 275 } },
    { id: 'NODE_EAST', name: 'East Junction (SIG-04)', position: { x: 520, y: 275 } },
    { id: 'NODE_WEST_SOUTH', name: 'West South Junction', position: { x: 185, y: 440 } },
    { id: 'NODE_EAST_SOUTH', name: 'East South Junction', position: { x: 415, y: 440 } },
    { id: 'NODE_HOSPITAL', name: 'General Hospital', position: HOSPITAL },
  ];

  const edges: RoadEdge[] = [
    // 1. Direct Central Corridor
    {
      id: 'ROAD-01',
      name: 'North Approach (Direct)',
      from: 'NODE_NORTH',
      to: 'NODE_CENTRAL',
      distance: 235,
      baseTravelTime: 20,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 300, y: 40 },
        { x: 300, y: 150 },
        { x: 300, y: 275 },
      ],
    },
    {
      id: 'ROAD-03',
      name: 'Hospital Link (Direct)',
      from: 'NODE_CENTRAL',
      to: 'NODE_HOSPITAL',
      distance: 270,
      baseTravelTime: 25,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 300, y: 275 },
        { x: 300, y: 400 },
        { x: 300, y: 545 },
      ],
    },

    // 2. Central Avenue Connections (Cross streets)
    {
      id: 'ROAD-02-W',
      name: 'Central Ave Westbound',
      from: 'NODE_CENTRAL',
      to: 'NODE_WEST',
      distance: 220,
      baseTravelTime: 20,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 300, y: 275 },
        { x: 80, y: 275 },
      ],
    },
    {
      id: 'ROAD-02-E',
      name: 'Central Ave Eastbound',
      from: 'NODE_CENTRAL',
      to: 'NODE_EAST',
      distance: 220,
      baseTravelTime: 20,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 300, y: 275 },
        { x: 520, y: 275 },
      ],
    },

    // 3. West Bypass Route
    {
      id: 'ROAD-04',
      name: 'West Connector',
      from: 'NODE_WEST',
      to: 'NODE_WEST_SOUTH',
      distance: 270,
      baseTravelTime: 24,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 80, y: 275 },
        { x: 80, y: 440 },
        { x: 185, y: 440 },
      ],
    },
    {
      id: 'ROAD-06',
      name: 'West Hospital Access',
      from: 'NODE_WEST_SOUTH',
      to: 'NODE_HOSPITAL',
      distance: 155,
      baseTravelTime: 15,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 185, y: 440 },
        { x: 300, y: 545 },
      ],
    },

    // 4. East Bypass Route
    {
      id: 'ROAD-05',
      name: 'East Connector',
      from: 'NODE_EAST',
      to: 'NODE_EAST_SOUTH',
      distance: 270,
      baseTravelTime: 24,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 520, y: 275 },
        { x: 520, y: 440 },
        { x: 415, y: 440 },
      ],
    },
    {
      id: 'ROAD-07',
      name: 'East Hospital Access',
      from: 'NODE_EAST_SOUTH',
      to: 'NODE_HOSPITAL',
      distance: 155,
      baseTravelTime: 15,
      trafficDelay: 0,
      signalDelay: 0,
      blocked: false,
      points: [
        { x: 415, y: 440 },
        { x: 300, y: 545 },
      ],
    },
  ];

  return createRoadGraph(nodes, edges);
}

/**
 * Clones a RoadGraph so modifications do not mutate the source graph.
 */
export function cloneRoadGraph(graph: RoadGraph): RoadGraph {
  const nodes = Array.from(graph.nodes.values()).map((n) => ({ ...n }));
  const edges = Array.from(graph.edges.values()).map((e) => ({
    ...e,
    points: e.points ? [...e.points] : undefined,
  }));
  return createRoadGraph(nodes, edges);
}

/**
 * Updates the traffic delay on a specific road edge.
 */
export function setEdgeTrafficDelay(graph: RoadGraph, edgeId: string, trafficDelay: number): boolean {
  const edge = graph.edges.get(edgeId);
  if (!edge) return false;
  edge.trafficDelay = Math.max(0, trafficDelay);
  return true;
}

/**
 * Updates the signal delay on a specific road edge.
 */
export function setEdgeSignalDelay(graph: RoadGraph, edgeId: string, signalDelay: number): boolean {
  const edge = graph.edges.get(edgeId);
  if (!edge) return false;
  edge.signalDelay = Math.max(0, signalDelay);
  return true;
}

/**
 * Sets the blocked status on a specific road edge.
 */
export function setEdgeBlocked(graph: RoadGraph, edgeId: string, blocked: boolean): boolean {
  const edge = graph.edges.get(edgeId);
  if (!edge) return false;
  edge.blocked = blocked;
  return true;
}
