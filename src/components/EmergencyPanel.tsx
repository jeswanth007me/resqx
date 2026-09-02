import { AmbulanceStatus } from './AmbulanceStatus';
import { AIRecommendationCard } from './AIRecommendationCard';
import { SignalStatus } from './SignalStatus';
import { RouteStatus } from './RouteStatus';
import { TrafficStatus } from './TrafficStatus';
import { EventTimeline } from './EventTimeline';
import type { AIRecommendation } from '../types/ai';
import { useSimulation } from '../state/useSimulation';

export function EmergencyPanel() {
  const { state } = useSimulation();

  const ambulance = state.ambulance;

  const etaSeconds = Math.max(
    0,
    Math.round(
      ((1 - ambulance.progress) * 900) /
        ambulance.speed,
    ),
  );

  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaRemainingSeconds = etaSeconds % 60;

  const eta = `${String(etaMinutes).padStart(2, '0')}:${String(
    etaRemainingSeconds,
  ).padStart(2, '0')}`;

  const distanceToTarget = Math.max(
    0,
    ((1 - ambulance.progress) * 760) / 1000,
  );

  const signalStatuses = state.signals.map((signal) => {
    let status:
      | 'priority'
      | 'preparing'
      | 'normal'
      | 'override';

    switch (signal.state) {
      case 'PREPARING':
        status = 'preparing';
        break;

      case 'PRIORITY':
      case 'PASSING':
        status = 'priority';
        break;

      default:
        status = 'normal';
    }

    const distance = Math.round(
      Math.hypot(
        signal.position.x - ambulance.position.x,
        signal.position.y - ambulance.position.y,
      ),
    );

    return {
      id: signal.id,
      name: signal.name,
      distance: `${distance}m ahead`,
      status,
    };
  });

  const congestion =
    state.vehicles.length > 6
      ? 'High'
      : state.vehicles.length > 3
        ? 'Moderate'
        : 'Low';

  const aiRecommendation: AIRecommendation = {
    id: 'live-decision',

    recommendation:
      state.decision.action === 'REQUEST_PRIORITY'
        ? `Prioritize ${state.decision.signalId}`
        : state.decision.action === 'RESTORE_SIGNAL'
          ? 'Restore emergency signals'
          : 'Monitoring emergency route',

    reason: state.decision.reason,

    confidence:
      state.decision.action === 'NO_ACTION'
        ? 0
        : 100,

    targetSignal: state.decision.signalId ?? '',

    action:
      state.decision.action === 'REQUEST_PRIORITY'
        ? 'EXECUTE_OVERRIDE'
        : 'DISMISS',

    timestamp: state.simulationTime,
  };

  return (
    <aside className="w-[400px] bg-surface-container flex flex-col h-full overflow-y-auto custom-scrollbar z-20 shadow-[-8px_0_24px_-8px_rgba(0,0,0,0.5)]">
      <AmbulanceStatus
        id={ambulance.id}
        status={
          ambulance.status === 'EN_ROUTE'
            ? 'Active'
            : ambulance.status === 'ARRIVED'
              ? 'Arrived'
              : 'Staged'
        }
        eta={eta}
        speed={ambulance.speed}
        speedUnit="km/h"
        distanceToTarget={Number(
          distanceToTarget.toFixed(2),
        )}
        distanceUnit="km"
      />

      <AIRecommendationCard
        recommendation={aiRecommendation}
        onExecute={() => {
          console.log(
            'RESQX: Decision',
            state.decision,
          );
        }}
        onDismiss={() => {
          console.log(
            'RESQX: Decision dismissed',
          );
        }}
      />

      <RouteStatus
        name={
          state.route?.name ??
          'Emergency Corridor'
        }
        distance={`${(
          state.route?.distance ??
          Math.max(
            0,
            (1 - ambulance.progress) * 760,
          )
        ).toFixed(1)} m`}
        estimatedTime={eta}
        signals={
          state.route?.signals.length ??
          state.signals.length
        }
        status={
          ambulance.status === 'EN_ROUTE'
            ? 'Active'
            : ambulance.status === 'ARRIVED'
              ? 'Completed'
              : 'Standby'
        }
      />

      <TrafficStatus
        density={state.vehicles.length}
        congestion={congestion}
        averageSpeed={
          state.vehicles.length > 0
            ? Math.round(
                state.vehicles.reduce(
                  (sum, vehicle) =>
                    sum + vehicle.speed,
                  0,
                ) / state.vehicles.length,
              )
            : 0
        }
        speedUnit="km/h"
      />

      <SignalStatus
        signals={signalStatuses}
      />

      <EventTimeline
        events={state.events}
      />
    </aside>
  );
}