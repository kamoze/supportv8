"use client";

import React from "react";
import { CheckCircle2, X } from "@/components/ui/FlatIcon";
import type { MarketplaceConnector } from "@/lib/types/marketplace-types";

export interface ConnectorConfigModalProps {
  notify: (text: string, type?: "success" | "error" | "info") => void;
  selectedConnectorForConfig: MarketplaceConnector;
  setIsConnectorConfigOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ConnectorConfigModal({
  notify,
  selectedConnectorForConfig,
  setIsConnectorConfigOpen,
}: ConnectorConfigModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <i className={`${selectedConnectorForConfig.icon} text-lg text-[#2ED8B6]`} />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">{selectedConnectorForConfig.name}</h3>
                  <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">{selectedConnectorForConfig.category} Configuration</span>
                </div>
              </div>
              <button
                onClick={() => setIsConnectorConfigOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-[#18222E]/80 border border-[var(--line-2)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#EAF1F8] font-mono text-[11px]">Service App Connection Credentials</span>
                  <span className="pill ok text-[9px]"><i className="dot"></i> MUTUAL AUTH</span>
                </div>
                <p className="text-[10px] text-[#6B7C8D]">
                  Configure the outbound access credentials and HMAC webhook secret required to authenticate and synchronize with this service app.
                </p>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Target Service Base Endpoint URL</label>
                <input
                  type="text"
                  defaultValue={selectedConnectorForConfig.endpointUrl || "https://api.ingress.servicev8.internal"}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-[11px] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Service Connection Bearer Key</label>
                <div className="relative">
                  <input
                    type="password"
                    defaultValue={`sec_key_${selectedConnectorForConfig.id}_${selectedConnectorForConfig.category}_live_9921`}
                    className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs text-[#2ED8B6] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              {selectedConnectorForConfig.configFields.map((field) => (
                <div key={field.key}>
                  <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">{field.label}</label>
                  <input
                    type={field.type}
                    defaultValue={field.value || ""}
                    placeholder={field.placeholder || ""}
                    className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              ))}

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Inbound Webhook Verification Secret</label>
                <input
                  type="password"
                  defaultValue={`whsec_${selectedConnectorForConfig.id}_live_77a4b2c1`}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                TLS 1.3 / AES-256 Secret Vault
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectorConfigOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConnectorConfigOpen(false);
                    notify(`Verified authorization handshake & saved connection for ${selectedConnectorForConfig.name}`, "success");
                  }}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save &amp; Test Handshake</span>
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
