"use client";

import React from "react";
import {
  FileText,
  Download,
  Shield,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import type { ComplianceAuditReport } from "@/lib/types/marketplace-types";

interface GovernanceReportsViewProps {
  reports: ComplianceAuditReport[];
  onDownloadCsv: (reportId: string) => void;
}

export function GovernanceReportsView({
  reports,
  onDownloadCsv,
}: GovernanceReportsViewProps) {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Governance Compliance &amp; Audit Reports</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Export monthly audit trails covering autonomous resolution rate (VARR), AI hallucination drift metrics, and net dollar savings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDownloadCsv(reports[0]?.id || "REP-LATEST")}
          className="btn btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Latest Audit Package</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">SLA Attainment</span>
          <div className="text-xl font-extrabold font-mono text-[#4CC38A]">98.4%</div>
          <span className="text-[10px] text-[#4CC38A] font-mono">Target: &gt; 98.0%</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Autonomous Resolution (VARR)</span>
          <div className="text-xl font-extrabold font-mono text-[#2ED8B6]">74.8%</div>
          <span className="text-[10px] text-[#6B7C8D] font-mono">13,780 resolved by AI</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Hallucination Drift Rate</span>
          <div className="text-xl font-extrabold font-mono text-[#4D9FFF]">0.02%</div>
          <span className="text-[10px] text-[#4CC38A] font-mono">Audited by Eleanor (AI Compliance)</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Estimated Cost Savings</span>
          <div className="text-xl font-extrabold font-mono text-[#EAF1F8]">$58,400</div>
          <span className="text-[10px] text-[#2ED8B6] font-mono">Month-to-Date Net ROI</span>
        </div>
      </div>

      {/* Audit Reports Log */}
      <div className="card rounded-2xl border-[var(--line)] overflow-hidden bg-[#121A24]">
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#EAF1F8] font-mono">Monthly Audit Logs &amp; Cryptographic Signatures</h3>
          <span className="pill ok text-[10px] font-mono">CHAIN-VALIDATED</span>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {reports.map((rep) => (
            <div key={rep.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#18222E]/50 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-[#2ED8B6]">{rep.id}</span>
                  <span className="text-xs font-semibold text-[#EAF1F8]">{rep.period}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#6B7C8D]">
                  <span>Total Interactions: <strong className="text-[#EAF1F8]">{rep.totalInteractions.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Autonomous: <strong className="text-[#4CC38A]">{rep.autonomousResolved.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Policy Violations: <strong className="text-[#4CC38A]">{rep.policyViolations}</strong></span>
                  <span>•</span>
                  <span>Drift: <strong className="text-[#4D9FFF]">{rep.hallucinationDriftScore}%</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right font-mono text-xs hidden md:block">
                  <div className="text-[#2ED8B6] font-bold">${rep.costSavedEstimatedUsd.toLocaleString()} saved</div>
                  <div className="text-[10px] text-[#6B7C8D]">{rep.slaAttainmentPct}% SLA</div>
                </div>

                <button
                  type="button"
                  onClick={() => onDownloadCsv(rep.id)}
                  className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
