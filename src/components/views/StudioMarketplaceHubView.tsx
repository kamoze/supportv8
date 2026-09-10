"use client";

import React from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Headphones,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  SlidersHorizontal,
} from "@/components/ui/FlatIcon";

interface StudioMarketplaceHubViewProps {
  tenantId?: string;
  tenantName?: string;
  onNotify: (text: string, type?: "success" | "error" | "info") => void;
}

const SOPHIA_LAUNCH_PATH = "/api/voice/sophia/launch";

export function StudioMarketplaceHubView({
  tenantName = "this workspace",
}: StudioMarketplaceHubViewProps) {
  return (
    <section className="space-y-6" aria-labelledby="workforce-heading">
      <header className="card rounded-2xl border border-[var(--line)] bg-[#121A24] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#2ED8B6]/30 bg-[#2ED8B6]/10 text-[#2ED8B6]"
                aria-hidden="true"
              >
                <Headphones className="size-5" />
              </span>
              <h1 id="workforce-heading" className="text-balance text-xl font-bold text-[#EAF1F8] sm:text-2xl">
                Voice support workforce
              </h1>
            </div>
            <p className="max-w-[72ch] text-sm leading-6 text-[#B4C2D0]">
              Hire Sophia, configure her support policy and voice, then activate inbound calls only after the deployment is ready.
            </p>
          </div>
          <a
            href={SOPHIA_LAUNCH_PATH}
            className="btn btn-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57E5C8]"
          >
            Hire or configure Sophia
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <article className="card min-w-0 rounded-2xl border border-[var(--line)] bg-[#0E1520] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-full bg-[#182230] text-[#57E5C8]"
                aria-hidden="true"
              >
                <Bot className="size-6" />
              </span>
              <div className="min-w-0 space-y-2">
                <h2 className="break-words text-lg font-semibold text-[#EAF1F8]">
                  Sophia — Customer Support Lead AI
                </h2>
                <p className="max-w-[65ch] break-words text-sm leading-6 text-[#B4C2D0]">
                  Autonomous customer care reasoning, order resolution, and sentiment escalation.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-[#2ED8B6]/30 bg-[#2ED8B6]/10 px-3 py-1 text-xs font-semibold text-[#57E5C8]">
              Demo employee
            </span>
          </div>

          <dl className="mt-7 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-[#6B7C8D]">Target solution</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-[#EAF1F8]">SupportV8</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-[#6B7C8D]">Workspace</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-[#EAF1F8]">{tenantName}</dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              [MessageSquareText, "Find support tickets and customer context"],
              [PhoneCall, "Create and escalate support cases during calls"],
              [ShieldCheck, "Use tenant-scoped knowledge and audited tools"],
              [SlidersHorizontal, "Tune tone, sentiment floor, and escalation policy"],
            ].map(([Icon, label]) => {
              const FeatureIcon = Icon as typeof MessageSquareText;
              return (
                <div key={label as string} className="flex min-w-0 items-start gap-3 rounded-xl bg-[#121A24] p-4">
                  <FeatureIcon className="mt-0.5 size-4 shrink-0 text-[#2ED8B6]" aria-hidden="true" />
                  <span className="break-words text-sm leading-5 text-[#B4C2D0]">{label as string}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[58ch] text-xs leading-5 text-[#8E9AA8]">
              Registry verifies the current entitlement and exact tenant membership when you open the flow. No employee or active state is created in the browser.
            </p>
            <a
              href={SOPHIA_LAUNCH_PATH}
              className="btn btn-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57E5C8]"
            >
              Hire or configure Sophia
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </article>

        <aside className="card rounded-2xl border border-[var(--line)] bg-[#121A24] p-6" aria-labelledby="voice-lifecycle-heading">
          <h2 id="voice-lifecycle-heading" className="text-base font-semibold text-[#EAF1F8]">
            Voice activation path
          </h2>
          <ol className="mt-5 space-y-5">
            {[
              ["Hire", "Free to hire. Voice usage consumes the account subscription allowance first, then purchased top-up credits."],
              ["Configure", "Workforce stores Sophia’s voice, support policy, and approved handoff behavior."],
              ["Activate", "Voice Agents activates inbound calls only after provider and SupportV8 readiness checks pass."],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#2ED8B6]/30 bg-[#0E1520] text-xs font-semibold tabular-nums text-[#57E5C8]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#EAF1F8]">{title}</h3>
                  <p className="mt-1 break-words text-xs leading-5 text-[#8E9AA8]">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#2ED8B6]/20 bg-[#0E1520] p-4 text-xs leading-5 text-[#B4C2D0]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2ED8B6]" aria-hidden="true" />
            <p>Ticket access, knowledge search, case creation, and escalation remain authorized inside the current SupportV8 tenant.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
