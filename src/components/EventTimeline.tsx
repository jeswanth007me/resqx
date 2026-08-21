import { useLocale } from '../i18n/useLocale';
import type { EmergencyEvent } from '../types/events';

interface EventTimelineProps {
  events: EmergencyEvent[];
}

const severityDot: Record<EmergencyEvent['severity'], string> = {
  SUCCESS: 'bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)]',
  INFO: 'bg-surface-variant border-2 border-surface-container',
  WARNING: 'bg-tertiary shadow-[0_0_8px_rgba(255,185,95,0.6)]',
  CRITICAL: 'bg-error border-2 border-surface-container',
};

const severityText: Record<EmergencyEvent['severity'], string> = {
  SUCCESS: 'text-on-surface',
  INFO: 'text-on-surface',
  WARNING: 'text-on-surface',
  CRITICAL: 'text-error',
};

function formatEventTime(timestamp: number): string {
  const hours = Math.floor(timestamp / 3600);
  const minutes = Math.floor((timestamp % 3600) / 60);
  const seconds = Math.floor(timestamp % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} UTC`;
}

export function EventTimeline({ events }: EventTimelineProps) {
  const { t } = useLocale();

  return (
    <div className="p-[var(--spacing-margin)] flex-1">
      <h3 className="font-data text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
        {t.timeline.eventTimeline}
      </h3>

      <div className="relative pl-4 border-l border-surface-variant/60 ml-2 space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="relative">
            <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${severityDot[event.severity]} ${index === 0 ? 'w-3 h-3 -left-[22px]' : ''}`} />
            <div className="font-data text-[10px] font-semibold text-on-surface-variant mb-0.5">
              {formatEventTime(event.timestamp)}
            </div>
            <div className={`font-body text-sm ${severityText[event.severity]}`}>
              {event.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
