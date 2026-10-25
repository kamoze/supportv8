"use client";
import React, { useEffect, useRef, useState } from "react";

export type AuthBotProof = { challengeId: string; botToken: string };
type Action = "signup" | "signin" | "forgot_password";
type Widget = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Widget } }
let loading: Promise<Widget> | undefined;
function widget(): Promise<Widget> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<Widget>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true; script.defer = true;
    const timer = setTimeout(() => { script.remove(); loading = undefined; reject(new Error("Security verification could not load. Please retry.")); }, 8000);
    script.onload = () => { clearTimeout(timer); if (window.turnstile) resolve(window.turnstile); else { loading = undefined; reject(new Error("Security verification is unavailable.")); } };
    script.onerror = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error("Security verification could not load. Please retry.")); };
    document.head.append(script);
  });
  return loading;
}

/** Only the server may exchange this browser proof for an authentication effect. */
export function AuthBotCheck({ action, email, tenantSlug, reset, onProof }: { action: Action; email: string; tenantSlug: string; reset: number; onProof: (proof: AuthBotProof | null) => void }) {
  const slot = useRef<HTMLDivElement>(null), callback = useRef(onProof); callback.current = onProof;
  const [error, setError] = useState(""), [pending, setPending] = useState(false), [retry, setRetry] = useState(0);
  const cleanEmail = email.trim().toLowerCase(), cleanSlug = tenantSlug.trim().toLowerCase();
  useEffect(() => {
    let disposed = false, instance: string | undefined, api: Widget | undefined;
    const controller = new AbortController(); callback.current(null); setError(""); setPending(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(cleanSlug)) return;
    const timer = setTimeout(async () => {
      setPending(true);
      try {
        const response = await fetch("/api/auth/challenge", { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), headers: { "content-type": "application/json" }, body: JSON.stringify({ action, email: cleanEmail, tenantSlug: cleanSlug }) });
        const challenge = await response.json();
        if (!response.ok || challenge.success !== true) throw new Error(challenge.error || "Security verification is unavailable.");
        if (!/^[a-f0-9]{64}$/.test(challenge.challengeId) || challenge.cdata !== challenge.challengeId || challenge.action !== action || typeof challenge.siteKey !== "string") throw new Error("Security verification is unavailable.");
        api = await widget(); if (disposed || !slot.current) return;
        instance = api.render(slot.current, { sitekey: challenge.siteKey, action, cData: challenge.cdata, theme: "auto", size: slot.current.clientWidth < 300 ? "compact" : "flexible",
          callback: (token: string) => { if (!disposed) { setError(""); callback.current({ challengeId: challenge.challengeId, botToken: token }); } },
          "expired-callback": () => { if (!disposed) { callback.current(null); setError("Security check expired. Please retry."); } },
          "error-callback": () => { if (!disposed) { callback.current(null); setError("Security verification failed. Please retry."); } },
        });
      } catch (reason) { if (!disposed) setError(reason instanceof Error ? reason.message : "Security verification is unavailable."); }
      finally { if (!disposed) setPending(false); }
    }, 500);
    return () => { disposed = true; clearTimeout(timer); controller.abort(); callback.current(null); if (instance !== undefined) api?.remove(instance); };
  }, [action, cleanEmail, cleanSlug, reset, retry]);
  return <div className="space-y-2" aria-label="Security verification">
    <div ref={slot} />
    {pending && <p role="status" className="text-xs text-[var(--text-secondary)]">Loading security check…</p>}
    {error && <div role="alert" className="text-xs text-[var(--text-secondary)]"><p>{error}</p><button type="button" className="mt-2 underline" onClick={() => setRetry(value => value + 1)}>Retry security check</button></div>}
  </div>;
}
