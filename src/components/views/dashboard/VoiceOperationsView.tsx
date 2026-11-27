"use client";

import React from "react";
import { Bot, Cpu, Edit3, Mic, PhoneCall, Plus, Radio, RefreshCw, Shield, Sliders, Trash2, Volume2 } from "@/components/ui/FlatIcon";
import { EmployeeAvatar } from "@/components/chat-ui/EmployeeAvatar";

export interface VoiceOperationsViewProps {
  fetchData: (overrideTenant?: string) => Promise<void>;
  handleDeductCredits: (amount: number, reason: string) => Promise<void>;
  handleDeleteVoiceAgent: (configId: string, phone: string) => Promise<void>;
  handleOpenEditVoiceAgent: (cfg: any) => void;
  handleSyncVoiceBot: (configId: string) => Promise<void>;
  notify: (text: string, type?: "success" | "error" | "info") => void;
  selectedVoiceSession: any;
  setEditPermissionScopes: React.Dispatch<React.SetStateAction<string[]>>;
  setIsEditPermissionsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVoiceProvisionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedConfigForPermissions: React.Dispatch<any>;
  setSelectedVoiceSession: React.Dispatch<any>;
  setSimVoiceLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSimVoiceName: React.Dispatch<React.SetStateAction<string>>;
  setSimVoiceNumber: React.Dispatch<React.SetStateAction<string>>;
  setSimVoiceProvider: React.Dispatch<React.SetStateAction<"vapi" | "twilio" | "retell">>;
  setSimVoiceTier: React.Dispatch<React.SetStateAction<"standard" | "pro" | "enterprise">>;
  setSimVoiceVerification: React.Dispatch<React.SetStateAction<"anonymous" | "phone_match" | "otp_verified" | "authenticated">>;
  simVoiceLoading: boolean;
  simVoiceName: string;
  simVoiceNumber: string;
  simVoiceProvider: "vapi" | "twilio" | "retell";
  simVoiceTier: "standard" | "pro" | "enterprise";
  simVoiceVerification: "anonymous" | "phone_match" | "otp_verified" | "authenticated";
  voiceData: { phoneConfigs: any[]; sessions: any[]; };
  workforce: any[];
}

