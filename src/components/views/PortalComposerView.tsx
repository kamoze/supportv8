"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthService } from "@/lib/auth-service";
import {
  actionHref,
  emptyPortalConfig,
  type PortalAction,
  type PortalActionIcon,
  type PortalConfig,
  type PortalSectionKey,
} from "@/lib/portal/config";

interface PortalComposerViewProps {
  tenantSlug: string;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

type DraftPayload = {
  config: PortalConfig;
  draftRevision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
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

async function portalApi(init?: RequestInit): Promise<DraftPayload> {
  const response = await AuthService.authenticatedFetch("/api/portal/admin", init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error(body.error || "The portal could not be loaded.");
  return body as DraftPayload;
}

export function PortalComposerView({ tenantSlug, onNotify }: PortalComposerViewProps) {
  const [config, setConfig] = useState<PortalConfig>(() => emptyPortalConfig(tenantSlug));
  const [draftRevision, setDraftRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await portalApi();
      setConfig(data.config);
      setDraftRevision(data.draftRevision);
      setPublishedRevision(data.publishedRevision);
      setPublishedAt(data.publishedAt);
      setSelectedActionId(data.config.actions[0]?.id || null);
      setDirty(false);
    } catch (cause) {
      setConfig(emptyPortalConfig(tenantSlug));
      setError(cause instanceof Error ? cause.message : "The portal could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void load();
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
          <div className="overflow-hidden rounded-[24px] border border-[#344354] bg-[#090E15] shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[#0E1520] px-5 py-4">
              <span className="text-sm font-semibold">{config.supportName}</span>
              <span className="rounded-full border border-[#2ED8B6]/35 bg-[#2ED8B6]/10 px-2.5 py-1 text-[10px] text-[#57E5C8]">Support online</span>
            </div>
            <div className="px-5 py-8 sm:px-7">
              <h3 className="max-w-md text-2xl font-semibold tracking-tight text-white">{config.headline || "Your support headline"}</h3>
              <p className="mt-3 max-w-[58ch] text-sm leading-6 text-[#B4C2D0]">{config.introduction || "Your portal introduction appears here."}</p>
              {config.sections.search && (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#344354] bg-[#121A24] px-4 py-3 text-sm text-[#6B7C8D]">
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
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2ED8B6]/10 text-[#2ED8B6]"><i className={iconClass(action.icon)} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{action.label}</span><span className="block truncate text-xs text-[#8E9AA8]">{action.description}</span></span>
                        <i className="fi fi-rr-arrow-small-right text-[#6B7C8D]" aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#6B7C8D]">Preview content is not public until you publish. Previous published revisions remain unchanged while you edit.</p>
        </aside>
      </div>
    </section>
  );
}
