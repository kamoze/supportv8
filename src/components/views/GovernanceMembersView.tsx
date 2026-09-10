"use client";
import { useCallback, useEffect, useState } from "react";
import { AuthService } from "@/lib/auth-service";
import type { TenantMember } from "@/lib/types/marketplace-types";
import type { StaffPresence } from "@/lib/chat/staff-presence";

interface Props {
  members: TenantMember[];
  onOpenInviteModal: () => void;
  onUpdateMember?: (member: TenantMember) => void;
  onUpdateMembers?: (members: TenantMember[]) => void;
}
const roles: TenantMember["role"][] = ["Tier 2 Escalation Agent", "Security & Compliance Auditor", "Contractor Lead", "Field Technician", "CX Operations Lead", "Owner / CX Director"];
const inputClass = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[#141C26] px-3 py-2 text-base text-[#EAF1F8]";
async function api(path: string, init?: RequestInit) {
  const response = await AuthService.authenticatedFetch(path, init);
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

export function GovernanceMembersView({ members: externalMembers, onUpdateMember }: Props) {
  const [tab, setTab] = useState<"roster" | "presence">("roster");
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [staff, setStaff] = useState<StaffPresence[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [owner, setOwner] = useState(false);
  const [actorId, setActorId] = useState("");
  const [first, setFirst] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantMember["role"]>("Tier 2 Escalation Agent");
  const [status, setStatus] = useState<TenantMember["status"]>("active");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (tab === "roster") {
        const data = await api("/api/members?first=" + first);
        setMembers(data.members); setOwner(data.owner); setActorId(data.actorId); setHasMore(data.hasMore);
      } else {
        const data = await api("/api/presence");
        setStaff(data.staff); setEmployees(data.employees);
      }
    } catch (e) {
      // Never retain a previous workspace's or an expired presence snapshot on failure.
      setMembers([]); setStaff([]); setEmployees([]);
      setError(e instanceof Error ? e.message : "Unable to load. Please retry.");
    } finally { setLoading(false); }
  }, [first, tab]);

  useEffect(() => { void refresh(); }, [refresh, externalMembers.length]);
  useEffect(() => {
    if (tab !== "presence") return;
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [tab, refresh]);

  const startEdit = (member: TenantMember) => {
    setEditing(member); setInviting(false); setName(member.name); setEmail(member.email);
    setRole(member.role); setStatus(member.status); setFormError(""); setNotice("");
  };
  const protectedAccess = editing?.id === actorId || editing?.role === "Owner / CX Director";
  const availableRoles = owner ? roles : roles.slice(0, 4);

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl font-semibold">Team members &amp; access</h1>
        <p className="mt-1 text-sm text-[#B4C2D0]">Manage real workspace accounts and see current staff presence.</p></div>
      <button type="button" className="btn btn-primary" disabled={loading || !!error || tab !== "roster"} onClick={() => {
        setInviting(true); setEditing(null); setName(""); setEmail(""); setRole("Tier 2 Escalation Agent"); setFormError(""); setNotice("");
      }}>Invite member</button>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Member views">
      <button type="button" aria-pressed={tab === "roster"} className="btn btn-secondary" onClick={() => setTab("roster")}>Accounts &amp; roles</button>
      <button type="button" aria-pressed={tab === "presence"} className="btn btn-secondary" onClick={() => setTab("presence")}>Live routing presence</button>
    </div>
    {notice && <p role="status" className="text-sm text-[#2ED8B6]">{notice}</p>}
    {error && <div role="alert" className="text-sm text-[#FF7373]">{error} <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>Retry</button></div>}
    {(editing || inviting) && <form className="rounded-xl border border-[var(--line)] bg-[#121A24] p-5 space-y-4 max-w-2xl" aria-label={inviting ? "Invite member" : "Edit member"} onSubmit={async e => {
      e.preventDefault(); if (saving) return; setSaving(true); setFormError("");
      try {
        const data = await api("/api/members", { method: inviting ? "POST" : "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inviting ? { name, email, role } : { memberId: editing!.id, updates: { name, role, status } }) });
        if (data.member) onUpdateMember?.(data.member);
        setNotice(inviting ? (data.invitationSent ? "Account created and invitation sent." : "Account created, but email delivery failed. Use Resend invitation below.") : "Member saved. Access changes end renewable sessions; existing access tokens expire within their configured lifetime.");
        setInviting(false); setEditing(null); await refresh();
      } catch (e) { setFormError(e instanceof Error ? e.message : "Unable to save. Please try again."); }
      finally { setSaving(false); }
    }}>
      <h2 className="text-lg font-semibold">{inviting ? "Invite a team member" : "Edit member account"}</h2>
      {formError && <p role="alert" className="text-sm text-[#FF7373]">{formError}</p>}
      <label className="block text-sm">Name<input autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm">Email<input type="email" required maxLength={254} readOnly={!inviting} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm">Role<select disabled={!!protectedAccess} value={role} onChange={e => setRole(e.target.value as TenantMember["role"])} className={inputClass}>
        {[...new Set([...availableRoles, ...(editing ? [editing.role] : [])])].map(r => <option key={r}>{r}</option>)}
      </select></label>
      {editing && <label className="block text-sm">Account status<select disabled={!!protectedAccess} value={status} onChange={e => setStatus(e.target.value as TenantMember["status"])} className={inputClass}>
        <option value="active">Active</option><option value="disabled">Disabled</option>{editing.status === "invited" && <option value="invited">Invitation pending</option>}
      </select></label>}
      <p className="text-sm text-[#B4C2D0]">Only owners can manage leadership roles. Your own access and existing owner accounts are protected. Invitations and account setup stay inside SupportV8.</p>
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} className="btn btn-secondary" onClick={() => { setEditing(null); setInviting(false); }}>Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : inviting ? "Send invitation" : "Save member"}</button></div>
    </form>}
    {loading && <p role="status" className="text-sm text-[#B4C2D0]">Loading {tab === "roster" ? "accounts" : "current presence"}…</p>}
    {!loading && !error && tab === "roster" && <>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full text-left text-sm"><caption className="sr-only">Workspace accounts and access roles</caption>
          <thead className="bg-[#121A24] text-[#B4C2D0]"><tr><th className="p-3">Member</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{members.map(member => <tr key={member.id} className="border-t border-[var(--line)]">
            <td className="p-3"><span className="block">{member.name}</span><span className="text-[#B4C2D0] break-all">{member.email}</span></td>
            <td className="p-3">{member.role}</td><td className="p-3">{member.status}</td>
            <td className="p-3"><button type="button" className="btn btn-secondary" disabled={!owner && ["Owner / CX Director", "CX Operations Lead"].includes(member.role)} onClick={() => startEdit(member)}>Edit member</button>
              {member.status === "invited" && <button type="button" disabled={saving} className="btn btn-secondary ml-2" onClick={async () => {
                setSaving(true); setError("");
                try { await api("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resend_invite", memberId: member.id }) }); setNotice("Invitation sent."); }
                catch (e) { setError(e instanceof Error ? e.message : "Email delivery failed."); }
                finally { setSaving(false); }
              }}>Resend invitation</button>}
            </td></tr>)}</tbody></table>
        {members.length === 0 && <p className="p-5 text-sm text-[#B4C2D0]">No members on this page.</p>}
      </div>
      <div className="flex gap-2"><button type="button" disabled={first === 0} className="btn btn-secondary" onClick={() => setFirst(Math.max(0, first - 50))}>Previous</button>
        <button type="button" disabled={!hasMore} className="btn btn-secondary" onClick={() => setFirst(first + 50)}>Next</button></div>
    </>}
    {!loading && !error && tab === "presence" && <div className="space-y-4">
      <p className="text-sm text-[#B4C2D0]">Staff appear while signed in and active in the workspace. Inactive connections expire after 90 seconds. AI employees appear only when hired for this tenant.</p>
      <h2 className="font-semibold">Online staff ({staff.length})</h2>
      {staff.length === 0 ? <p className="text-sm text-[#B4C2D0]">No staff currently online.</p> : <ul className="divide-y divide-[var(--line)]">{staff.map(person => <li key={person.id} className="py-3 flex flex-wrap justify-between gap-2"><span>{person.name} <span className="text-sm text-[#B4C2D0] break-all">{person.email}</span></span><span className="text-sm text-[#2ED8B6]">Online</span></li>)}</ul>}
      <h2 className="font-semibold">Hired AI employees ({employees.length})</h2>
      {employees.length === 0 ? <p className="text-sm text-[#B4C2D0]">No AI employees hired.</p> : <ul className="divide-y divide-[var(--line)]">{employees.map(employee => <li key={employee.id} className="py-3">{employee.name} <span className="text-sm text-[#B4C2D0]">{employee.role}</span></li>)}</ul>}
    </div>}
  </section>;
}