export function VoiceOperationsView({
  fetchData,
  handleDeductCredits,
  handleDeleteVoiceAgent,
  handleOpenEditVoiceAgent,
  handleSyncVoiceBot,
  notify,
  selectedVoiceSession,
  setEditPermissionScopes,
  setIsEditPermissionsModalOpen,
  setIsVoiceProvisionModalOpen,
  setSelectedConfigForPermissions,
  setSelectedVoiceSession,
  setSimVoiceLoading,
  setSimVoiceName,
  setSimVoiceNumber,
  setSimVoiceProvider,
  setSimVoiceTier,
  setSimVoiceVerification,
  simVoiceLoading,
  simVoiceName,
  simVoiceNumber,
  simVoiceProvider,
  simVoiceTier,
  simVoiceVerification,
  voiceData,
  workforce,
}: VoiceOperationsViewProps) {
  return (
<div className="space-y-6">
            {/* Top Overview & Provisioning Header */}
            <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                    <PhoneCall className="w-5 h-5" />
                  </span>
                  <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Voice Agents</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="pill ok text-xs font-mono shrink-0">
                  <Radio className="w-3.5 h-3.5" />
                  <span>{voiceData.phoneConfigs.length} Active Lines Provisioned</span>
                </span>

                <a
                  href="/api/voice/sophia/launch"
                  className="btn btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                  title="Launch Sophia Voice Telephony in Platform Studio"
                >
                  <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>Sophia Voice Launch</span>
                </a>

                <button
                  type="button"
                  onClick={() => setIsVoiceProvisionModalOpen(true)}
                  className="btn btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Provision New Voice Bot</span>
                </button>
              </div>
            </div>

            {/* Inbound Voice Numbers & Remote-to-Local Agent Matching Grid */}
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="w-4 h-4 text-[#2ED8B6] shrink-0" />
                  <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase truncate">
                    Telephony Fleet
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#6B7C8D] shrink-0">
                  HMAC Webhook Callback: /api/voice/webhook
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {voiceData.phoneConfigs.map((cfg: any) => {
                  const localEmp = workforce.find((w) => w.id === cfg.employeeId) || {
                    name: cfg.employeeName || cfg.agentName,
                    role: "Voice Lead",
                  };
                  return (
                    <div
                      key={cfg.id}
                      className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Header: Phone & Provider */}
                        <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--line)]">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-[#2ED8B6] tracking-wide">
                                {cfg.phoneNumber}
                              </span>
                              <span className="pill text-[9px] uppercase font-mono bg-[#18222E] border-[var(--line-2)] text-[#4D9FFF] shrink-0">
                                {cfg.provider.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5 truncate">
                              Line: {cfg.serviceMode || "customer"} • Last Call: {cfg.lastCallAt || "Active"}
                            </span>
                          </div>
                          <span className="pill ok text-[9px] font-mono uppercase shrink-0">
                            <i className="dot"></i>
                            {cfg.syncStatus === "synced" ? "SYNCED & MATCHED" : "PROVISIONED"}
                          </span>
                        </div>

                        {/* Remote to Local Agent Matching Box */}
                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-mono text-[#6B7C8D] uppercase font-bold">
                            <span>Local AI Employee:</span>
                            <span className="text-[#2ED8B6]">Remote Provider ID</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <EmployeeAvatar
                                src={localEmp.avatarUrl}
                                name={localEmp.name}
                                role={localEmp.role}
                                size={24}
                                className="w-6 h-6 rounded-lg object-cover border border-[#2ED8B6]/40 shrink-0"
                              />
                              <span className="font-bold text-[#EAF1F8] text-[11px] truncate">
                                {localEmp.name?.split("—")[0]?.trim() || "Sophia"}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-[#2ED8B6] bg-[#121A24] px-2 py-0.5 rounded border border-[var(--line)] truncate max-w-[120px] shrink-0" title={cfg.remoteAgentId}>
                              {cfg.remoteAgentId || `asst_${cfg.provider}_${cfg.id}`}
                            </span>
                          </div>
                        </div>

                        {/* System Prompt & First Message Greeting */}
                        <div className="space-y-1 text-xs">
                          {cfg.firstMessage && (
                            <div className="p-2 rounded-lg bg-[#0E1520] border border-[var(--line-2)] text-[11px] text-[#B4C2D0] italic">
                              &ldquo;{cfg.firstMessage}&rdquo;
                            </div>
                          )}
                          <p className="text-xs text-[#8E9AA8] leading-relaxed line-clamp-2">
                            {cfg.systemPrompt}
                          </p>
                        </div>

                        {/* Permission Scopes Badges */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                            <span className="uppercase font-bold text-[#EAF1F8] flex items-center gap-1">
                              <Shield className="w-3 h-3 text-[#2ED8B6]" />
                              <span>Granted Tool Permissions ({(cfg.permissionScopes || []).length}):</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 font-mono text-[9.5px]">
                            {(cfg.permissionScopes && cfg.permissionScopes.length > 0
                              ? cfg.permissionScopes
                              : ["support.problem.status", "support.ticket.lookup"]
                            ).map((scope: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line-2)] text-[#2ED8B6]"
                              >
                                {scope.replace("support.", "")}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Telephony Specs */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#6B7C8D] border-t border-[var(--line)]">
                          <span>
                            Voice Model: <strong className="text-[#EAF1F8]">{cfg.voiceId || "jennifer-neural-v2"}</strong>
                          </span>
                          <span>
                            Auth Gate: <strong className="text-[#2ED8B6] uppercase">{cfg.minVerificationLevel}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditVoiceAgent(cfg)}
                          className="btn btn-secondary py-1.5 px-2.5 text-xs font-mono flex items-center gap-1 cursor-pointer text-[#EAF1F8] hover:text-[#2ED8B6]"
                          title="Edit Voice Agent Configuration"
                        >
                          <Edit3 className="w-3 h-3 text-[#2ED8B6]" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSyncVoiceBot(cfg.id)}
                          className="btn btn-secondary py-1.5 px-2 text-xs font-mono flex items-center gap-1 cursor-pointer text-[#B4C2D0] hover:text-[#2ED8B6]"
                          title="Re-synchronize remote provider assistant with local AI employee"
                        >
                          <RefreshCw className="w-3 h-3 text-[#2ED8B6]" />
                          <span>Re-Sync</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConfigForPermissions(cfg);
                            setEditPermissionScopes(cfg.permissionScopes || [
                              "support.problem.status",
                              "support.ticket.lookup",
                              "support.ticket.create",
                              "knowledge.rag.search",
                            ]);
                            setIsEditPermissionsModalOpen(true);
                          }}
                          className="btn btn-secondary py-1.5 px-2 text-xs font-mono flex items-center gap-1 cursor-pointer"
                          title="Edit granted capability scopes"
                        >
                          <Sliders className="w-3 h-3 text-[#4D9FFF]" />
                          <span>Scopes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSimVoiceNumber(cfg.phoneNumber);
                            setSimVoiceProvider(cfg.provider);
                            setSimVoiceVerification(cfg.minVerificationLevel || "phone_match");
                            const simElement = document.getElementById("voice-call-simulator");
                            if (simElement) simElement.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="btn btn-primary py-1.5 px-2.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Test simulate call with this bot"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Test</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteVoiceAgent(cfg.id, cfg.phoneNumber)}
                          className="p-1.5 rounded-lg bg-[#18222E] hover:bg-[#E5484D]/20 text-[#6B7C8D] hover:text-[#E5484D] border border-[var(--line-2)] hover:border-[#E5484D]/40 transition-colors cursor-pointer"
                          title="Delete & un-provision voice agent"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulator & Live Session Inspector */}
            <div id="voice-call-simulator" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Voice Call Simulator */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[var(--line)]">
                  <Mic className="w-4 h-4 text-[#2ED8B6]" />
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Simulate Call</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#6B7C8D] block mb-1">Caller Phone Number</label>
                    <input
                      type="text"
                      value={simVoiceNumber}
                      onChange={(e) => setSimVoiceNumber(e.target.value)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[#6B7C8D] block mb-1">Caller Name</label>
                    <input
                      type="text"
                      value={simVoiceName}
                      onChange={(e) => setSimVoiceName(e.target.value)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-1.5 rounded-lg border border-[var(--line-2)] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[#6B7C8D] block mb-1">Voice Provider</label>
                      <select
                        value={simVoiceProvider}
                        onChange={(e) => setSimVoiceProvider(e.target.value as any)}
                        className="w-full bg-[#18222E] text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none cursor-pointer"
                      >
                        <option value="vapi">Vapi.ai</option>
                        <option value="twilio">Twilio Voice</option>
                        <option value="retell">Retell AI</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[#6B7C8D] block mb-1">Customer Tier</label>
                      <select
                        value={simVoiceTier}
                        onChange={(e) => setSimVoiceTier(e.target.value as any)}
                        className="w-full bg-[#18222E] text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none cursor-pointer"
                      >
                        <option value="enterprise">Enterprise</option>
                        <option value="pro">Pro</option>
                        <option value="standard">Standard</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[#6B7C8D] block mb-1">Identity Verification Level</label>
                    <select
                      value={simVoiceVerification}
                      onChange={(e) => setSimVoiceVerification(e.target.value as any)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="authenticated">Authenticated (Full Tool Access)</option>
                      <option value="otp_verified">OTP Verified (Account Actions)</option>
                      <option value="phone_match">Phone Match (Ticket Lookup)</option>
                      <option value="anonymous">Anonymous (Public Status Only)</option>
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        setSimVoiceLoading(true);
                        const res = await fetch("/api/voice/session", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            provider: simVoiceProvider,
                            callerNumber: simVoiceNumber,
                            callerName: simVoiceName,
                            customerTier: simVoiceTier,
                            verificationLevel: simVoiceVerification,
                          }),
                        }).then((r) => r.json());

                        if (res.success) {
                          handleDeductCredits(25, "Inbound Voice Call Simulation & Audio Transcription");
                          notify(res.message, "success");
                          setSelectedVoiceSession(res.data.session);
                          fetchData();
                        } else {
                          notify(res.error || "Simulation failed", "error");
                        }
                      } catch (err) {
                        notify("Network error simulating voice session", "error");
                      } finally {
                        setSimVoiceLoading(false);
                      }
                    }}
                    disabled={simVoiceLoading}
                    className="btn btn-primary w-full py-2 text-xs font-semibold cursor-pointer mt-2"
                  >
                    <PhoneCall className={`w-3.5 h-3.5 ${simVoiceLoading ? "animate-spin" : ""}`} />
                    <span>{simVoiceLoading ? "Initiating Call..." : "Simulate Inbound Voice Call"}</span>
                  </button>
                </div>
              </div>

              {/* Live Audio Transcript & Tool Invocation Stream */}
              <div className="lg:col-span-2 card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Volume2 className="w-4 h-4 text-[#2ED8B6] shrink-0" />
                    <h3 className="text-sm font-bold text-[#EAF1F8] truncate">
                      {selectedVoiceSession ? `Session: ${selectedVoiceSession.id}` : "Select Voice Call"}
                    </h3>
                  </div>
                  {selectedVoiceSession && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="pill ok shrink-0">
                        <i className="dot"></i>
                        {selectedVoiceSession.verificationLevel}
                      </span>
                      <span
                        className={`pill shrink-0 ${
                          selectedVoiceSession.sentiment === "frustrated"
                            ? "err"
                            : "ok"
                        }`}
                      >
                        <i className="dot"></i>
                        {selectedVoiceSession.sentiment}
                      </span>
                    </div>
                  )}
                </div>

                {selectedVoiceSession ? (
                  <div className="space-y-4">
                    {/* Transcript turns */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                      {selectedVoiceSession.transcript?.map((turn: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-xs leading-relaxed ${
                            turn.role === "assistant"
                              ? "bg-[#18222E] border border-[var(--line)] text-[#EAF1F8]"
                              : turn.role === "user"
                              ? "bg-[#121A24] border border-[var(--line-2)] text-[#B4C2D0]"
                              : "bg-[#2ED8B6]/5 border border-[#2ED8B6]/20 font-mono text-[#2ED8B6]"
                          }`}
                        >
                          <div className="flex justify-between text-[10px] text-[#6B7C8D] mb-1">
                            <span className="uppercase font-bold tracking-wider font-mono">{turn.role}</span>
                            <span className="font-mono">{turn.timestamp}</span>
                          </div>
                          <p>{turn.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Invoked Voice Tools */}
                    {selectedVoiceSession.toolsInvoked && selectedVoiceSession.toolsInvoked.length > 0 && (
                      <div className="pt-3 border-t border-[var(--line)] space-y-2">
                        <span className="text-xs font-semibold text-[#EAF1F8] block">Invoked Voice Capabilities</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedVoiceSession.toolsInvoked.map((t: any, idx: number) => (
                            <div key={idx} className="bg-[#18222E] p-3 rounded-lg border border-[var(--line)] font-mono text-[11px]">
                              <div className="flex justify-between text-[#2ED8B6] font-bold">
                                <span>{t.tool}</span>
                                <span className="text-[#4CC38A]">{t.latencyMs}ms</span>
                              </div>
                              <div className="text-[#6B7C8D] mt-1 truncate">
                                Output: {JSON.stringify(t.output)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#6B7C8D] text-xs">
                    No active voice session selected. Choose a call from the history or simulate a new inbound call.
                  </div>
                )}
              </div>
            </div>

            {/* Voice Sessions History Table */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#EAF1F8]">Voice Sessions</h3>
              <div className="overflow-x-auto">
                <table className="gv8-table">
                  <thead>
                    <tr>
                      <th>Session ID / Caller</th>
                      <th>Provider</th>
                      <th>Verification Tier</th>
                      <th>Duration</th>
                      <th>Sentiment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voiceData.sessions.map((sess: any) => (
                      <tr key={sess.id}>
                        <td>
                          <div className="font-medium text-[#EAF1F8]">{sess.callerName || sess.callerNumber}</div>
                          <div className="font-mono text-[11px] text-[#6B7C8D]">{sess.callerNumber}</div>
                        </td>
                        <td>
                          <span className="pill">
                            {sess.provider}
                          </span>
                        </td>
                        <td>
                          <span className="pill ok">
                            <i className="dot"></i>
                            {sess.verificationLevel}
                          </span>
                        </td>
                        <td className="font-mono text-[#B4C2D0]">
                          {sess.durationSeconds ? `${sess.durationSeconds}s` : "Active"}
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              sess.sentiment === "frustrated"
                                ? "err"
                                : "ok"
                            }`}
                          >
                            <i className="dot"></i>
                            {sess.sentiment}
                          </span>
                        </td>
                        <td>
                          <span className="pill ok">
                            <i className="dot"></i>
                            {sess.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedVoiceSession(sess)}
                            className="btn btn-secondary text-xs"
                          >
                            Inspect Audio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
  );
}
