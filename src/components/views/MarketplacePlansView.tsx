"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Check,
  CheckCircle2,
  Zap,
  Shield,
  Sparkles,
  ArrowRight,
  Clock,
  Layers,
} from "lucide-react";
import type { MarketplacePlan } from "@/lib/types/marketplace-types";

interface MarketplacePlansViewProps {
  plans: MarketplacePlan[];
  billingCycle: "monthly" | "annual";
  onToggleBillingCycle: (cycle: "monthly" | "annual") => void;
  onSelectPlan: (planId: string) => void;
  onNotify?: (text: string, type?: "success" | "error" | "info") => void;
}

export function MarketplacePlansView({
  plans,
  billingCycle,
  onToggleBillingCycle,
  onSelectPlan,
  onNotify,
}: MarketplacePlansViewProps) {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <span className="pill ok text-xs font-mono">
          <i className="dot"></i> ENTERPRISE SUBSCRIPTIONS
        </span>
        <h1 className="text-2xl font-extrabold text-[#EAF1F8]">
          Transparent, Autonomy-Driven Pricing
        </h1>
        <p className="text-xs text-[#B4C2D0]">
          Scale customer support operations with dedicated AI employee seats, pgvector RLS partitions, and real-time SLA guarantees.
        </p>

        {/* Monthly vs Annual Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-[#18222E] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => onToggleBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => onToggleBillingCycle("annual")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === "annual"
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <span>Annual Billing</span>
              <span className="pill ok text-[9px] py-0 px-1 font-mono">SAVE 20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
          const isCurrent = plan.isCurrent;

          return (
            <div
              key={plan.id}
              className={`card p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-6 ${
                isCurrent
                  ? "bg-[#121A24] border-2 border-[#2ED8B6] shadow-xl ring-1 ring-[#2ED8B6]/30 relative"
                  : "bg-[#0E1520] border-[var(--line)] hover:border-[var(--line-2)]"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 pill ok text-[10px] font-bold uppercase font-mono shadow-md">
                  {plan.badge}
                </span>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#EAF1F8]">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#EAF1F8] font-mono">
                      ${price}
                    </span>
                    <span className="text-xs text-[#6B7C8D] font-mono">/ month</span>
                  </div>
                  <div className="text-[11px] text-[#2ED8B6] font-mono font-semibold">
                    {plan.slaCommitment}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-[#B4C2D0]">
                    <span>Compute Units:</span>
                    <strong className="text-[#EAF1F8]">{plan.computeUnits}</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#B4C2D0]">
                    <span>AI Employee Seats:</span>
                    <strong className="text-[#2ED8B6]">{plan.aiEmployeeSeats} Included</strong>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-[10px] font-mono text-[#6B7C8D] uppercase block">
                    Plan Capabilities:
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#EAF1F8]">
                      <Check className="w-3.5 h-3.5 text-[#2ED8B6] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={isCurrent}
                  className={`btn w-full py-3 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    isCurrent
                      ? "btn-secondary text-[#4CC38A] border-[#4CC38A]/40 bg-[#4CC38A]/10 cursor-default"
                      : "btn-primary shadow-lg"
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Current Active Plan</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Upgrade to {plan.name}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* STANDALONE & VERTICAL ACTION CREDIT TOP-UPS */}
      {/* ========================================================================= */}
      <div className="pt-8 border-t border-[var(--line)] space-y-6">
        <div className="text-center space-y-1 max-w-xl mx-auto">
          <span className="pill ok text-xs font-mono">
            <i className="dot"></i> FORGEGW ACTION CREDITS
          </span>
          <h2 className="text-xl font-bold text-[#EAF1F8]">
            Standalone &amp; Vertical Top-Ups
          </h2>
          <p className="text-xs text-[#B4C2D0]">
            Replenish pooled microservice action credits on demand without altering your baseline subscription tier.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              credits: "5,000 Credits",
              price: "$30",
              desc: "5,000 credits. Top-up for finishing work when your monthly allowance runs out.",
              badge: "STARTER BURST",
            },
            {
              credits: "15,000 Credits",
              price: "$75",
              desc: "15,000 credits. Top-up for a burst of builds mid-cycle.",
              badge: "POPULAR",
            },
            {
              credits: "30,000 Credits",
              price: "$130",
              desc: "30,000 credits. Larger top-up for sustained work between billing periods. A subscription costs less per credit at this volume.",
              badge: "HIGH VOLUME",
            },
            {
              credits: "100,000 Credits",
              price: "$375",
              desc: "100,000 credits. Bulk top-up. For ongoing volume at this level a subscription gives more credits for less.",
              badge: "ENTERPRISE BULK",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="card p-5 rounded-2xl border border-[var(--line)] bg-[#0E1520] hover:border-[#2ED8B6]/50 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="pill ok text-[9px] font-mono font-bold uppercase">{item.badge}</span>
                  <span className="text-xl font-extrabold text-[#2ED8B6] font-mono">{item.price}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">{item.credits}</h3>
                  <p className="text-xs text-[#8E9AA8] mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => {
                    if (onNotify) {
                      onNotify(`Initiated CHECKOUT for ${item.credits} (${item.price}) via Stripe`, "success");
                    }
                  }}
                  className="btn btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>CHECKOUT</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
