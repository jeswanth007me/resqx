import type {
  SignalHardwareAdapter,
  SignalHardwareCommand,
  SignalHardwareStatus,
} from '../types/hardware';

export class MockSignalHardwareAdapter implements SignalHardwareAdapter {
  private readonly signals = new Map<string, SignalHardwareStatus>();

  sendCommand(command: SignalHardwareCommand): Promise<void> {
    this.signals.set(command.signalId, {
      signalId: command.signalId,
      state: command.state,
      connected: true,
      lastUpdated: command.timestamp,
    });

    return Promise.resolve();
  }

  getStatus(signalId: string): Promise<SignalHardwareStatus> {
    const existing = this.signals.get(signalId);

    if (existing) {
      return Promise.resolve(existing);
    }

    const status: SignalHardwareStatus = {
      signalId,
      state: 'NORMAL',
      connected: true,
      lastUpdated: Date.now(),
    };

    this.signals.set(signalId, status);

    return Promise.resolve(status);
  }

  isConnected(): boolean {
    return true;
  }
}