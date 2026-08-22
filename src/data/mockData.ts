/**
 * ResQX — Mock / Sample Data
 *
 * This data is for VISUAL DEVELOPMENT ONLY.
 * It is clearly separated from the real simulation state.
 */

import type { AIRecommendation } from '../types/ai';
import type { EmergencyEvent } from '../types/events';

// ─── Mock AI Recommendation ─────────────────────────────────────────

export const mockAIRecommendation: AIRecommendation = {
  id: 'rec-001',
  recommendation: 'Prioritize SIG-01 now',
  reason:
    'Clear cross-traffic backlog ahead of AMB-01 arrival. Northbound traffic queue is increasing. Initiating preemption sequence now will clear the intersection 12 seconds prior to arrival.',
  confidence: 94,
  targetSignal: 'SIG-01',
  action: 'EXECUTE_OVERRIDE',
  timestamp: Date.now(),
};

// ─── Mock Signal Statuses ───────────────────────────────────────────

export interface SignalPanelItem {
  id: string;
  name: string;
  distance: string;
  status: 'priority' | 'preparing' | 'normal' | 'override';
}

export const mockSignalStatuses: SignalPanelItem[] = [
  { id: 'SIG-01', name: 'North Gate', distance: '100m ahead', status: 'normal' },
  { id: 'SIG-02', name: 'Central Avenue', distance: '200m ahead', status: 'normal' },
];

// ─── Mock Events Timeline ────────────────────────────────────────────

export const mockEvents: EmergencyEvent[] = [
  {
    id: 'evt-001',
    timestamp: 0,
    type: 'EMERGENCY_INITIATED',
    description: 'Emergency Protocol Initialized for AMB-01',
    severity: 'CRITICAL',
    relatedUnit: 'AMB-01',
  },
];

// ─── Mock Ambulance Panel Data ───────────────────────────────────────

export const mockAmbulancePanel = {
  id: 'AMB-01',
  status: 'STAGED' as const,
  eta: '00:28',
  speed: 0,
  speedUnit: 'km/h',
  distanceToTarget: 300,
  distanceUnit: 'm',
};

// ─── Mock Route Data ─────────────────────────────────────────────────

export const mockRoute = {
  name: 'Corridor 04',
  distance: '300m',
  estimatedTime: '00:28',
  signals: 2,
  status: 'STAGED' as const,
};

// ─── Mock Traffic Data ───────────────────────────────────────────────

export const mockTraffic = {
  density: 40,
  congestion: 'MODERATE' as const,
  averageSpeed: 31,
  speedUnit: 'km/h',
};
