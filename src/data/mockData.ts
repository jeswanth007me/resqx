/**
 * ResQX — Mock / Sample Data
 *
 * This data is for VISUAL DEVELOPMENT ONLY.
 * It is clearly separated from the real simulation state.
 *
 * When live telemetry is connected, components should consume
 * data from useSimulation() or the telemetry stream instead.
 */

import type { AIRecommendation } from '../types/ai';
import type { EmergencyEvent } from '../types/events';

// ─── Mock AI Recommendation ─────────────────────────────────────────

export const mockAIRecommendation: AIRecommendation = {
  id: 'rec-001',
  recommendation: 'Prioritize SIG-02 now',
  reason:
    'Clear cross-traffic backlog ahead of AMB-01 arrival. Northbound traffic queue is increasing rapidly. Initiating preemption sequence now will clear the intersection 12 seconds prior to arrival.',
  confidence: 94,
  targetSignal: 'SIG-02',
  action: 'EXECUTE_OVERRIDE',
  timestamp: Date.now(),
};

// ─── Mock Signal Statuses (for panel display) ────────────────────────

export interface SignalPanelItem {
  id: string;
  name: string;
  distance: string;
  status: 'priority' | 'preparing' | 'normal' | 'override';
}

export const mockSignalStatuses: SignalPanelItem[] = [
  { id: 'SIG-01', name: 'North Gate', distance: '120m ahead', status: 'priority' },
  { id: 'SIG-02', name: 'Central Avenue', distance: '640m ahead', status: 'preparing' },
  { id: 'SIG-03', name: 'Hospital Approach', distance: '1.2km ahead', status: 'normal' },
];

// ─── Mock Events Timeline ────────────────────────────────────────────

export const mockEvents: EmergencyEvent[] = [
  {
    id: 'evt-001',
    timestamp: 51502, // 14:18:22 in seconds from midnight
    type: 'SIGNAL_PREPARED',
    description: 'SIG-01 Prepared (Phase Locked)',
    severity: 'SUCCESS',
    relatedSignal: 'SIG-01',
  },
  {
    id: 'evt-002',
    timestamp: 51465, // 14:17:45
    type: 'ROUTE_CALCULATED',
    description: 'Route Calculated (Corridor A)',
    severity: 'INFO',
  },
  {
    id: 'evt-003',
    timestamp: 51430, // 14:17:10
    type: 'EMERGENCY_INITIATED',
    description: 'Emergency Protocol Initiated',
    severity: 'CRITICAL',
    relatedUnit: 'AMB-01',
  },
];

// ─── Mock Ambulance Panel Data ───────────────────────────────────────

export const mockAmbulancePanel = {
  id: 'AMB-01',
  status: 'Active' as const,
  eta: '04:32',
  speed: 42,
  speedUnit: 'km/h',
  distanceToTarget: 2.4,
  distanceUnit: 'km',
};

// ─── Mock Route Data ─────────────────────────────────────────────────

export const mockRoute = {
  name: 'Corridor A',
  distance: '2.4 km',
  estimatedTime: '04:32',
  signals: 3,
  status: 'Active' as const,
};

// ─── Mock Traffic Data ───────────────────────────────────────────────

export const mockTraffic = {
  density: 62,
  congestion: 'Moderate' as const,
  averageSpeed: 31,
  speedUnit: 'km/h',
};
