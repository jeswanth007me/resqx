import { AmbulanceStatus } from './AmbulanceStatus';
import { AIRecommendationCard } from './AIRecommendationCard';
import { SignalStatus } from './SignalStatus';
import { RouteStatus } from './RouteStatus';
import { TrafficStatus } from './TrafficStatus';
import { EventTimeline } from './EventTimeline';
import type { TelemetryData } from '../types/telemetry';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { decisionEngine } from '../ai/decisionEngine';

interface EmergencyPanelProps {
  telemetry: TelemetryData | null;
  connectionStatus?: ConnectionStatus;
}

export function EmergencyPanel({ telemetry, connectionStatus }: EmergencyPanelProps) {
  const isConnected = connectionStatus === 'CONNECTED';
  const amb = telemetry?.ambulance;
  const traffic = telemetry?.traffic;

  // Generate AI Recommendation from live telemetry using the decision engine
  const recommendation = decisionEngine(telemetry);

  // Construct dynamic timeline events strictly from active telemetry
  const liveEvents = telemetry
    ? [
        {
          id: 'evt-001',
          timestamp: telemetry.simulation.elapsedTime,
          type: 'TELEMETRY_UPDATE',
          description: amb?.status === 'ARRIVED'
            ? `AMB-01 ARRIVED AT ${telemetry.mission.destination} (Time Saved: ${telemetry.mission.timeSaved}s)`
            : `AMB-01 En Route on ${amb?.currentRoad} (Next: ${amb?.nextSignal})`,
          severity: amb?.status === 'ARRIVED' ? ('SUCCESS' as const) : ('CRITICAL' as const),
          relatedUnit: 'AMB-01',
        },
        ...telemetry.signals
          .filter((s) => s.emergencyState !== 'NORMAL')
          .map((s) => ({
            id: `evt-${s.id}`,
            timestamp: telemetry.simulation.elapsedTime,
            type: 'SIGNAL_PRIORITY',
            description: `${s.id} State: ${s.emergencyState}`,
            severity: s.emergencyState === 'EMERGENCY PRIORITY' ? ('CRITICAL' as const) : s.emergencyState === 'PREPARING' ? ('WARNING' as const) : ('SUCCESS' as const),
            relatedSignal: s.id,
          })),
      ]
    : [];

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

      <AIRecommendationCard
        recommendation={recommendation}
        onExecute={() => console.log('[ResQX] AI Override Executed')}
        onDismiss={() => console.log('[ResQX] AI Recommendation Dismissed')}
      />

      <RouteStatus
        name={amb?.currentRoad ?? 'Corridor 04'}
        distance={amb ? `${amb.distanceToNextSignal}m to ${amb.nextSignal}` : '--'}
        estimatedTime={amb ? `${amb.etaSeconds}s` : '--'}
        signals={telemetry?.signals.length ?? 2}
        status={amb?.status ?? 'Ready'}
      />

      <TrafficStatus
        density={traffic ? traffic.vehicleCount * 25 : 0}
        congestion={traffic?.level ?? 'LOW'}
        averageSpeed={31}
        speedUnit="km/h"
      />

      <SignalStatus signals={telemetry?.signals} />

      <EventTimeline events={liveEvents} />
    </aside>
  );
}
