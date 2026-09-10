"use client";

/* eslint-disable @next/next/no-img-element -- tenant-owned HTTPS image hosts are validated at publish time and cannot be enumerated at build time. */

import { type CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";
import {
  actionHref,
  emptyPortalConfig,
  type PortalAction,
  type PortalActionIcon,
  type PortalConfig,
} from "@/lib/portal/config";

interface TenantLandingViewProps {
  tenantSlug?: string;
  onOpenSignIn: () => void;
  onOpenGlobalLanding: () => void;
  onOpenSignup: () => void;
  onSwitchTenant?: (slug: string) => void;
}

interface Citation {
  id: string;
  title: string;
  snippet: string;
  similarity: number;
}

const ACTION_ICONS: Record<PortalActionIcon, string> = {
  tools: "fi fi-rr-tools",
  book: "fi fi-rr-book-open-cover",
  billing: "fi fi-rr-receipt",
  shield: "fi fi-rr-shield-check",
  message: "fi fi-rr-comment-alt-dots",
  status: "fi fi-rr-pulse",
};

function displayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() || ""}${word.slice(1)}`)
    .join(" ") || "Your organization";
}

function openChat(topic?: string) {
  window.dispatchEvent(new CustomEvent("supportv8:open-chat", { detail: { topic, stream: "customers" } }));
}

function readableInk(hex: string): string {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "2ED8B6";
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#04110E" : "#FFFFFF";
}

function portalStyle(config: PortalConfig): CSSProperties & Record<string, string> {
  const primary = /^#[0-9a-f]{6}$/i.test(config.branding.primaryColor) ? config.branding.primaryColor : "#2ED8B6";
  const accent = /^#[0-9a-f]{6}$/i.test(config.branding.accentColor) ? config.branding.accentColor : "#57E5C8";
  return {
    "--portal-primary": primary,
    "--portal-accent": accent,
    "--portal-primary-soft": `${primary}1F`,
    "--portal-primary-border": `${primary}59`,
    "--portal-on-primary": readableInk(primary),
  };
}

export function TenantLandingView({
  tenantSlug = "acme",
  onOpenSignIn,
  onOpenGlobalLanding,
}: TenantLandingViewProps) {
  const cleanSlug = tenantSlug.toLowerCase().trim();
  const formattedName = displayName(cleanSlug);
  const isMeridian = cleanSlug === "meridian";
  const isDemo = cleanSlug === "acme" || isMeridian;
  const [config, setConfig] = useState<PortalConfig>(() => emptyPortalConfig(formattedName));
  const [portalLoaded, setPortalLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [resultTitle, setResultTitle] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [trackerTab, setTrackerTab] = useState<"ticket" | "dispatch">(isMeridian ? "dispatch" : "ticket");
  const [trackerSearchId, setTrackerSearchId] = useState("");
  const [trackedItem, setTrackedItem] = useState<null | {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    assignedTo: string;
    publicNotes: string;
  }>(null);
  const [trackerError, setTrackerError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPortalLoaded(false);
    fetch("/api/portal", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.success || !body.config) throw new Error();
        return body.config as PortalConfig;
      })
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        if (!cancelled) setConfig(emptyPortalConfig(formattedName));
      })
      .finally(() => {
        if (!cancelled) setPortalLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cleanSlug, formattedName]);

  const enabledActions = useMemo(() => config.actions.filter((action) => action.enabled), [config.actions]);

  const runSearch = async (query: string) => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSearchError("Describe what you need help with.");
      return;
    }
    setSearching(true);
    setSearchError("");
    setCitations([]);
    setResultTitle("Searching published guidance…");
    try {
      const response = await fetch("/api/portal/search", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error(body.error || "Search is unavailable.");
      setCitations(Array.isArray(body.citations) ? body.citations : []);
      setResultTitle(body.message || "Verified guidance");
    } catch (cause) {
      setResultTitle("");
      setSearchError(cause instanceof Error ? cause.message : "Search is unavailable. Start a chat for help.");
    } finally {
      setSearching(false);
    }
  };

  const runAction = async (action: PortalAction) => {
    setSearching(true);
    setSearchError("");
    setCitations([]);
    setResultTitle(`Opening ${action.label}…`);
    try {
      const response = await fetch(`/api/portal/actions/${encodeURIComponent(action.slug)}`, {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error(body.error || "This help topic is unavailable.");
      if (body.mode === "chat") {
        setResultTitle("");
        openChat(`Help with ${body.label || action.label}.`);
        return;
      }
      setCitations(Array.isArray(body.citations) ? body.citations : []);
      setResultTitle(body.message || action.label);
    } catch (cause) {
      setResultTitle("");
      setSearchError(cause instanceof Error ? cause.message : "This help topic is unavailable. Start a chat for help.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!portalLoaded || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("help");
    const action = enabledActions.find((candidate) => candidate.slug === slug);
    if (action) void runAction(action);
    // Deep links are resolved once after the published configuration loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalLoaded]);

  const handleTrackSearch = (event: FormEvent) => {
    event.preventDefault();
    setTrackerError("");
    setTrackedItem(null);
    const query = trackerSearchId.trim().toUpperCase();
    if (!query) {
      setTrackerError("Enter a ticket or work-order reference.");
      return;
    }
    if (isDemo && (query === "TCK-8821" || query.includes("8821"))) {
      setTrackedItem({
        id: "TCK-8821",
        title: "OrderV8 token sync and refund confirmation",
        status: "In progress",
        updatedAt: "12 minutes ago",
        assignedTo: "Customer Success",
        publicNotes: "Your issue has been validated and the support team is reviewing the resolution.",
      });
    } else if (isDemo && (query === "WO-7741" || query.includes("7741"))) {
      setTrackedItem({
        id: "WO-7741",
        title: "Field technician site dispatch",
        status: "En route",
        updatedAt: "5 minutes ago",
        assignedTo: "Field Dispatch",
        publicNotes: "The technician is en route. Site access has been verified.",
      });
    } else {
      setTrackerError(`No public request matched “${trackerSearchId.trim()}”. Check the reference or start a chat.`);
    }
  };

  return (
    <div style={portalStyle(config)} className="min-h-screen bg-[#090E15] text-[#EAF1F8] selection:bg-[#2ED8B6]/30 selection:text-white">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#0B1017]/95 px-5 py-3.5 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {config.branding.logoUrl ? (
              <img
                src={config.branding.logoUrl}
                alt={`${config.supportName} logo`}
                referrerPolicy="no-referrer"
                className="h-8 w-auto max-w-24 shrink-0 object-contain sm:h-9 sm:max-w-32"
              />
            ) : (
              <SupportV8Logo size={30} showText={false} />
            )}
            <div className={config.branding.logoUrl ? "hidden min-w-0 sm:block" : "min-w-0"}>
              <h1 className="truncate text-sm font-semibold">{config.supportName}</h1>
              <p className="hidden truncate text-xs text-[#6B7C8D] sm:block">{cleanSlug}.support.servicev8.com</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><button type="button" onClick={onOpenGlobalLanding} className="btn btn-secondary">Platform hub</button></div>
            <button type="button" onClick={onOpenSignIn} className="btn whitespace-nowrap px-3 sm:px-4" style={{ backgroundColor: "var(--portal-primary)", color: "var(--portal-on-primary)" }}>
              <i className="fi fi-rr-user mr-2" aria-hidden="true" /> Sign in
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <section className={`relative isolate grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:gap-16 ${config.branding.heroImageUrl ? "min-h-[430px] overflow-hidden rounded-[28px] border border-[#344354] px-6 py-9 shadow-[0_20px_60px_rgba(0,0,0,0.32)] sm:px-10 sm:py-12" : ""}`}>
          {config.branding.heroImageUrl && (
            <>
              <img src={config.branding.heroImageUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 -z-20 h-full w-full object-cover" />
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,14,21,0.98)_0%,rgba(9,14,21,0.90)_50%,rgba(9,14,21,0.72)_100%)]" />
            </>
          )}
          <div className="relative z-10">
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">{config.headline}</h2>
            <p className="mt-5 max-w-[65ch] text-base leading-7 text-[#B4C2D0]">{config.introduction}</p>

            {config.sections.search && (
              <form className="mt-8" onSubmit={(event) => { event.preventDefault(); void runSearch(searchQuery); }}>
                <label htmlFor="portal-search" className="sr-only">Search published support guidance</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <i className="fi fi-rr-search absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7C8D]" aria-hidden="true" />
                    <input id="portal-search" maxLength={500} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={config.searchPlaceholder} className="min-h-12 w-full rounded-2xl border border-[#344354] bg-[#121A24]/95 py-3 pl-11 pr-4 text-base text-white outline-none placeholder:text-[#6B7C8D] focus:border-[var(--portal-primary)] focus:ring-2 focus:ring-[var(--portal-primary-soft)]" />
                  </div>
                  <button type="submit" disabled={searching || searchQuery.trim().length < 2} className="btn min-h-12 px-6" style={{ backgroundColor: "var(--portal-primary)", color: "var(--portal-on-primary)" }}>{searching ? "Searching…" : "Search help"}</button>
                </div>
              </form>
            )}
          </div>

          {config.sections.actions && (
            <div className={`relative z-10 ${config.branding.heroImageUrl ? "rounded-2xl border border-white/10 bg-[#0E1520]/90 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.28)]" : ""}`}>
              <h3 className="text-sm font-semibold text-[#EAF1F8]">{config.actionsHeading}</h3>
              <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {enabledActions.length === 0 ? (
                  <div className="py-6">
                    <p className="text-sm text-[#8E9AA8]">No self-service topics have been published yet.</p>
                    <button type="button" className="mt-3 text-sm font-medium text-[var(--portal-accent)] underline underline-offset-4" onClick={() => openChat()}>Start a conversation</button>
                  </div>
                ) : enabledActions.map((action) => (
                  <a
                    key={action.id}
                    href={actionHref(action)}
                    onClick={(event) => { event.preventDefault(); window.history.replaceState({}, "", `?help=${encodeURIComponent(action.slug)}`); void runAction(action); }}
                    className="group flex min-h-16 items-center gap-3 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-primary)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent bg-[var(--portal-primary-soft)] text-[var(--portal-primary)] transition group-hover:border-[var(--portal-primary-border)]"><i className={ACTION_ICONS[action.icon]} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white group-hover:text-[var(--portal-accent)]">{action.label}</span><span className="mt-0.5 block text-xs leading-5 text-[#8E9AA8]">{action.description}</span></span>
                    <i className="fi fi-rr-arrow-small-right text-[#6B7C8D] transition group-hover:translate-x-1 group-hover:text-[var(--portal-accent)]" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {(resultTitle || searchError) && (
          <section className="mt-10 rounded-2xl border border-[var(--line)] bg-[#0E1520] p-5 sm:p-6" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">{searchError ? "We couldn’t complete that search" : resultTitle}</h3>
                {searchError && <p role="alert" className="mt-2 text-sm text-[#FF9A9E]">{searchError}</p>}
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => openChat(searchQuery || undefined)}>Ask the support team</button>
            </div>
            {citations.length > 0 && (
              <ol className="mt-5 divide-y divide-[var(--line)] border-t border-[var(--line)]">
                {citations.map((citation) => (
                  <li key={citation.id} className="py-4">
                    <div className="flex items-start gap-3">
                      <i className="fi fi-rr-book-open-cover mt-1 text-[var(--portal-primary)]" aria-hidden="true" />
                      <div><h4 className="text-sm font-semibold text-white">{citation.title}</h4><p className="mt-1 text-sm leading-6 text-[#B4C2D0]">{citation.snippet}</p><span className="mt-2 block text-xs text-[#6B7C8D]">Published customer knowledge · {Math.round(citation.similarity * 100)}% match</span></div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {config.sections.channels && (
          <section className="mt-16">
            <h3 className="text-lg font-semibold">Choose how to get help</h3>
            <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
              {[
                ["fi fi-rr-comment-alt-dots", "Live conversation", "Start with the online support queue and keep the transcript attached to your case."],
                ["fi fi-rr-book-open-cover", "Verified knowledge", "Search only the guidance this organization has approved for customers."],
                ["fi fi-rr-life-ring", "Human handoff", "Move from self-service into Work Desk without repeating the problem."],
              ].map(([icon, title, copy]) => (
                <div key={title} className="bg-[#0E1520] p-6"><i className={`${icon} text-xl text-[var(--portal-primary)]`} aria-hidden="true" /><h4 className="mt-4 text-sm font-semibold">{title}</h4><p className="mt-2 text-sm leading-6 text-[#8E9AA8]">{copy}</p></div>
              ))}
            </div>
          </section>
        )}

        {config.sections.tracker && (
          <section className="mt-16 rounded-3xl border border-[var(--line)] bg-[#0E1520] p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h3 className="text-lg font-semibold">Track a support request</h3><p className="mt-1 text-sm text-[#8E9AA8]">Only public progress is shown. Customer and site details remain protected.</p></div>
              <div className="flex rounded-xl border border-[var(--line)] bg-[#121A24] p-1" aria-label="Request type">
                <button type="button" aria-pressed={trackerTab === "ticket"} onClick={() => { setTrackerTab("ticket"); setTrackedItem(null); setTrackerError(""); }} className={`rounded-lg px-3 py-1.5 text-sm ${trackerTab === "ticket" ? "" : "text-[#B4C2D0]"}`} style={trackerTab === "ticket" ? { backgroundColor: "var(--portal-primary)", color: "var(--portal-on-primary)" } : undefined}>Ticket</button>
                <button type="button" aria-pressed={trackerTab === "dispatch"} onClick={() => { setTrackerTab("dispatch"); setTrackedItem(null); setTrackerError(""); }} className={`rounded-lg px-3 py-1.5 text-sm ${trackerTab === "dispatch" ? "" : "text-[#B4C2D0]"}`} style={trackerTab === "dispatch" ? { backgroundColor: "var(--portal-primary)", color: "var(--portal-on-primary)" } : undefined}>Dispatch</button>
              </div>
            </div>
            <form onSubmit={handleTrackSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="tracker-reference" className="sr-only">Request reference</label>
              <input id="tracker-reference" value={trackerSearchId} onChange={(event) => setTrackerSearchId(event.target.value)} placeholder={trackerTab === "ticket" ? "Enter ticket reference" : "Enter work-order reference"} className="min-h-11 flex-1 rounded-xl border border-[var(--line)] bg-[#121A24] px-4 text-base outline-none focus:border-[var(--portal-primary)]" />
              <button type="submit" className="btn btn-secondary min-h-11 px-5">Track request</button>
            </form>
            {trackerError && <p role="alert" className="mt-4 text-sm text-[#FF9A9E]">{trackerError}</p>}
            {trackedItem && <div className="mt-5 border-t border-[var(--line)] pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">{trackedItem.id} · {trackedItem.title}</h4><span className="rounded-full bg-[var(--portal-primary-soft)] px-3 py-1 text-xs text-[var(--portal-accent)]">{trackedItem.status}</span></div><p className="mt-2 text-sm text-[#B4C2D0]">{trackedItem.publicNotes}</p><p className="mt-3 text-xs text-[#6B7C8D]">Assigned: {trackedItem.assignedTo} · Updated {trackedItem.updatedAt}</p></div>}
          </section>
        )}
      </main>

      <SupportChatWidget
        key={tenantSlug}
        tenantName={config.supportName.replace(/\s+Support$/i, "")}
        defaultStream={isMeridian ? "contractors" : "customers"}
        tenantDomain={tenantSlug}
        brandColor={config.branding.primaryColor}
      />
    </div>
  );
}
