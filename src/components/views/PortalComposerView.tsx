"use client";

/* eslint-disable @next/next/no-img-element -- tenant-owned HTTPS image hosts are validated at publish time and cannot be enumerated at build time. */

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthService } from "@/lib/auth-service";
import {
  actionHref,
  emptyPortalConfig,
  type PortalAction,
  type PortalActionIcon,
  type PortalConfig,
  type PortalSectionKey,
} from "@/lib/portal/config";
import type { PortalAnalytics } from "@/lib/portal/analytics";
import { createPortalLoadGuard } from "@/lib/portal/load-guard";

interface PortalComposerViewProps {
  tenantSlug: string;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

type DraftPayload = {
  config: PortalConfig;
  draftRevision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  analytics?: PortalAnalytics | null;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[#0E1520] px-3.5 py-2.5 text-sm text-[#EAF1F8] outline-none transition focus:border-[#2ED8B6] focus:ring-2 focus:ring-[#2ED8B6]/15";

const ICONS: Array<{ value: PortalActionIcon; label: string; className: string }> = [
  { value: "tools", label: "Troubleshooting", className: "fi fi-rr-tools" },
  { value: "book", label: "Guide", className: "fi fi-rr-book-open-cover" },
  { value: "billing", label: "Billing", className: "fi fi-rr-receipt" },
  { value: "shield", label: "Security", className: "fi fi-rr-shield-check" },
  { value: "message", label: "Conversation", className: "fi fi-rr-comment-alt-dots" },
  { value: "status", label: "Status", className: "fi fi-rr-pulse" },
];

const SECTION_COPY: Record<PortalSectionKey, { label: string; description: string }> = {
  actions: { label: "Help topics", description: "Published one-click RAG and chat actions" },
  search: { label: "Knowledge search", description: "Free-text search across public knowledge" },
  tracker: { label: "Request tracker", description: "Customer ticket and dispatch lookup" },
  channels: { label: "Contact channels", description: "Ways customers can reach the support team" },
};

function iconClass(icon: PortalActionIcon): string {
  return ICONS.find((item) => item.value === icon)?.className || ICONS[0].className;
}

function actionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `action_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `action_${Date.now().toString(36)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function validHex(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function readableInk(hex: string): string {
  const value = validHex(hex, "#2ED8B6").slice(1);
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? "#04110E" : "#FFFFFF";
}

function brandStyle(config: PortalConfig): CSSProperties & Record<string, string> {
  const primary = validHex(config.branding.primaryColor, "#2ED8B6");
  const accent = validHex(config.branding.accentColor, "#57E5C8");
  return {
    "--portal-primary": primary,
    "--portal-accent": accent,
    "--portal-primary-soft": `${primary}1F`,
    "--portal-primary-border": `${primary}59`,
    "--portal-on-primary": readableInk(primary),
  };
}

async function portalApi(init?: RequestInit): Promise<DraftPayload> {
  const response = await AuthService.authenticatedFetch("/api/portal/admin", init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error(body.error || "The portal could not be loaded.");
  return body as DraftPayload;
}

export function PortalComposerView({ tenantSlug, onNotify }: PortalComposerViewProps) {
  const loadGuard = useRef(createPortalLoadGuard());
  const [config, setConfig] = useState<PortalConfig>(() => emptyPortalConfig(tenantSlug));
  const [draftRevision, setDraftRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"logo" | "hero" | null>(null);
  const [analytics, setAnalytics] = useState<PortalAnalytics | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const isCurrent = loadGuard.current.begin();
    setLoading(true);
    setError("");
    setConfig(emptyPortalConfig(tenantSlug));
    setDraftRevision(0);
    setPublishedRevision(null);
    setPublishedAt(null);
    setSelectedActionId(null);
    setDirty(false);
    setSaving(false);
    setUploadingAsset(null);
    setAnalytics(null);
    try {
      const data = await portalApi();
      if (!isCurrent()) return;
      setConfig(data.config);
      setDraftRevision(data.draftRevision);
      setPublishedRevision(data.publishedRevision);
      setPublishedAt(data.publishedAt);
      setAnalytics(data.analytics ?? null);
      setSelectedActionId(data.config.actions[0]?.id || null);
      setDirty(false);
    } catch (cause) {
      if (!isCurrent()) return;
      setConfig(emptyPortalConfig(tenantSlug));
      setError(cause instanceof Error ? cause.message : "The portal could not be loaded.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void load();
    return () => loadGuard.current.invalidate();
  }, [load]);

  const selectedAction = useMemo(
    () => config.actions.find((action) => action.id === selectedActionId) || null,
    [config.actions, selectedActionId],
  );

  const changeConfig = (updater: (current: PortalConfig) => PortalConfig) => {
    setConfig((current) => updater(current));
    setDirty(true);
    setError("");
  };

  const changeBranding = (updates: Partial<PortalConfig["branding"]>) => {
    changeConfig((current) => ({
      ...current,
      branding: { ...current.branding, ...updates },
    }));
  };

  const uploadBrandAsset = async (kind: "logo" | "hero", file: File) => {
    setUploadingAsset(kind);
    setError("");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const response = await AuthService.authenticatedFetch("/api/portal/admin/media", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success || typeof body.url !== "string") {
        throw new Error(body.error || "The image could not be uploaded.");
      }
      changeBranding(kind === "logo" ? { logoUrl: body.url } : { heroImageUrl: body.url });
      onNotify?.(`${kind === "logo" ? "Logo" : "Hero image"} uploaded to the portal CDN. Save or publish to apply it.`, "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setUploadingAsset(null);
    }
  };

  const successfulRate = analytics?.summary.totalRequests
    ? Math.round((analytics.summary.successfulRequests / analytics.summary.totalRequests) * 100)
    : 0;

  const saveDraft = async (): Promise<DraftPayload> => {
    setSaving(true);
    setError("");
    try {
      const data = await portalApi({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, expectedRevision: draftRevision }),
      });
      setConfig(data.config);
      setDraftRevision(data.draftRevision);
      setPublishedRevision(data.publishedRevision);
      setPublishedAt(data.publishedAt);
      setDirty(false);
      onNotify?.("Support portal draft saved.", "success");
      return data;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The portal draft could not be saved.";
      setError(message);
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError("");
    try {
      let revision = draftRevision;
      if (dirty || revision === 0) {
        const saved = await portalApi({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, expectedRevision: revision }),
        });
        revision = saved.draftRevision;
        setConfig(saved.config);
        setDraftRevision(saved.draftRevision);
      }
      const data = await portalApi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", expectedRevision: revision }),
      });
      setConfig(data.config);
      setDraftRevision(data.draftRevision);
      setPublishedRevision(data.publishedRevision);
      setPublishedAt(data.publishedAt);
      setDirty(false);
      onNotify?.("Support portal published to the tenant domain.", "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The portal could not be published.");
    } finally {
      setSaving(false);
    }
  };

  const updateAction = (id: string, updates: Partial<PortalAction>) => {
    changeConfig((current) => ({
      ...current,
      actions: current.actions.map((action) => (action.id === id ? { ...action, ...updates } : action)),
    }));
  };

  const moveAction = (id: string, direction: -1 | 1) => {
    changeConfig((current) => {
      const actions = [...current.actions];
      const index = actions.findIndex((action) => action.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= actions.length) return current;
      [actions[index], actions[target]] = [actions[target], actions[index]];
      return { ...current, actions };
    });
  };

  const addAction = () => {
    const action: PortalAction = {
      id: actionId(),
      slug: `help-topic-${config.actions.length + 1}`,
      label: "New help topic",
      description: "Explain what the customer can resolve from this entry point.",
      prompt: "Find the published troubleshooting guidance for this topic.",
      mode: "answer",
      icon: "tools",
      categories: [],
      enabled: true,
    };
    changeConfig((current) => ({ ...current, actions: [...current.actions, action] }));
    setSelectedActionId(action.id);
  };

  if (loading) {
    return <p role="status" className="p-6 text-sm text-[#B4C2D0]">Loading support portal composer…</p>;
  }

  return (
    <section className="min-h-full bg-[#0B1017] text-[#EAF1F8]">
      <div className="border-b border-[var(--line)] bg-[#0E1520] px-5 py-4 sm:px-7">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Support portal composer</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#B4C2D0]">
              Publish branded self-service entry points without exposing prompts, tenant identifiers, or internal knowledge.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-[#8E9AA8] sm:inline">
              {publishedRevision
                ? `Published revision ${publishedRevision}${publishedAt ? ` · ${new Date(publishedAt).toLocaleDateString()}` : ""}`
                : "Not published"}
            </span>
            <button type="button" className="btn btn-secondary" disabled={saving || !dirty} onClick={() => void saveDraft().catch(() => undefined)}>
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void publish()}>
              <i className="fi fi-rr-cloud-upload-alt mr-2" aria-hidden="true" />
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--line)] bg-[#0B1017] px-5 py-5 sm:px-7">
        <section className="mx-auto max-w-[1480px]" aria-labelledby="portal-analytics-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="portal-analytics-heading" className="text-base font-semibold">Portal activity</h2>
              <p className="mt-1 text-sm text-[#8E9AA8]">Customer searches and published help-topic outcomes from the last {analytics?.windowDays || 30} days.</p>
            </div>
            {analytics && analytics.summary.totalRequests > 0 && (
              <span className="text-xs text-[#6B7C8D]">Updated when this page loads</span>
            )}
          </div>

          {analytics === null ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#F5A623]/30 bg-[#F5A623]/8 px-4 py-3 text-sm text-[#F8D8A1]">
              <i className="fi fi-rr-triangle-warning shrink-0" aria-hidden="true" />
              <span>Analytics are temporarily unavailable. Portal editing and publishing are unaffected.</span>
            </div>
          ) : analytics.summary.totalRequests === 0 ? (
            <div className="mt-4 flex items-center gap-3 border-y border-[var(--line)] py-4 text-sm text-[#8E9AA8]">
              <i className="fi fi-rr-chart-histogram text-lg text-[#2ED8B6]" aria-hidden="true" />
              <span>No portal activity yet. Results will appear after customers search or open a published help topic.</span>
            </div>
          ) : (
            <>
              <dl className="mt-4 grid overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0E1520] sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Customer requests", analytics.summary.totalRequests.toLocaleString()],
                  ["Successful outcomes", `${successfulRate}%`],
                  ["No-result searches", analytics.summary.noResultRequests.toLocaleString()],
                  ["Average response", analytics.summary.averageDurationMs < 1000 ? `${analytics.summary.averageDurationMs} ms` : `${(analytics.summary.averageDurationMs / 1000).toFixed(1)} s`],
                ].map(([label, value], index) => (
                  <div key={label} className={`px-4 py-3.5 ${index > 0 ? "border-t border-[var(--line)] sm:border-t-0 sm:[&:nth-child(2)]:border-l xl:border-l" : ""} ${index > 1 ? "sm:border-t xl:border-t-0" : ""}`}>
                    <dt className="text-xs text-[#8E9AA8]">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-[#EAF1F8]">{value}</dd>
                  </div>
                ))}
              </dl>
              {analytics.actions.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)]">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-[#0E1520] text-xs text-[#8E9AA8]">
                      <tr><th className="px-4 py-3 font-medium">Entry point</th><th className="px-4 py-3 font-medium">Requests</th><th className="px-4 py-3 font-medium">Successful</th><th className="px-4 py-3 font-medium">No result</th><th className="px-4 py-3 font-medium">Unavailable</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)] bg-[#0B1017]">
                      {analytics.actions.slice(0, 8).map((action) => {
                        const configured = config.actions.find((item) => item.slug === action.actionSlug);
                        const label = action.actionSlug === "__search__" ? "Knowledge search" : configured?.label || action.actionSlug;
                        return (
                          <tr key={action.actionSlug}>
                            <th scope="row" className="px-4 py-3 font-medium text-[#EAF1F8]">{label}</th>
                            <td className="px-4 py-3 tabular-nums text-[#B4C2D0]">{action.totalRequests}</td>
                            <td className="px-4 py-3 tabular-nums text-[#57E5C8]">{action.successfulRequests}</td>
                            <td className="px-4 py-3 tabular-nums text-[#B4C2D0]">{action.noResultRequests}</td>
                            <td className="px-4 py-3 tabular-nums text-[#FF9A9E]">{action.unavailableRequests + action.rateLimitedRequests}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="mx-auto grid max-w-[1480px] gap-7 px-5 py-6 sm:px-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="min-w-0 space-y-8">
          {error && (
            <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-[#E5484D]/45 bg-[#E5484D]/10 p-4 text-sm text-[#FFD4D6]">
              <span>{error}</span>
              <button type="button" className="shrink-0 underline underline-offset-4" onClick={() => void load()}>Reload</button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Brand appearance</h2>
              <p className="mt-1 text-sm text-[#8E9AA8]">Upload portal artwork to tenant-scoped object storage. CloudFront serves the immutable public files.</p>
            </div>
            <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[#0E1520] p-4 sm:grid-cols-2 sm:p-5">
              {([
                { kind: "logo" as const, label: "Logo", url: config.branding.logoUrl, help: "PNG, JPEG, or WebP · up to 2 MB", previewClass: "h-14 w-24 object-contain" },
                { kind: "hero" as const, label: "Hero banner", url: config.branding.heroImageUrl, help: "Wide PNG, JPEG, or WebP · up to 8 MB", previewClass: "h-24 w-full object-cover" },
              ]).map((asset) => (
                <div key={asset.kind} className="rounded-xl border border-[var(--line)] bg-[#0B1017] p-4 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-[#EAF1F8]">{asset.label}</h3>
                      <p className="mt-1 text-xs text-[#6B7C8D]">{asset.help}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {asset.url && <button type="button" className="text-xs text-[#FF9A9E] underline underline-offset-4" onClick={() => changeBranding(asset.kind === "logo" ? { logoUrl: null } : { heroImageUrl: null })}>Remove</button>}
                      <label className={`btn btn-secondary cursor-pointer ${uploadingAsset ? "pointer-events-none opacity-50" : ""}`}>
                        <i className="fi fi-rr-cloud-upload-alt mr-2" aria-hidden="true" />
                        {uploadingAsset === asset.kind ? "Uploading…" : asset.url ? "Replace" : "Upload"}
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={uploadingAsset !== null}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadBrandAsset(asset.kind, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {asset.url ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-[#344354] bg-[#121A24] p-2">
                      <img src={asset.url} alt={`Current ${asset.label.toLowerCase()}`} referrerPolicy="no-referrer" className={asset.previewClass} />
                    </div>
                  ) : (
                    <div className="mt-4 flex h-16 items-center justify-center rounded-xl border border-dashed border-[#344354] text-xs text-[#6B7C8D]">
                      No {asset.label.toLowerCase()} uploaded
                    </div>
                  )}
                </div>
              ))}
              {([
                ["Primary color", "primaryColor"],
                ["Accent color", "accentColor"],
              ] as const).map(([label, key]) => (
                <label key={key} className="text-sm text-[#B4C2D0]">
                  {label}
                  <span className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${label} picker`}
                      className="h-11 w-12 cursor-pointer rounded-lg border border-[#344354] bg-[#121A24] p-1"
                      value={validHex(config.branding[key], key === "primaryColor" ? "#2ED8B6" : "#57E5C8")}
                      onChange={(event) => changeBranding({ [key]: event.target.value.toUpperCase() })}
                    />
                    <input
                      maxLength={7}
                      pattern="#[0-9a-fA-F]{6}"
                      aria-label={`${label} hex value`}
                      className={`${inputClass} mt-0 font-mono uppercase`}
                      value={config.branding[key]}
                      onChange={(event) => changeBranding({ [key]: event.target.value.toUpperCase() })}
                    />
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Portal introduction</h2>
              <p className="mt-1 text-sm text-[#8E9AA8]">This copy appears at the top of the tenant’s public support page.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-[#B4C2D0]">
                Support name
                <input maxLength={80} className={inputClass} value={config.supportName} onChange={(event) => changeConfig((current) => ({ ...current, supportName: event.target.value }))} />
              </label>
              <label className="text-sm text-[#B4C2D0]">
                Help topics heading
                <input maxLength={80} className={inputClass} value={config.actionsHeading} onChange={(event) => changeConfig((current) => ({ ...current, actionsHeading: event.target.value }))} />
              </label>
              <label className="text-sm text-[#B4C2D0] sm:col-span-2">
                Headline
                <input maxLength={120} className={inputClass} value={config.headline} onChange={(event) => changeConfig((current) => ({ ...current, headline: event.target.value }))} />
              </label>
              <label className="text-sm text-[#B4C2D0] sm:col-span-2">
                Introduction
                <textarea rows={3} maxLength={280} className={inputClass} value={config.introduction} onChange={(event) => changeConfig((current) => ({ ...current, introduction: event.target.value }))} />
              </label>
              <label className="text-sm text-[#B4C2D0] sm:col-span-2">
                Knowledge search placeholder
                <input maxLength={120} className={inputClass} value={config.searchPlaceholder} onChange={(event) => changeConfig((current) => ({ ...current, searchPlaceholder: event.target.value }))} />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Visible sections</h2>
              <p className="mt-1 text-sm text-[#8E9AA8]">Disabled sections disappear from the next published version.</p>
            </div>
            <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[#0E1520]">
              {(Object.keys(SECTION_COPY) as PortalSectionKey[]).map((key) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-5 px-4 py-3.5">
                  <span>
                    <span className="block text-sm font-medium text-[#EAF1F8]">{SECTION_COPY[key].label}</span>
                    <span className="mt-0.5 block text-xs text-[#8E9AA8]">{SECTION_COPY[key].description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={config.sections[key]}
                    onChange={(event) => changeConfig((current) => ({
                      ...current,
                      sections: { ...current.sections, [key]: event.target.checked },
                    }))}
                    className="h-5 w-5 accent-[#2ED8B6]"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Published help actions</h2>
                <p className="mt-1 text-sm text-[#8E9AA8]">The public URL exposes only the slug. Prompts and knowledge filters stay server-side.</p>
              </div>
              <button type="button" className="btn btn-secondary" disabled={config.actions.length >= 12} onClick={addAction}>
                <i className="fi fi-rr-plus-small mr-2" aria-hidden="true" /> Add help action
              </button>
            </div>

            {config.actions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#344354] bg-[#0E1520] px-5 py-8 text-center">
                <i className="fi fi-rr-link-alt text-2xl text-[#2ED8B6]" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">No help actions yet</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-[#8E9AA8]">Add a troubleshooting, billing, status, or contact entry point. New tenants remain empty until an administrator publishes one.</p>
                <button type="button" className="btn btn-primary mt-4" onClick={addAction}>Create the first action</button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.25fr)]">
                <ol className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0E1520]" aria-label="Help actions">
                  {config.actions.map((action, index) => (
                    <li key={action.id} className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setSelectedActionId(action.id)}
                        aria-current={selectedActionId === action.id ? "true" : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition ${selectedActionId === action.id ? "bg-[#18222E]" : "hover:bg-[#121A24]"}`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${action.enabled ? "border-[#2ED8B6]/35 bg-[#2ED8B6]/10 text-[#2ED8B6]" : "border-[var(--line)] text-[#6B7C8D]"}`}>
                          <i className={iconClass(action.icon)} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{action.label}</span>
                          <span className="block truncate text-xs text-[#6B7C8D]">{actionHref(action)}</span>
                        </span>
                      </button>
                      <span className={`flex shrink-0 items-center gap-1 pr-2 ${selectedActionId === action.id ? "bg-[#18222E]" : ""}`}>
                        <button type="button" disabled={index === 0} aria-label={`Move ${action.label} up`} className="rounded-lg px-2 py-1 text-[#8E9AA8] hover:bg-[#243244] hover:text-white disabled:cursor-not-allowed disabled:opacity-30" onClick={() => moveAction(action.id, -1)}>↑</button>
                        <button type="button" disabled={index === config.actions.length - 1} aria-label={`Move ${action.label} down`} className="rounded-lg px-2 py-1 text-[#8E9AA8] hover:bg-[#243244] hover:text-white disabled:cursor-not-allowed disabled:opacity-30" onClick={() => moveAction(action.id, 1)}>↓</button>
                      </span>
                    </li>
                  ))}
                </ol>

                {selectedAction && (
                  <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[#121A24] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Edit help action</h3>
                      <label className="flex items-center gap-2 text-xs text-[#B4C2D0]">
                        <input type="checkbox" className="h-4 w-4 accent-[#2ED8B6]" checked={selectedAction.enabled} onChange={(event) => updateAction(selectedAction.id, { enabled: event.target.checked })} />
                        Visible
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-sm text-[#B4C2D0]">
                        Label
                        <input maxLength={80} className={inputClass} value={selectedAction.label} onChange={(event) => {
                          const label = event.target.value;
                          updateAction(selectedAction.id, { label, slug: slugify(label) || selectedAction.slug });
                        }} />
                      </label>
                      <label className="text-sm text-[#B4C2D0]">
                        Link slug
                        <input maxLength={64} pattern="[a-z0-9][a-z0-9-]*" className={inputClass} value={selectedAction.slug} onChange={(event) => updateAction(selectedAction.id, { slug: slugify(event.target.value) })} />
                      </label>
                      <label className="text-sm text-[#B4C2D0] sm:col-span-2">
                        Customer description
                        <textarea rows={2} maxLength={220} className={inputClass} value={selectedAction.description} onChange={(event) => updateAction(selectedAction.id, { description: event.target.value })} />
                      </label>
                      <label className="text-sm text-[#B4C2D0]">
                        Behavior
                        <select className={inputClass} value={selectedAction.mode} onChange={(event) => updateAction(selectedAction.id, { mode: event.target.value as PortalAction["mode"] })}>
                          <option value="answer">Show cited results</option>
                          <option value="chat">Open support chat</option>
                        </select>
                      </label>
                      <label className="text-sm text-[#B4C2D0]">
                        Icon
                        <select className={inputClass} value={selectedAction.icon} onChange={(event) => updateAction(selectedAction.id, { icon: event.target.value as PortalActionIcon })}>
                          {ICONS.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}
                        </select>
                      </label>
                      {selectedAction.mode === "answer" ? (
                        <>
                          <label className="text-sm text-[#B4C2D0] sm:col-span-2">
                            Server-side query
                            <textarea rows={3} maxLength={500} className={inputClass} value={selectedAction.prompt} onChange={(event) => updateAction(selectedAction.id, { prompt: event.target.value })} />
                            <span className="mt-1.5 block text-xs text-[#6B7C8D]">Customers cannot edit or see this query. It runs only against reviewed public knowledge.</span>
                          </label>
                          <label className="text-sm text-[#B4C2D0] sm:col-span-2">
                            Knowledge categories
                            <input className={inputClass} placeholder="troubleshooting, billing" value={selectedAction.categories.join(", ")} onChange={(event) => updateAction(selectedAction.id, {
                              categories: event.target.value.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).slice(0, 8),
                            })} />
                          </label>
                        </>
                      ) : (
                        <div className="sm:col-span-2 rounded-xl border border-[#344354] bg-[#0E1520] px-4 py-3 text-xs leading-5 text-[#8E9AA8]">
                          Chat actions open customer intake with this action’s public label. Private query text is never sent to the browser.
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between border-t border-[var(--line)] pt-4">
                      <code className="self-center text-xs text-[#6B7C8D]">{actionHref(selectedAction)}</code>
                      <button type="button" className="text-sm text-[#FF8A8E] underline underline-offset-4" onClick={() => {
                        changeConfig((current) => ({ ...current, actions: current.actions.filter((action) => action.id !== selectedAction.id) }));
                        setSelectedActionId(config.actions.find((action) => action.id !== selectedAction.id)?.id || null);
                      }}>Remove action</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start" aria-label="Portal preview">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Draft preview</h2>
            <span className="text-xs text-[#6B7C8D]">{tenantSlug}.support.servicev8.com</span>
          </div>
          <div style={brandStyle(config)} className="overflow-hidden rounded-[24px] border border-[#344354] bg-[#090E15] shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[#0E1520] px-5 py-4">
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
                {config.branding.logoUrl && <img src={config.branding.logoUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-lg object-contain" />}
                <span className="truncate">{config.supportName}</span>
              </span>
              <span className="rounded-full border border-[var(--portal-primary-border)] bg-[var(--portal-primary-soft)] px-2.5 py-1 text-[10px] text-[var(--portal-accent)]">Support online</span>
            </div>
            <div className="relative overflow-hidden px-5 py-8 sm:px-7">
              {config.branding.heroImageUrl && (
                <>
                  <img src={config.branding.heroImageUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,14,21,0.98)_0%,rgba(9,14,21,0.88)_58%,rgba(9,14,21,0.62)_100%)]" />
                </>
              )}
              <div className="relative z-10">
              <h3 className="max-w-md text-2xl font-semibold tracking-tight text-white">{config.headline || "Your support headline"}</h3>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-[#B4C2D0]">{config.introduction || "Your portal introduction appears here."}</p>
              {config.sections.search && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#344354] bg-[#121A24]/95 px-4 py-3 text-sm text-[#8E9AA8]">
                  <i className="fi fi-rr-search" aria-hidden="true" />
                  <span>{config.searchPlaceholder || "Search published guidance"}</span>
                </div>
              )}
              {config.sections.actions && (
                <div className="mt-8">
                  <h4 className="text-sm font-semibold">{config.actionsHeading}</h4>
                  <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                    {config.actions.filter((action) => action.enabled).length === 0 ? (
                      <p className="py-5 text-sm text-[#6B7C8D]">No help actions will be published.</p>
                    ) : config.actions.filter((action) => action.enabled).map((action) => (
                      <div key={action.id} className="flex items-center gap-3 py-3.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--portal-primary-soft)] text-[var(--portal-primary)]"><i className={iconClass(action.icon)} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{action.label}</span><span className="block truncate text-xs text-[#8E9AA8]">{action.description}</span></span>
                        <i className="fi fi-rr-arrow-small-right text-[#6B7C8D]" aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#6B7C8D]">Preview content is not public until you publish. Previous published revisions remain unchanged while you edit.</p>
        </aside>
      </div>
    </section>
  );
}
