"use client";

import React from "react";
import { Lock, X, Zap } from "@/components/ui/FlatIcon";

export interface ForgeGwModalProps {
  byomApiKey: string;
  byomModel: string;
  forgeGwCredits: number;
  handleAddCredits: (amount: number, packTitle: string, price: number) => Promise<void>;
  modelProvider: "forgegw" | "byom";
  notify: (text: string, type?: "success" | "error" | "info") => void;
  setByomApiKey: React.Dispatch<React.SetStateAction<string>>;
  setByomModel: React.Dispatch<React.SetStateAction<string>>;
  setIsForgeGwModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setModelProvider: React.Dispatch<React.SetStateAction<"forgegw" | "byom">>;
}

export function ForgeGwModal({
  byomApiKey,
  byomModel,
  forgeGwCredits,
  handleAddCredits,
  modelProvider,
  notify,
  setByomApiKey,
  setByomModel,
  setIsForgeGwModalOpen,
  setModelProvider,
}: ForgeGwModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8] font-sans">Model Governance</h3>
                  <p className="text-[10px] text-[#6B7C8D]">Pooled action credits and private keys</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgeGwModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#141C26] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Selection Tabs */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[#B4C2D0] block">LLM Routing &amp; Compute Mode:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setModelProvider("forgegw")}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    modelProvider === "forgegw"
                      ? "bg-[#162724] border-[#2ED8B6] text-[#EAF1F8]"
                      : "bg-[#141C26] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-xs text-[#2ED8B6]">
                    <Zap className="w-3.5 h-3.5" />
                    <span>ForgeGW Managed</span>
                  </div>
                  <p className="text-[10px] text-[#6B7C8D] mt-1">
                    Pooled credits ($0.003/action). Zero API keys required.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setModelProvider("byom")}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    modelProvider === "byom"
                      ? "bg-[#162724] border-[#2ED8B6] text-[#EAF1F8]"
                      : "bg-[#141C26] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-xs text-[#4D9FFF]">
                    <Lock className="w-3.5 h-3.5" />
                    <span>BYOM (Bring Your Own Key)</span>
                  </div>
                  <p className="text-[10px] text-[#6B7C8D] mt-1">
                    Direct OpenAI / Anthropic key at zero platform margin.
                  </p>
                </button>
              </div>
            </div>

            {modelProvider === "forgegw" ? (
              <div className="p-4 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div>
                    <span className="text-xs text-[#8E9AA8] block">Current Credit Balance</span>
                    <span className="text-lg font-bold text-[#2ED8B6] font-mono">{forgeGwCredits.toLocaleString()} Credits</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#6B7C8D] block uppercase">Account Pool Status</span>
                    <span className="pill ok text-[10px] font-mono font-bold">Account-Linked (Spendable)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-[#B4C2D0] font-bold block uppercase tracking-wider">
                    Standalone &amp; Vertical Credit Top-Ups
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        credits: 5000,
                        price: 30,
                        title: "5,000 Credits",
                        desc: "5,000 credits. Top-up for finishing work when your monthly allowance runs out.",
                      },
                      {
                        credits: 15000,
                        price: 75,
                        title: "15,000 Credits",
                        desc: "15,000 credits. Top-up for a burst of builds mid-cycle.",
                      },
                      {
                        credits: 30000,
                        price: 130,
                        title: "30,000 Credits",
                        desc: "30,000 credits. Larger top-up for sustained work between billing periods. A subscription costs less per credit at this volume.",
                      },
                      {
                        credits: 100000,
                        price: 375,
                        title: "100,000 Credits",
                        desc: "100,000 credits. Bulk top-up. For ongoing volume at this level a subscription gives more credits for less.",
                      },
                    ].map((pack) => (
                      <div
                        key={pack.credits}
                        className="p-3 rounded-xl bg-[#0E1520] border border-[var(--line)] hover:border-[#2ED8B6]/50 transition-all flex flex-col justify-between space-y-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#EAF1F8]">{pack.title}</span>
                            <span className="text-sm font-extrabold text-[#2ED8B6] font-mono">${pack.price}</span>
                          </div>
                          <p className="text-[10px] text-[#8E9AA8] leading-snug">{pack.desc}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddCredits(pack.credits, pack.title, pack.price)}
                          className="btn btn-primary w-full py-1.5 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                        >
                          <Zap className="w-3 h-3" />
                          <span>CHECKOUT (${pack.price})</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[#6B7C8D]">
                  <span>Instant multi-service provisioning across OrderV8, WorkerV8 &amp; SupportV8</span>
                  <span>Billed via Stripe</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-2xl bg-[#141C26] border border-[var(--line)]">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#B4C2D0] block">Private OpenAI API Key</label>
                  <input
                    type="password"
                    value={byomApiKey}
                    onChange={(e) => setByomApiKey(e.target.value)}
                    placeholder="sk-proj-••••••••••••••••••••••••"
                    className="w-full bg-[#0E1520] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#B4C2D0] block">Primary Completion Model</label>
                  <select
                    value={byomModel}
                    onChange={(e) => setByomModel(e.target.value)}
                    className="w-full bg-[#0E1520] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  >
                    <option value="gpt-4o">OpenAI GPT-4o (Production Grounding)</option>
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o-mini (Cost Optimized)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsForgeGwModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsForgeGwModalOpen(false);
                  notify(`Saved AI Model Governance settings (${modelProvider.toUpperCase()})`, "success");
                }}
                className="btn btn-primary text-xs font-bold"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
  );
}
