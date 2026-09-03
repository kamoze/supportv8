"use client";
import { useEffect, useState } from "react";
import { AuthService, type AuthSession } from "@/lib/auth-service";

export function OperatorProfileEditor({ session, onSaved, onClose }: {
  session: AuthSession; onSaved: (session: AuthSession) => void; onClose: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const response = await AuthService.authenticatedFetch("/api/auth/profile");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!disposed) { setFirstName(data.profile.firstName); setNickname(data.profile.nickname); }
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Unable to load your profile."); }
      finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; };
  }, []);
  return <form aria-label="Edit operator name" className="space-y-3 p-3 text-sm" onSubmit={async e => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const response = await AuthService.authenticatedFetch("/api/auth/profile", { method: "PUT",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName, nickname }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const refreshed = await AuthService.refreshSession();
      if (!refreshed) throw new Error("Name saved. Sign in again to use it in new chat replies.");
      const updated = { ...refreshed, name: data.profile.name };
      AuthService.storeSession(updated); onSaved(updated); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save. Please try again."); }
    finally { setSaving(false); }
  }}>
    <p className="text-[#B4C2D0]">Customers see your nickname, or your first name when no nickname is set.</p>
    {error && <p role="alert" className="text-[#FF7373]">{error}</p>}
    {loading ? <p role="status">Loading profile…</p> : <>
      <label className="block">First name<input autoFocus required maxLength={80} value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[#141C26] px-3 py-2 text-base" /></label>
      <label className="block">Nickname (optional)<input maxLength={80} value={nickname} onChange={e => setNickname(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[#141C26] px-3 py-2 text-base" /></label>
    </>}
    <div className="flex justify-end gap-2">
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" disabled={loading || saving} className="btn btn-primary">{saving ? "Saving…" : "Save name"}</button>
    </div>
  </form>;
}
