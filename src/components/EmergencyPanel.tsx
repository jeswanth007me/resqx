import { useMemo } from 'react';
import { AmbulanceStatus } from './AmbulanceStatus';
import { AIRecommendationCard } from './AIRecommendationCard';
import { SignalStatus } from './SignalStatus';
import { RouteStatus } from './RouteStatus';
import { TrafficStatus } from './TrafficStatus';
import { EventTimeline } from './EventTimeline';
import { PoliceCoordinationCard } from './PoliceCoordinationCard';
import type { TelemetryData } from '../types/telemetry';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import type { AIRecommendation } from '../types/ai';
import { mockAIRecommendation } from '../data/mockData';
import { PoliceCoordinator } from '../services/policeCoordinator';
import { getDefaultCityGraph } from '../routing/graph';
import { calculateAmbulanceRoute } from '../routing/engine';
import { calculateAmbulanceEta } from '../routing/eta';
import { planEmergencyCorridor } from '../routing/corridor';

import type { EmergencyEvent } from '../types/events';

import { PerformanceBenchmarkCard } from './PerformanceBenchmarkCard';

interface EmergencyPanelProps {
  telemetry: TelemetryData | null;
  connectionStatus?: ConnectionStatus;
  recommendation?: AIRecommendation;
  events?: EmergencyEvent[];
  onExecuteRecommendation?: () => void;
  onDismissRecommendation?: () => void;
}

export function EmergencyPanel({
  telemetry,
  connectionStatus,
  recommendation,
  events,
  onExecuteRecommendation,
  onDismissRecommendation,
}: EmergencyPanelProps) {
  const isConnected = connectionStatus === 'CONNECTED';
  const amb = telemetry?.ambulance;
  const traffic = telemetry?.traffic;
  const coordinator = useMemo(() => new PoliceCoordinator(), []);

  // Compute live corridor & police assignments from current telemetry
  const { assignments, corridorPlan } = useMemo(() => {
    const graph = getDefaultCityGraph();
    const route = calculateAmbulanceRoute(graph);
    const eta = calculateAmbulanceEta({
      routeResult: route,
      ambulance: {
        speedKmh: amb?.speedKmh ?? 50,
        currentRoadId: amb?.currentRoad ?? 'ROAD-01',
        progressOnCurrentRoad: 0,
        status: amb?.status ?? 'EN_ROUTE',
      },
    });
    const corridor = planEmergencyCorridor(eta);
    const officerAssignments = coordinator.assignOfficersForCorridor(
      corridor,
      amb?.id ?? 'AMB-01',
      telemetry?.simulation.elapsedTime ?? 0
    );
    return { assignments: officerAssignments, corridorPlan: corridor };
  }, [coordinator, amb?.speedKmh, amb?.currentRoad, amb?.status, amb?.id, telemetry?.simulation.elapsedTime]);

  // Render pure state-transition events audit trail from canonical pipeline
  const combinedEvents = useMemo(() => {
    if (!events || events.length === 0) {
      if (!telemetry || telemetry.ambulance.status === 'STAGED') {
        return [
          {
            id: 'evt-system-ready',
            timestamp: 0,
            type: 'SYSTEM_READY',
            description: 'ResQX Dispatch Engine Standby. Ready for emergency mission.',
            severity: 'INFO' as const,
            relatedUnit: 'AMB-01',
          },
        ];
      }
      return [];
    }

    const seen = new Set<string>();
    return events.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [events, telemetry]);

  const activeRecommendation =
    recommendation ??
    (amb?.nextSignal && amb.nextSignal !== 'HOSPITAL'
      ? {
          ...mockAIRecommendation,
          recommendation: `Prioritize ${amb.nextSignal} now`,
          reason: `AMB-01 is ${amb.distanceToNextSignal}m from ${amb.nextSignal}. Initiating emergency green wave.`,
          targetSignal: amb.nextSignal,
        }
      : mockAIRecommendation);

  return (
    <aside className="w-[400px] bg-surface-container flex flex-col h-full overflow-y-auto custom-scrollbar z-20 shadow-[-8px_0_24px_-8px_rgba(0,0,0,0.5)]">
      {/* Connection Warning Banner if Disconnected */}
      {!isConnected && (
        <div className="bg-error-container/80 text-on-error-container px-4 py-2 text-xs font-data font-semibold text-center border-b border-error/30">
          SUMO TELEMETRY DISCONNECTED — Start python telemetry_server.py
        </div>
      )}

      <AmbulanceStatus
        telemetry={amb}
        id={amb?.id ?? 'AMB-01'}
        status={amb?.status ?? (isConnected ? 'STAGED' : 'DISCONNECTED')}
        eta={amb ? `${amb.etaSeconds}s` : '--'}
        speed={amb?.speedKmh ?? 0}
        speedUnit="km/h"
        distanceToTarget={amb?.distanceToNextSignal ?? 0}
        distanceUnit="m"
      />

      <PoliceCoordinationCard
        assignments={assignments}
        onAlertAcknowledged={(alertId) => {
          console.log('[ResQX Alert] Acknowledged:', alertId);
        }}
      />

      <AIRecommendationCard
        recommendation={activeRecommendation}
        onExecute={onExecuteRecommendation ?? (() => console.log('[ResQX] AI Override Executed'))}
        onDismiss={onDismissRecommendation ?? (() => console.log('[ResQX] AI Recommendation Dismissed'))}
      />

      <RouteStatus
        name={amb?.currentRoad ?? 'Corridor 04'}
        distance={amb ? `${amb.distanceToNextSignal}m to ${amb.nextSignal}` : '--'}
        estimatedTime={amb ? `${amb.etaSeconds}s` : '--'}
        signals={corridorPlan.signals.length}
        status={amb?.status ?? 'Ready'}
      />

      <TrafficStatus
        density={traffic ? traffic.vehicleCount * 25 : 0}
        congestion={traffic?.level ?? 'LOW'}
        averageSpeed={31}
        speedUnit="km/h"
      />

      <SignalStatus signals={telemetry?.signals} />

      <PerformanceBenchmarkCard />

      <EventTimeline events={combinedEvents} />
    </aside>
  );
}