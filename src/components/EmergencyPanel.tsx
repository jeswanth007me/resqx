import { AmbulanceStatus } from './AmbulanceStatus';
import { AIRecommendationCard } from './AIRecommendationCard';
import { SignalStatus } from './SignalStatus';
import { RouteStatus } from './RouteStatus';
import { TrafficStatus } from './TrafficStatus';
import { EventTimeline } from './EventTimeline';
import type { Telemetry } from '../types/telemetry';
import type { AIRecommendation } from '../types/ai';
import type { EmergencyEvent } from '../types/events';
import { formatTime } from '../utils/formatTime';
import type { SignalPanelItem } from '../data/mockData';

interface EmergencyPanelProps {
  telemetry: Telemetry;
  recommendation: AIRecommendation;
  onExecuteRecommendation: () => void;
  onDismissRecommendation: () => void;
}

/**
 * EmergencyPanel — Right sidebar for the operational dashboard.
 *
 * Composes all emergency control sub-components.
 * Connected to live telemetry streams and decision engine.
 */
export function EmergencyPanel({
  telemetry,
  recommendation,
  onExecuteRecommendation,
  onDismissRecommendation,
}: EmergencyPanelProps) {
  // Map telemetry signals to panel items
  const signalNames: Record<string, string> = {
    'SIG-01': 'North Gate',
    'SIG-02': 'Central Avenue',
    'SIG-03': 'Hospital Approach',
    'SIG-04': 'East Connector',
  };

  const signalItems: SignalPanelItem[] = telemetry.signals.map((sig) => {
    let status: SignalPanelItem['status'] = 'normal';
    if (sig.state === 'EMERGENCY_PRIORITY') {
      status = 'override';
    } else if (sig.state === 'GREEN') {
      status = 'priority';
    } else if (sig.state === 'RED' && telemetry.route.nextSignal === sig.id) {
      status = 'preparing';
    }

    return {
      id: sig.id,
      name: signalNames[sig.id] || sig.id,
      distance: `${sig.distanceFromAmbulance}m ahead`,
      status,
    };
  });

  // Generate dynamic events based on telemetry
  const timelineEvents: EmergencyEvent[] = [
    {
      id: 'evt-003',
      timestamp: 51430,
      type: 'EMERGENCY_INITIATED',
      description: 'Emergency Protocol Initiated (AMB-01)',
      severity: 'CRITICAL',
      relatedUnit: 'AMB-01',
    },
  ];

  if (telemetry.timestamp > 0) {
    timelineEvents.unshift({
      id: 'evt-002',
      timestamp: 51445,
      type: 'ROUTE_CALCULATED',
      description: 'Route Calculated (Corridor A)',
      severity: 'INFO',
    });
  }

  // Preemption events
  telemetry.signals.forEach((sig) => {
    if (sig.state === 'EMERGENCY_PRIORITY') {
      timelineEvents.unshift({
        id: `evt-${sig.id}-priority`,
        timestamp: 51460 + Math.round(telemetry.timestamp),
        type: 'SIGNAL_PREEMPTED',
        description: `Priority Override Active on ${sig.id}`,
        severity: 'SUCCESS',
        relatedSignal: sig.id,
      });
    }
  });

  if (telemetry.ambulance.emergencyStatus === 'ARRIVED') {
    timelineEvents.unshift({
      id: 'evt-arrived',
      timestamp: 51460 + Math.round(telemetry.timestamp),
      type: 'MISSION_COMPLETE',
      description: 'Asset Arrived at Hospital',
      severity: 'SUCCESS',
      relatedUnit: 'AMB-01',
    });
  }

  const distanceInKm = (telemetry.route.remainingDistance / 1000).toFixed(2);
  const etaString = formatTime(telemetry.ambulance.eta);

  return (
    <aside className="w-[400px] bg-surface-container flex flex-col h-full overflow-y-auto custom-scrollbar z-20 shadow-[-8px_0_24px_-8px_rgba(0,0,0,0.5)]">
      <AmbulanceStatus
        id={telemetry.ambulance.id}
        status={telemetry.ambulance.emergencyStatus}
        eta={etaString}
        speed={telemetry.ambulance.speed}
        speedUnit="km/h"
        distanceToTarget={parseFloat(distanceInKm)}
        distanceUnit="km"
      />

      <AIRecommendationCard
        recommendation={recommendation}
        onExecute={onExecuteRecommendation}
        onDismiss={onDismissRecommendation}
      />

      <RouteStatus
        name="Corridor A"
        distance={`${distanceInKm} km`}
        estimatedTime={etaString}
        signals={telemetry.signals.length}
        status={telemetry.ambulance.emergencyStatus === 'ARRIVED' ? 'Complete' : 'Active'}
      />

      <TrafficStatus
        density={Math.min(100, telemetry.traffic.vehicleCount * 15)}
        congestion={telemetry.traffic.congestionLevel}
        averageSpeed={34}
        speedUnit="km/h"
      />

      <SignalStatus signals={signalItems} />

      <EventTimeline events={timelineEvents} />
    </aside>
  );
}