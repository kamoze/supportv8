/**
 * SupportV8 Sound Alert Service
 * 
 * Provides synthesized Web Audio alerts for:
 * 1. Incoming support tickets (two-tone executive chime)
 * 2. Incoming chat messages (friendly messaging double-bubble pop)
 * 
 * Includes persistent configuration (localStorage), master mute toggle,
 * per-event toggles, volume scaling, and reactive subscriptions.
 */

export interface SoundAlertConfig {
  enabled: boolean;
  ticketAlerts: boolean;
  chatAlerts: boolean;
  volume: number; // 0.0 to 1.0
}

const DEFAULT_CONFIG: SoundAlertConfig = {
  enabled: true,
  ticketAlerts: true,
  chatAlerts: true,
  volume: 0.7,
};

const STORAGE_KEY = "supportv8:sound_alerts:config:v1";

type ConfigListener = (config: SoundAlertConfig) => void;

class SoundAlertServiceImpl {
  private config: SoundAlertConfig = { ...DEFAULT_CONFIG };
  private listeners = new Set<ConfigListener>();
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;

  constructor() {
    this.loadConfig();
    this.initUnlockListeners();
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = {
          enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_CONFIG.enabled,
          ticketAlerts: typeof parsed.ticketAlerts === "boolean" ? parsed.ticketAlerts : DEFAULT_CONFIG.ticketAlerts,
          chatAlerts: typeof parsed.chatAlerts === "boolean" ? parsed.chatAlerts : DEFAULT_CONFIG.chatAlerts,
          volume: typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1 ? parsed.volume : DEFAULT_CONFIG.volume,
        };
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  /**
   * Listen for user interaction to unlock AudioContext as required by browser autoplay policy
   */
  private initUnlockListeners(): void {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.ensureAudioContext()
        .then((ctx) => {
          if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
          this.isUnlocked = true;
        })
        .catch(() => {});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
  }

  /**
   * Get or create AudioContext instance
   */
  private async ensureAudioContext(): Promise<AudioContext | null> {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.audioCtx = new AudioCtxClass();
        } catch {
          return null;
        }
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch {
        // May remain suspended until user interaction
      }
    }

    return this.audioCtx;
  }

  /**
   * Get current configuration
   */
  public getConfig(): SoundAlertConfig {
    return { ...this.config };
  }

  /**
   * Update configuration and notify subscribers
   */
  public updateConfig(patch: Partial<SoundAlertConfig>): SoundAlertConfig {
    this.config = {
      ...this.config,
      ...patch,
      volume: typeof patch.volume === "number" ? Math.max(0, Math.min(1, patch.volume)) : this.config.volume,
    };
    this.saveConfig();
    this.notifyListeners();
    return this.getConfig();
  }

  /**
   * Toggle master sound enabled/disabled
   */
  public toggleMaster(): boolean {
    const nextState = !this.config.enabled;
    this.updateConfig({ enabled: nextState });
    return nextState;
  }

  /**
   * Subscribe to configuration changes
   */
  public subscribe(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const current = this.getConfig();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch {
        // Prevent listener failures from cascading
      }
    }
  }

  /**
   * Synthesize a multi-frequency melodic chime using Web Audio API
   */
  private async playToneSequence(
    tones: Array<{ freq: number; duration: number; delay: number; type?: OscillatorType; gain?: number }>,
    force = false
  ): Promise<boolean> {
    if (!force && !this.config.enabled) return false;
    const ctx = await this.ensureAudioContext();
    if (!ctx) return false;

    try {
      const now = ctx.currentTime;
      const masterVolume = Math.max(0, Math.min(1, this.config.volume));

      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = tone.type || "sine";
        osc.frequency.setValueAtTime(tone.freq, now + tone.delay);

        const toneGain = (tone.gain ?? 0.3) * masterVolume;
        gainNode.gain.setValueAtTime(0.0001, now + tone.delay);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, toneGain), now + tone.delay + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + tone.delay + tone.duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + tone.delay);
        osc.stop(now + tone.delay + tone.duration);
      }
      return true;
    } catch (err) {
      console.warn("[SoundAlertService] Failed to play tone sequence:", err);
      return false;
    }
  }

  /**
   * Play ticket alert sound (Crisp 2-tone melodic chime: D5 -> A5)
   */
  public async playTicketAlert(force = false): Promise<boolean> {
    if (!force && (!this.config.enabled || !this.config.ticketAlerts)) return false;

    // Elegant, bright executive chime (587 Hz -> 880 Hz)
    return this.playToneSequence([
      { freq: 587.33, duration: 0.16, delay: 0.0, type: "sine", gain: 0.35 },
      { freq: 880.0, duration: 0.28, delay: 0.12, type: "sine", gain: 0.4 },
      // Subtle warm overtone for richness
      { freq: 1174.66, duration: 0.22, delay: 0.12, type: "triangle", gain: 0.12 },
    ], force);
  }

  /**
   * Play chat alert sound (Friendly double-pop messaging tone)
   */
  public async playChatAlert(force = false): Promise<boolean> {
    if (!force && (!this.config.enabled || !this.config.chatAlerts)) return false;

    // Friendly, modern messaging pop (660 Hz -> 990 Hz rapid blip)
    return this.playToneSequence([
      { freq: 659.25, duration: 0.08, delay: 0.0, type: "sine", gain: 0.25 },
      { freq: 987.77, duration: 0.14, delay: 0.07, type: "sine", gain: 0.3 },
    ], force);
  }

  /**
   * Audition ticket chime in settings / UI (plays even if muted)
   */
  public async playTestTicketAlert(): Promise<boolean> {
    return this.playTicketAlert(true);
  }

  /**
   * Audition chat chime in settings / UI (plays even if muted)
   */
  public async playTestChatAlert(): Promise<boolean> {
    return this.playChatAlert(true);
  }
}

export const soundAlertService = new SoundAlertServiceImpl();
