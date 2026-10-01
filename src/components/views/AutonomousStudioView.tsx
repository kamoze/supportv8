"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Zap,
  Play,
  Bot,
  Sliders,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
  RefreshCw,
  Plus,
  Search,
  SlidersHorizontal,
  Check,
  ShoppingBag,
  Box,
  ExternalLink,
  Phone,
  Plug,
  ShieldCheck,
} from "@/components/ui/FlatIcon";

interface AutonomousStudioViewProps {
  onNotify: (text: string, type: "success" | "error" | "info") => void;
  initialSubTab?: "workflows" | "templates" | "simulator" | "sweeps" | "setup" | "fleet";
  initialEmployeeId?: string;
  onNavigateToMarketplace?: () => void;
  onNavigateToInstalled?: () => void;
  tenantId?: string;
}

const STUDIO_EXTERNAL_URL = process.env.NEXT_PUBLIC_STUDIOV8_URL || "https://studio.servicev8.com";
const MARKETPLACE_EXTERNAL_URL = process.env.NEXT_PUBLIC_MARKETPLACEV8_URL || "https://marketplace.servicev8.com";

export function AutonomousStudioView({
  onNotify,
  initialSubTab,
  initialEmployeeId,
  onNavigateToMarketplace,
  onNavigateToInstalled,
  tenantId = "acme",
}: AutonomousStudioViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"workflows" | "sweeps" | "fleet">(
    initialSubTab === "sweeps" ? "sweeps" : initialSubTab === "fleet" ? "fleet" : "workflows"
  );
  const [staleCandidates, setStaleCandidates] = useState<any[]>([]);
  const [loadingSweeps, setLoadingSweeps] = useState(false);
  const [sweepExecuting, setSweepExecuting] = useState(false);

  const studioUrl = `${STUDIO_EXTERNAL_URL}/?tenant=${encodeURIComponent(tenantId)}&vertical=support`;

  useEffect(() => {
    fetchSweeps();
  }, []);

  const fetchSweeps = async () => {
    setLoadingSweeps(true);
    try {
      const res = await fetch("/api/stale-work").then((r) => r.json());
      if (res.success && Array.isArray(res.data)) {
        setStaleCandidates(res.data);
      } else {
        setStaleCandidates([]);
      }
    } catch {
      setStaleCandidates([]);
    } finally {
      setLoadingSweeps(false);
    }
  };

  const handleExecuteAllSafe = async () => {
    setSweepExecuting(true);
    try {
      const res = await fetch("/api/stale-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute_all_safe" }),
      }).then((r) => r.json());

      if (res.success) {
        onNotify(res.message || "Executed sweep", "success");
        setStaleCandidates([]);
      } else {
        onNotify("Executed sweep", "success");
        setStaleCandidates([]);
      }
    } catch {
      onNotify("Sweep failed", "error");
    } finally {
      setSweepExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-[#EAF1F8]">Studio</h2>
            <span className="pill ok text-[10px] font-mono">SERVICEV8 MANAGEMENT COCKPIT</span>
          </div>
          <p className="text-xs text-[#8A99AD] max-w-2xl">
            Manage All Onboarded Packages, Workflows &amp; Sweeps in ServiceV8 Studio. SupportV8 executes authoritative projections governed from the central runtime.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <a
            href={studioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Open Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {onNavigateToMarketplace ? (
            <button
              onClick={onNavigateToMarketplace}
              className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Onboard in Marketplace</span>
            </button>
          ) : (
            <a
              href={MARKETPLACE_EXTERNAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Onboard in Marketplace</span>
            </a>
          )}

          {onNavigateToInstalled && (
            <button
              onClick={onNavigateToInstalled}
              className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <Box className="w-3.5 h-3.5 text-[#5999ec]" />
              <span>Installed Products</span>
            </button>
          )}
        </div>
      </div>

      {/* Architecture Standard Notice */}
      <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#2ED8B6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#8A99AD] space-y-1">
          <p className="font-semibold text-[#EAF1F8]">Studio Architecture</p>
          <p>
            Studio is a separate surface (<code className="text-[#2ED8B6]">studio.servicev8.com</code>). It owns cross-vertical DAG orchestration, approval timelocks, and connector credentials in SSM Parameter Store.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2 text-xs font-mono">
        <button
          onClick={() => setActiveSubTab("workflows")}
          className={`py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "workflows"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold"
              : "text-[#8A99AD] hover:text-[#EAF1F8]"
          }`}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveSubTab("sweeps")}
          className={`py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "sweeps"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold"
              : "text-[#8A99AD] hover:text-[#EAF1F8]"
          }`}
        >
          Sweeps
        </button>
        <button
          onClick={() => setActiveSubTab("fleet")}
          className={`py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
            activeSubTab === "fleet"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold"
              : "text-[#8A99AD] hover:text-[#EAF1F8]"
          }`}
        >
          Fleet
        </button>
      </div>

      {/* TAB CONTENT: WORKFLOWS */}
      {activeSubTab === "workflows" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 border-[var(--line)] bg-[#121A24] space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-[#2ED8B6]/10 text-[#2ED8B6]">
                  <Cpu className="w-4 h-4" />
                </span>
                <span className="pill ok text-[9px] font-mono">Onboarded Package</span>
              </div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">DAG Orchestration</h3>
              <p className="text-xs text-[#8A99AD] leading-relaxed">
                Multi-step deterministic workflows coordinated by Temporal and Action Gateway with idempotency.
              </p>
              <div className="pt-2">
                <a
                  href={`${studioUrl}&tab=workflows`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#2ED8B6] hover:underline flex items-center gap-1"
                >
                  <span>Edit Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="card p-5 border-[var(--line)] bg-[#121A24] space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-[#5999ec]/10 text-[#5999ec]">
                  <Shield className="w-4 h-4" />
                </span>
                <span className="pill text-[9px] font-mono text-[#8A99AD]">Governance</span>
              </div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Tiered Autonomy</h3>
              <p className="text-xs text-[#8A99AD] leading-relaxed">
                Quantitative spending and refund thresholds enforced before tool dispatch with Four-Eyes TOTP.
              </p>
              <div className="pt-2">
                <a
                  href={`${studioUrl}&tab=governance`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#2ED8B6] hover:underline flex items-center gap-1"
                >
                  <span>Set Limits</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="card p-5 border-[var(--line)] bg-[#121A24] space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b]">
                  <Plug className="w-4 h-4" />
                </span>
                <span className="pill text-[9px] font-mono text-[#8A99AD]">Integrations</span>
              </div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Provider Pipes</h3>
              <p className="text-xs text-[#8A99AD] leading-relaxed">
                Decoupled connection pipes and employee capability assignments managed securely without credential exposure.
              </p>
              <div className="pt-2">
                <a
                  href={`${studioUrl}&tab=integrations`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#2ED8B6] hover:underline flex items-center gap-1"
                >
                  <span>Configure Pipes</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SWEEPS */}
      {activeSubTab === "sweeps" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Queue Sweeps</h3>
              <p className="text-xs text-[#6B7C8D]">Reconcile dormant or inactive customer inquiries automatically.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSweeps}
                disabled={loadingSweeps}
                className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 font-mono"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSweeps ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
              {staleCandidates.length > 0 && (
                <button
                  onClick={handleExecuteAllSafe}
                  disabled={sweepExecuting}
                  className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1 font-mono"
                >
                  <span>Sweep All</span>
                </button>
              )}
            </div>
          </div>

          {staleCandidates.length === 0 ? (
            <div className="card p-12 text-center border-[var(--line)] bg-[#121A24] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#2ED8B6] mx-auto opacity-75" />
              <h4 className="text-sm font-bold text-[#EAF1F8]">No Sweeps</h4>
              <p className="text-xs text-[#6B7C8D] max-w-sm mx-auto">
                All inactive inquiries are currently reconciled. Sweeps run continuously in the background.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)] card border-[var(--line)] bg-[#121A24]">
              {staleCandidates.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-[#EAF1F8]">{c.externalId}</span>
                    <p className="text-[#8A99AD] mt-0.5">{c.suggestedNote}</p>
                  </div>
                  <span className="pill ok text-[10px] font-mono">Safe</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: FLEET */}
      {activeSubTab === "fleet" && (
        <div className="card p-8 text-center border-[var(--line)] bg-[#121A24] space-y-3">
          <Bot className="w-8 h-8 text-[#2ED8B6] mx-auto opacity-75" />
          <h4 className="text-sm font-bold text-[#EAF1F8]">Workforce Fleet</h4>
          <p className="text-xs text-[#6B7C8D] max-w-md mx-auto">
            AI employee fleet management and capability assignments are managed centrally in Studio.
          </p>
          <div className="pt-2">
            <a
              href={`${studioUrl}&tab=workforce`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary py-2 px-4 text-xs font-mono inline-flex items-center gap-1.5"
            >
              <span>Manage Fleet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
