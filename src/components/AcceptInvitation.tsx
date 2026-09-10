"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { browserTenantSlugFromHostname } from "@/lib/tenant-host";
import { AUTH_PASSWORD_MIN_LENGTH, passwordPolicyError } from "@/lib/auth/password-policy";
import styles from "./AcceptInvitation.module.css";

export function AcceptInvitation() {
  const [token, setToken] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const received = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (received) setToken(received);
    setWorkspace(browserTenantSlugFromHostname(window.location.hostname) || "");
    // Do not persist invitation credentials in storage, history, or referrers.
    window.history.replaceState(null, "", window.location.pathname);
    setReady(true);
  }, []);
  const validLink = /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token);
  const fieldClass = "mt-2 w-full rounded-lg border border-[var(--line)] bg-[#141C26] px-3 py-3 text-base text-[#EAF1F8] focus:outline-none focus:ring-2 focus:ring-[#2ED8B6]";

  return <main className={`${styles.surface} min-h-screen bg-[#0B1017] px-5 py-10 text-[#EAF1F8] flex items-center justify-center`}>
    <section className="w-full max-w-md space-y-6" aria-labelledby="invite-title">
      <SupportV8Logo size={32} showText />
      <h1 id="invite-title" className="text-3xl font-semibold">{done ? "Your account is ready" : "Join your workspace"}</h1>
      {done ? <>
        <p role="status" className="text-base text-[#B4C2D0]">Your email is verified and your password is set. Sign in to continue to your workspace.</p>
        <Link className={`${styles.action} btn btn-primary w-full py-3`} href="/?signin=1">Sign in to SupportV8</Link>
      </> : !ready ? <p role="status">Loading invitation…</p> : !validLink ? <>
        <p role="alert" className="text-base text-[#B4C2D0]">Open the complete link from your invitation email. If it has expired or was already used, ask your workspace administrator for a new invitation.</p>
        <Link className={`${styles.action} btn btn-secondary`} href="/?signin=1">Already joined? Sign in</Link>
      </> : <form className="space-y-5" aria-label="Accept workspace invitation" onSubmit={async event => {
        event.preventDefault(); if (saving) return;
        const passwordError = passwordPolicyError(password);
        if (passwordError) { setError(passwordError); return; }
        if (password !== confirmation) { setError("Passwords do not match. Please check both fields."); return; }
        setSaving(true); setError("");
        try {
          const response = await fetch("/api/auth/invitation", { method: "POST", credentials: "omit", redirect: "error",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || "Setup could not be completed. Ask your administrator for a new invitation.");
          setPassword(""); setConfirmation(""); setToken(""); setDone(true);
        } catch (e) { setError(e instanceof Error ? e.message : "Connection lost. Try signing in, or ask your administrator for a new invitation."); }
        finally { setSaving(false); }
      }}>
        <p className="text-base text-[#B4C2D0]">Choose your password for <strong className="break-words text-[#EAF1F8]">{workspace || "this SupportV8 workspace"}</strong>. Submitting this form verifies your email and accepts the invitation.</p>
        {error && <p role="alert" className="text-sm text-[#FF8B8B]">{error}</p>}
        <label className="block text-base">New password<input autoComplete="new-password" type="password" required minLength={AUTH_PASSWORD_MIN_LENGTH} maxLength={256} disabled={saving} value={password} onChange={e => setPassword(e.target.value)} className={fieldClass} aria-describedby="password-help" /></label>
        <p id="password-help" className="text-sm text-[#B4C2D0]">Use at least {AUTH_PASSWORD_MIN_LENGTH} characters. A long, unique passphrase is best.</p>
        <label className="block text-base">Confirm password<input autoComplete="new-password" type="password" required minLength={AUTH_PASSWORD_MIN_LENGTH} maxLength={256} disabled={saving} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={fieldClass} /></label>
        <button type="submit" disabled={saving} className={`${styles.action} btn btn-primary w-full py-3`}>{saving ? "Setting up your account…" : "Verify email and join"}</button>
        <p className="text-sm text-[#B4C2D0]">Invitations expire after 24 hours and can be used once. If setup is interrupted, sign in to check whether it completed, or ask your administrator for a new link.</p>
        <Link className="inline-block text-[#2ED8B6] underline underline-offset-4" href="/?signin=1">Already joined? Sign in</Link>
      </form>}
    </section>
  </main>;
}
