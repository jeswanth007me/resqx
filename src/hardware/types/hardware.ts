export type HardwareSignalState =
  | 'NORMAL'
  | 'PREPARING'
  | 'PRIORITY'
  | 'PASSING'
  | 'RESTORING';

export interface SignalHardwareCommand {
  signalId: string;
  state: HardwareSignalState;
  timestamp: number;
}

export interface SignalHardwareStatus {
  signalId: string;
  state: HardwareSignalState;
  connected: boolean;
  lastUpdated: number;
}

export interface SignalHardwareAdapter {
  sendCommand(command: SignalHardwareCommand): Promise<void>;

  getStatus(signalId: string): Promise<SignalHardwareStatus>;

  isConnected(): boolean;
}