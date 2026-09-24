// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { soundAlertService, type SoundAlertConfig } from "@/lib/services/sound-alert-service";

describe("SoundAlertService", () => {
  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
    removeItem: (key: string) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
  };

  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage);
    storageMap.clear();
    soundAlertService.updateConfig({
      enabled: true,
      ticketAlerts: true,
      chatAlerts: true,
      volume: 0.7,
    });
  });

  afterEach(() => {
    storageMap.clear();
    vi.restoreAllMocks();
  });

  it("initializes with default configuration", () => {
    const config = soundAlertService.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.ticketAlerts).toBe(true);
    expect(config.chatAlerts).toBe(true);
    expect(config.volume).toBe(0.7);
  });

  it("updates configuration and persists to localStorage", () => {
    const updated = soundAlertService.updateConfig({
      enabled: false,
      volume: 0.4,
    });

    expect(updated.enabled).toBe(false);
    expect(updated.volume).toBe(0.4);

    const stored = JSON.parse(localStorage.getItem("supportv8:sound_alerts:config:v1") || "{}");
    expect(stored.enabled).toBe(false);
    expect(stored.volume).toBe(0.4);
  });

  it("clamps volume between 0.0 and 1.0", () => {
    soundAlertService.updateConfig({ volume: 1.5 });
    expect(soundAlertService.getConfig().volume).toBe(1.0);

    soundAlertService.updateConfig({ volume: -0.2 });
    expect(soundAlertService.getConfig().volume).toBe(0.0);
  });

  it("toggles master sound state", () => {
    expect(soundAlertService.getConfig().enabled).toBe(true);
    const toggled = soundAlertService.toggleMaster();
    expect(toggled).toBe(false);
    expect(soundAlertService.getConfig().enabled).toBe(false);

    const toggledAgain = soundAlertService.toggleMaster();
    expect(toggledAgain).toBe(true);
    expect(soundAlertService.getConfig().enabled).toBe(true);
  });

  it("notifies subscribers when configuration changes", () => {
    const listener = vi.fn();
    const unsubscribe = soundAlertService.subscribe(listener);

    soundAlertService.updateConfig({ chatAlerts: false });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        chatAlerts: false,
      })
    );

    unsubscribe();
    soundAlertService.updateConfig({ ticketAlerts: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not play alert when master enabled is false", async () => {
    soundAlertService.updateConfig({ enabled: false });
    const played = await soundAlertService.playTicketAlert();
    expect(played).toBe(false);

    const chatPlayed = await soundAlertService.playChatAlert();
    expect(chatPlayed).toBe(false);
  });

  it("does not play ticket alert when ticketAlerts is false", async () => {
    soundAlertService.updateConfig({ enabled: true, ticketAlerts: false });
    const played = await soundAlertService.playTicketAlert();
    expect(played).toBe(false);
  });

  it("does not play chat alert when chatAlerts is false", async () => {
    soundAlertService.updateConfig({ enabled: true, chatAlerts: false });
    const played = await soundAlertService.playChatAlert();
    expect(played).toBe(false);
  });

  it("synthesizes audio when AudioContext is available", async () => {
    // Mock Web Audio API
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockContext = {
      currentTime: 100,
      state: "running",
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    window.AudioContext = vi.fn().mockImplementation(() => mockContext) as any;

    soundAlertService.updateConfig({ enabled: true, ticketAlerts: true });
    const played = await soundAlertService.playTicketAlert();

    expect(played).toBe(true);
    expect(mockContext.createOscillator).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
  });
});
