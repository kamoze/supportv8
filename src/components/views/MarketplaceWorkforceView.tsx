"use client";

import React, { useState } from "react";
import {
  ShoppingBag,
  Star,
  Users,
  CheckCircle2,
  Shield,
  Zap,
  Sparkles,
  Bot,
  Plus,
} from "lucide-react";
import type { MarketplaceWorkforceItem } from "@/lib/types/marketplace-types";

interface MarketplaceWorkforceViewProps {
  workforce: MarketplaceWorkforceItem[];
  onHireAgent: (agentId: string) => void;
}

export function MarketplaceWorkforceView({
  workforce,
  onHireAgent,
}: MarketplaceWorkforceViewProps) {
  const [filterLevel, setFilterLevel] = useState<"all" | "ai_employee" | "ai_intern">("all");

  const filtered = workforce.filter((w) => {
    if (filterLevel === "all") return true;
    return w.level === filterLevel;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">AI Workforce &amp; Agent Marketplace</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Subscribe and deploy specialized corporate Beaver AI Employees &amp; Interns with pre-trained skills and autonomy constraints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["all", "ai_employee", "ai_intern"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterLevel === lvl
                  ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                  : "bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] border border-[var(--line)]"
              }`}
            >
              {lvl === "all" ? "All Agents" : lvl === "ai_employee" ? "AI Employees" : "AI Interns"}
            </button>
          ))}
        </div>
      </div>

      {/* Workforce Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
              agent.isHired
                ? "bg-[#121A24] border-[#2ED8B6]/40 shadow-sm"
                : "bg-[#0E1520] border-[var(--line)] hover:border-[var(--line-2)]"
            }`}
          >
            <div className="space-y-4">
              {/* Card Header with Beaver Avatar */}
              <div className="flex items-start gap-3.5">
                <img
                  src={agent.avatarUrl || "/avatars/beaver-manager.jpg"}
                  alt={agent.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#2ED8B6]/40 shadow-md shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#EAF1F8] truncate">{agent.name}</h3>
                    <span className="pill ok text-[9px] font-mono flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 text-[#F5A623] fill-[#F5A623]" />
                      {agent.rating}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-[#2ED8B6] truncate">{agent.role}</div>
                  <span className="pill text-[9px] font-mono uppercase bg-[#18222E]">
                    {agent.level === "ai_employee" ? "AI Employee" : "AI Intern"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-2">
                {agent.description}
              </p>

              {/* Skills Tags */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-[#6B7C8D] uppercase block">
                  Autonomous Skill Grants:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {agent.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line)] text-[10px] text-[#B4C2D0] font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Price & Hire Action */}
            <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
              <div>
                <div className="text-sm font-bold font-mono text-[#EAF1F8]">
                  ${agent.priceMonthly}
                  <span className="text-[10px] text-[#6B7C8D] font-normal"> / month</span>
                </div>
                <span className="text-[9px] text-[#6B7C8D] font-mono">{agent.hiredCount} active instances</span>
              </div>

              <button
                type="button"
                onClick={() => onHireAgent(agent.id)}
                disabled={agent.isHired}
                className={`btn text-xs py-2 px-4 font-bold flex items-center gap-1.5 cursor-pointer ${
                  agent.isHired
                    ? "btn-secondary text-[#4CC38A] border-[#4CC38A]/40 bg-[#4CC38A]/10 cursor-default"
                    : "btn-primary shadow-md"
                }`}
              >
                {agent.isHired ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hired &amp; Active</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Hire Agent</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
