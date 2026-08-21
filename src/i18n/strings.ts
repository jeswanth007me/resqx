/**
 * ResQX — Internationalization String Constants
 *
 * All user-facing strings are defined here, organized by locale.
 * English (en) is fully populated. Telugu (te) and Hindi (hi) are stubs
 * ready for translation.
 *
 * Usage: import { strings } from '@/i18n/strings'; strings[locale].nav.simulation
 */

export type Locale = 'en' | 'te' | 'hi';

export interface LocaleStrings {
  // Navigation
  nav: {
    simulation: string;
    emergencyQueue: string;
    signals: string;
    networkAnalytics: string;
    settings: string;
  };
  // Header
  header: {
    systemStatus: string;
    operational: string;
  };
  // Simulation
  simulation: {
    title: string;
    cityNetworkInitializing: string;
    scenarioSelection: string;
    startEmergency: string;
    liveSimulation: string;
    simulationPaused: string;
    runComplete: string;
    simulationSpeed: string;
  };
  // Controls
  controls: {
    start: string;
    pause: string;
    reset: string;
    play: string;
  };
  // Emergency Panel
  emergency: {
    priorityAsset: string;
    active: string;
    eta: string;
    currentSpeed: string;
    distanceToTarget: string;
    status: string;
  };
  // Signals
  signals: {
    liveRouteSignals: string;
    online: string;
    priority: string;
    preparing: string;
    normal: string;
    override: string;
  };
  // AI
  ai: {
    intelligence: string;
    confidence: string;
    executeOverride: string;
    dismiss: string;
  };
  // Timeline
  timeline: {
    eventTimeline: string;
  };
  // Traffic
  traffic: {
    trafficConditions: string;
    density: string;
    congestion: string;
    averageSpeed: string;
  };
  // Scenarios
  scenarios: {
    highRiseFire: string;
    floodResponse: string;
    custom: string;
  };
}

const en: LocaleStrings = {
  nav: {
    simulation: 'Simulation',
    emergencyQueue: 'Emergency Queue',
    signals: 'Signals',
    networkAnalytics: 'Network Analytics',
    settings: 'Settings',
  },
  header: {
    systemStatus: 'System Status',
    operational: 'OPERATIONAL',
  },
  simulation: {
    title: 'ResQX Simulation',
    cityNetworkInitializing: 'City Network Initializing',
    scenarioSelection: 'Scenario Selection',
    startEmergency: 'Start Emergency',
    liveSimulation: 'LIVE SIMULATION',
    simulationPaused: 'SIMULATION PAUSED',
    runComplete: 'RUN COMPLETE',
    simulationSpeed: 'Simulation Speed',
  },
  controls: {
    start: 'START',
    pause: 'PAUSE',
    reset: 'RESET',
    play: 'PLAY',
  },
  emergency: {
    priorityAsset: 'Priority Asset',
    active: 'Active',
    eta: 'ETA',
    currentSpeed: 'Current Speed',
    distanceToTarget: 'Dist to Target',
    status: 'Status',
  },
  signals: {
    liveRouteSignals: 'Live Route Signals',
    online: 'ONLINE',
    priority: 'Priority',
    preparing: 'Preparing',
    normal: 'Normal',
    override: 'Override',
  },
  ai: {
    intelligence: 'ResQX Intelligence',
    confidence: 'CONF',
    executeOverride: 'Execute Override',
    dismiss: 'Dismiss',
  },
  timeline: {
    eventTimeline: 'Event Timeline',
  },
  traffic: {
    trafficConditions: 'Traffic Conditions',
    density: 'Density',
    congestion: 'Congestion',
    averageSpeed: 'Avg Speed',
  },
  scenarios: {
    highRiseFire: 'High-Rise Fire',
    floodResponse: 'Flood Response',
    custom: 'Custom...',
  },
};

// Telugu stub — ready for translation
const te: LocaleStrings = {
  ...en,
  nav: {
    simulation: 'సిమ్యులేషన్',
    emergencyQueue: 'ఎమర్జెన్సీ క్యూ',
    signals: 'సిగ్నల్స్',
    networkAnalytics: 'నెట్‌వర్క్ అనలిటిక్స్',
    settings: 'సెట్టింగ్స్',
  },
  header: {
    systemStatus: 'సిస్టమ్ స్టేటస్',
    operational: 'ఆపరేషనల్',
  },
};

// Hindi stub — ready for translation
const hi: LocaleStrings = {
  ...en,
  nav: {
    simulation: 'सिमुलेशन',
    emergencyQueue: 'आपातकालीन कतार',
    signals: 'सिग्नल',
    networkAnalytics: 'नेटवर्क एनालिटिक्स',
    settings: 'सेटिंग्स',
  },
  header: {
    systemStatus: 'सिस्टम स्थिति',
    operational: 'चालू',
  },
};

export const strings: Record<Locale, LocaleStrings> = { en, te, hi };
