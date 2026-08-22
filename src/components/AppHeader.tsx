import { useLocale } from '../i18n/useLocale';
import type { Locale } from '../i18n/strings';
import type { ConnectionStatus } from '../telemetry/useResQXTelemetry';
import { formatTime } from '../utils/formatTime';

interface AppHeaderProps {
  activeTab: string;
  simulationTime: number;
  connectionStatus: ConnectionStatus;
  onTabChange?: (tab: string) => void;
}

const navTabs = [
  { key: 'simulation', label: 'simulation' as const },
  { key: 'emergency-queue', label: 'emergencyQueue' as const },
  { key: 'signals', label: 'signals' as const },
  { key: 'network-analytics', label: 'networkAnalytics' as const },
  { key: 'settings', label: 'settings' as const },
] as const;

const localeLabels: Record<Locale, string> = { en: 'EN', te: 'TL', hi: 'HI' };

export function AppHeader({ activeTab, simulationTime, connectionStatus, onTabChange }: AppHeaderProps) {
  const { locale, setLocale, t } = useLocale();
  const isConnected = connectionStatus === 'CONNECTED';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 glass-panel flex items-center justify-between px-[var(--spacing-margin)]">
      {/* Brand */}
      <div className="flex items-center gap-[var(--spacing-gutter)]">
        <div className="h-9 w-9 rounded-lg bg-primary-container flex items-center justify-center">
          <span className="font-headline text-lg font-bold text-on-primary-container">R</span>
        </div>
        <div className="h-8 w-[1px] bg-outline-variant mx-1" />
        <div className="flex flex-col">
          <span className="font-data text-[12px] font-semibold text-secondary tracking-widest uppercase">
            {t.header.systemStatus}
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-secondary animate-pulse' : 'bg-error'}`} />
            <span className="font-data text-on-surface text-sm">
              {isConnected ? 'SUMO LIVE' : 'SUMO DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="hidden lg:flex items-center h-full gap-8">
        {navTabs.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange?.(key)}
              className={`font-headline text-[16px] font-semibold transition-colors h-full flex items-center border-b-2 bg-transparent cursor-pointer ${
                isActive
                  ? 'text-primary border-primary'
                  : 'text-on-surface-variant hover:text-on-surface border-transparent'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {t.nav[label]}
            </button>
          );
        })}
      </nav>

      {/* Right: Clock + Language + Operator */}
      <div className="flex items-center gap-[var(--spacing-gutter)]">
        <div className="text-right hidden xl:block">
          <div className="font-data text-on-surface text-lg leading-none">
            {formatTime(simulationTime)}
          </div>
          <div className="font-data text-on-surface-variant text-[10px] uppercase">
            SIM TIME
          </div>
        </div>

        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="bg-surface-container-high text-on-surface font-data text-xs border-none rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-surface-container-highest"
        >
          {Object.entries(localeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <div className="flex items-center gap-3 pl-4 border-l border-outline-variant">
          <div className="text-right">
            <div className="text-xs font-headline font-semibold text-on-surface leading-none">
              OPERATOR 402
            </div>
            <div className="text-[10px] font-data font-semibold text-secondary">
              SENIOR ARCHITECT
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
