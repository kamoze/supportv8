"use client";

import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Bell, Check, ChevronDown, Sparkles } from "@/components/ui/FlatIcon";
import { soundAlertService, type SoundAlertConfig } from "@/lib/services/sound-alert-service";

interface SoundAlertToggleProps {
  className?: string;
  showDropdown?: boolean;
}

export function SoundAlertToggle({ className = "", showDropdown = true }: SoundAlertToggleProps) {
  const [config, setConfig] = useState<SoundAlertConfig>(() => soundAlertService.getConfig());
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to soundAlertService changes
    const unsubscribe = soundAlertService.subscribe((newConfig) => {
      setConfig(newConfig);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggleMaster = () => {
    const nextState = soundAlertService.toggleMaster();
    if (nextState) {
      void soundAlertService.playTestChatAlert();
    }
  };

  const handleToggleTickets = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundAlertService.updateConfig({ ticketAlerts: !config.ticketAlerts });
  };

  const handleToggleChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundAlertService.updateConfig({ chatAlerts: !config.chatAlerts });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    soundAlertService.updateConfig({ volume: val });
  };

  const label = config.enabled
    ? `Sound alerts active (${Math.round(config.volume * 100)}% vol) — Click to mute`
    : "Sound alerts muted — Click to enable";

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        className={`family-icon-button relative group transition-colors ${
          config.enabled ? "text-[#2ED8B6]" : "text-[#6B7C8D]"
        } ${className}`.trim()}
        title={label}
        aria-label={label}
        aria-pressed={config.enabled}
        onClick={handleToggleMaster}
        onContextMenu={(e) => {
          if (showDropdown) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {config.enabled ? (
          <Volume2 size={18} className="transition-transform group-hover:scale-110" />
        ) : (
          <VolumeX size={18} className="transition-transform group-hover:scale-110 text-[#6B7C8D]" />
        )}
        {config.enabled && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#2ED8B6] shadow-[0_0_6px_#2ED8B6]"></span>
        )}
      </button>

      {/* Mini quick-menu toggle caret */}
      {showDropdown && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="p-1 -ml-1 text-[#6B7C8D] hover:text-[#EAF1F8] transition-colors rounded hover:bg-[#18222E] cursor-pointer"
          title="Configure sound alert settings"
          aria-label="Sound alert preferences"
          aria-expanded={isOpen}
        >
          <ChevronDown size={10} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Quick Settings Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 card p-3.5 bg-[#0C121A] border border-[var(--line)] shadow-2xl rounded-2xl z-50 text-xs space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span className="font-bold text-[#EAF1F8] text-[11px] font-mono uppercase tracking-wider">
                Sound Alert Controls
              </span>
            </div>
            <span
              className={`pill text-[9px] py-0 px-1.5 font-mono ${
                config.enabled ? "ok text-[#2ED8B6] border-[#2ED8B6]/40" : "text-[#6B7C8D]"
              }`}
            >
              {config.enabled ? "ACTIVE" : "MUTED"}
            </span>
          </div>

          {/* Master Enable / Disable */}
          <div className="flex items-center justify-between py-1">
            <span className="text-[#EAF1F8] font-semibold text-[11px]">Master Sound Alerts</span>
            <button
              type="button"
              onClick={handleToggleMaster}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                config.enabled ? "bg-[#2ED8B6]" : "bg-[#18222E] border border-[var(--line)]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  config.enabled ? "translate-x-4 shadow" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Per-event Toggles */}
          <div className="space-y-2 pt-1 border-t border-[var(--line-2)] text-[11px]">
            {/* Incoming Tickets */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#B4C2D0]">Incoming Tickets</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void soundAlertService.playTestTicketAlert()}
                  className="px-1.5 py-0.5 rounded bg-[#18222E] text-[10px] text-[#6B7C8D] hover:text-[#2ED8B6] border border-[var(--line)] cursor-pointer"
                  title="Audition ticket chime"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={handleToggleTickets}
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    config.ticketAlerts ? "bg-[#2ED8B6]" : "bg-[#18222E] border border-[var(--line)]"
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      config.ticketAlerts ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Incoming Chat */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#B4C2D0]">Incoming Chat</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void soundAlertService.playTestChatAlert()}
                  className="px-1.5 py-0.5 rounded bg-[#18222E] text-[10px] text-[#6B7C8D] hover:text-[#2ED8B6] border border-[var(--line)] cursor-pointer"
                  title="Audition chat chime"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={handleToggleChat}
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    config.chatAlerts ? "bg-[#2ED8B6]" : "bg-[#18222E] border border-[var(--line)]"
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      config.chatAlerts ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Volume Slider */}
          <div className="pt-2 border-t border-[var(--line-2)] space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
              <span>VOLUME</span>
              <span className="text-[#EAF1F8]">{Math.round(config.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.volume}
              onChange={handleVolumeChange}
              className="w-full accent-[#2ED8B6] cursor-pointer h-1.5 bg-[#18222E] rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
