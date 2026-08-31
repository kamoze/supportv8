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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plans.map((plan) => {
          const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
          const isCurrent = plan.isCurrent;

          return (
            <div
              key={plan.id}
              className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                isCurrent
                  ? "bg-[#121A24] border-2 border-[#2ED8B6] shadow-xl ring-1 ring-[#2ED8B6]/30 relative"
                  : "bg-[#0E1520] border-[var(--line)] hover:border-[var(--line-2)]"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 pill ok text-[9px] font-bold uppercase font-mono shadow-md whitespace-nowrap">
                  {plan.badge}
                </span>
              )}

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#EAF1F8]">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    {plan.priceDisplay ? (
                      <span className="text-2xl font-extrabold text-[#EAF1F8] font-mono">
                        {plan.priceDisplay}
                      </span>
                    ) : (
                      <>
                        <span className="text-2xl font-extrabold text-[#EAF1F8] font-mono">
                          ${price}
                        </span>
                        <span className="text-[11px] text-[#6B7C8D] font-mono">/ mo</span>
                      </>
                    )}
                  </div>
                  {plan.creditsDisplay && (
                    <div className="text-[11px] font-mono font-bold text-[#2ED8B6] bg-[#2ED8B6]/10 border border-[#2ED8B6]/25 px-2 py-1 rounded-lg">
                      {plan.creditsDisplay}
                    </div>
                  )}
                </div>

                {plan.description && (
                  <p className="text-xs text-[#B4C2D0] leading-relaxed min-h-[36px]">
                    {plan.description}
                  </p>
                )}

                {/* Features List */}
                <div className="space-y-2 pt-1 border-t border-[var(--line)]">
                  <span className="text-[9px] font-mono text-[#6B7C8D] uppercase block">
                    Capabilities:
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs text-[#EAF1F8]">
                      <Check className="w-3.5 h-3.5 text-[#2ED8B6] shrink-0 mt-0.5" />
                      <span className="leading-snug text-[11px]">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button & Note */}
              <div className="pt-3 border-t border-[var(--line)]">
                {plan.id === "plan_trial" ? (
                  <div>
                    <button
                      type="button"
                      disabled
                      className="btn w-full py-2.5 text-xs font-bold border border-[var(--line)] bg-[#141C26] text-[#8E9AA8] cursor-not-allowed"
                    >
                      Not self-serve
                    </button>
                    <p className="text-[10px] text-[#8E9AA8] text-center mt-2 leading-tight">
                      Trials aren&apos;t started from this page — talk to ServiceV8 to arrange one.
                    </p>
                  </div>
                ) : isCurrent ? (
                  <div>
                    <button
                      type="button"
                      disabled
                      className="btn btn-secondary text-[#4CC38A] border-[#4CC38A]/40 bg-[#4CC38A]/10 w-full py-2.5 text-xs font-bold cursor-default flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Current plan</span>
                    </button>
                    <p className="text-[10px] text-[#4CC38A] text-center mt-2 leading-tight">
                      This is the package this account is on.
                    </p>
                  </div>
                ) : plan.id === "plan_enterprise" ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectPlan(plan.id)}
                      className="btn btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:border-[#2ED8B6]/60 cursor-pointer"
                    >
                      <span>CONTACT SALES</span>
                    </button>
                    <p className="text-[10px] text-[#8E9AA8] text-center mt-2 leading-tight">
                      Custom allowance, invoicing and terms.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPlan(plan.id)}
                    className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[#2ED8B6]/20 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>CHOOSE PLAN</span>
                  </button>
                )}
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
