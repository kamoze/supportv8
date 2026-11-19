"use client";

import React from "react";
import { CheckCircle2, Send, X } from "@/components/ui/FlatIcon";
import type { Problem } from "@/lib/types";

export interface BroadcastModalProps {
  broadcastDraft: any;
  broadcastProblem: Problem;
  broadcastSuccessMsg: string | null;
  handleSendBroadcast: () => Promise<void>;
  setBroadcastDraft: React.Dispatch<any>;
  setIsBroadcastModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function BroadcastModal({
  broadcastDraft,
  broadcastProblem,
  broadcastSuccessMsg,
  handleSendBroadcast,
  setBroadcastDraft,
  setIsBroadcastModalOpen,
}: BroadcastModalProps) {
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl card shadow-2xl p-5 space-y-4 border-[var(--line)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-base font-bold text-[#EAF1F8]">Incident Notice</h3>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(false)} className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#18222E] border border-[var(--line)] text-[#EAF1F8] font-mono">
                Target Audience: {broadcastProblem.affectedCustomerCount} affected customers ({broadcastProblem.affectedEnterpriseCount} Enterprise)
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Subject</label>
                <input
                  type="text"
                  value={broadcastDraft.subject}
                  onChange={(e) => setBroadcastDraft({ ...broadcastDraft, subject: e.target.value })}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Notice Body</label>
                <textarea
                  value={broadcastDraft.body}
                  onChange={(e) => setBroadcastDraft({ ...broadcastDraft, body: e.target.value })}
                  rows={4}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-lg border border-[var(--line-2)] font-mono text-xs leading-relaxed focus:outline-none"
                />
              </div>

              {broadcastSuccessMsg && (
                <div className="p-3 rounded-lg bg-[#4CC38A]/10 border border-[#4CC38A]/30 text-[#4CC38A] text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#4CC38A]" />
                  <span>{broadcastSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendBroadcast}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Proactive Broadcast</span>
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
