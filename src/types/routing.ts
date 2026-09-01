/**
 * ResQX Road Network & Dijkstra Routing Types
 */

import type { Point } from './simulation.ts';

export interface IntersectionNode {
  id: string;
  name: string;
  position: Point;
}

export interface RoadEdge {
  id: string;
  name: string;
  from: string; // Origin IntersectionNode ID
  to: string; // Destination IntersectionNode ID
  distance: number; // Length in meters / simulation units
  baseTravelTime: number; // Base free-flow travel time in seconds
  trafficDelay: number; // Extra delay due to congestion/vehicles in seconds
  signalDelay: number; // Extra delay due to traffic light red phase/queues in seconds
  blocked: boolean; // Whether the road is completely closed/blocked
  points?: Point[]; // Geometric polyline coordinates for rendering
}

export interface RoadGraph {
  nodes: Map<string, IntersectionNode>;
  edges: Map<string, RoadEdge>;
  adjacency: Map<string, string[]>; // nodeId -> array of outgoing edge IDs
}

export interface CostBreakdown {
  baseTravelTime: number;
  trafficDelay: number;
  signalDelay: number;
  totalCost: number;
}

export interface RouteResult {
  success: boolean;
  route: string[]; // Ordered sequence of node IDs
  roadIds: string[]; // Ordered sequence of road/edge IDs
  totalDistance: number; // Total distance in meters
  totalEstimatedTravelTime: number; // Total estimated time (cost) in seconds
  costBreakdown: CostBreakdown;
  reason: string;
  edges: RoadEdge[];
}
