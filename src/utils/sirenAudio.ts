/**
 * ResQX — Web Audio API Siren & Atmosphere Generator
 *
 * Provides self-contained, 100% reliable emergency siren and traffic ambience audio
 * using standard browser Web Audio API synthesis. No external audio files required.
 *
 * Audio Context activation MUST be called from a synchronous user interaction (button click).
 */

class SirenAudioEngine {
  private ctx: AudioContext | null = null;
  private primaryOsc: OscillatorNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private isMuted = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
  }

  /**
   * MUST be called synchronously inside user click event handlers (e.g. onClick).
   */
  public async handleUserGesture(): Promise<void> {
    this.initCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        console.log('[ResQX Audio] AudioContext resumed successfully on user gesture.');
      } catch (err) {
        console.warn('[ResQX Audio] AudioContext resume failed:', err);
      }
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.25, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.25, this.ctx.currentTime);
    }
  }

  public async startSiren() {
    if (this.isPlaying) return;
    await this.handleUserGesture();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Master Gain (Volume set to 0.25 for clear, comfortable listening)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.25, now);
      this.masterGain.connect(this.ctx.destination);

      // Low-pass Filter for realistic acoustic resonance
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);
      filter.connect(this.masterGain);

      // Main Siren Oscillator (Sawtooth wave for emergency horn)
      this.primaryOsc = this.ctx.createOscillator();
      this.primaryOsc.type = 'sawtooth';
      this.primaryOsc.frequency.setValueAtTime(750, now);

      // LFO for Wailing Dual-Tone Sweep (650Hz to 950Hz at 1.5Hz sweep rate)
      this.lfo = this.ctx.createOscillator();
      this.lfo.type = 'sine';
      this.lfo.frequency.setValueAtTime(1.5, now);

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(180, now);

      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.primaryOsc.frequency);

      this.primaryOsc.connect(filter);

      this.lfo.start(now);
      this.primaryOsc.start(now);
      this.isPlaying = true;
      console.log('[ResQX Audio] Siren started playing.');
    } catch (err) {
      console.warn('[ResQX Audio] Siren startup error:', err);
    }
  }

  public stopSiren() {
    if (!this.isPlaying) return;
    try {
      if (this.masterGain && this.ctx) {
        // Fade out smoothly over 0.1s to prevent clicks
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
      }
      setTimeout(() => {
        if (this.primaryOsc) {
          try { this.primaryOsc.stop(); } catch (e) {}
          this.primaryOsc.disconnect();
          this.primaryOsc = null;
        }
        if (this.lfo) {
          try { this.lfo.stop(); } catch (e) {}
          this.lfo.disconnect();
          this.lfo = null;
        }
        if (this.masterGain) {
          this.masterGain.disconnect();
          this.masterGain = null;
        }
        this.isPlaying = false;
        console.log('[ResQX Audio] Siren stopped cleanly.');
      }, 100);
    } catch (err) {
      this.isPlaying = false;
    }
  }
}

export const sirenAudio = new SirenAudioEngine();
