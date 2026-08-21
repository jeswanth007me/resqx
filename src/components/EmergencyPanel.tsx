import { AmbulanceStatus } from './AmbulanceStatus';
import { AIRecommendationCard } from './AIRecommendationCard';
import { SignalStatus } from './SignalStatus';
import { RouteStatus } from './RouteStatus';
import { TrafficStatus } from './TrafficStatus';
import { EventTimeline } from './EventTimeline';
import {
  mockAmbulancePanel,
  mockAIRecommendation,
  mockSignalStatuses,
  mockRoute,
  mockTraffic,
  mockEvents,
} from '../data/mockData';

/**
 * EmergencyPanel — Right sidebar for the operational dashboard.
 *
 * Composes all emergency control sub-components.
 * Currently uses mock data for visual development.
 * Will be connected to live telemetry streams later.
 */
export function EmergencyPanel() {
  return (
    <aside className="w-[400px] bg-surface-container flex flex-col h-full overflow-y-auto custom-scrollbar z-20 shadow-[-8px_0_24px_-8px_rgba(0,0,0,0.5)]">
      <AmbulanceStatus
        id={mockAmbulancePanel.id}
        status={mockAmbulancePanel.status}
        eta={mockAmbulancePanel.eta}
        speed={mockAmbulancePanel.speed}
        speedUnit={mockAmbulancePanel.speedUnit}
        distanceToTarget={mockAmbulancePanel.distanceToTarget}
        distanceUnit={mockAmbulancePanel.distanceUnit}
      />

      <AIRecommendationCard
        recommendation={mockAIRecommendation}
        onExecute={() => console.log('[ResQX] AI Override Executed')}
        onDismiss={() => console.log('[ResQX] AI Recommendation Dismissed')}
      />

      <RouteStatus
        name={mockRoute.name}
        distance={mockRoute.distance}
        estimatedTime={mockRoute.estimatedTime}
        signals={mockRoute.signals}
        status={mockRoute.status}
      />

      <TrafficStatus
        density={mockTraffic.density}
        congestion={mockTraffic.congestion}
        averageSpeed={mockTraffic.averageSpeed}
        speedUnit={mockTraffic.speedUnit}
      />

      <SignalStatus signals={mockSignalStatuses} />

      <EventTimeline events={mockEvents} />
    </aside>
  );
}
