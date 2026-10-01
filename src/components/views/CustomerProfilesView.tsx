"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Building,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from "@/components/ui/FlatIcon";
import { AuthService } from "@/lib/auth-service";
import type { CustomerProfile, CustomerSourceSystem, CustomerTier } from "@/lib/types";

export interface CompanySummary {
  name: string;
  customerCount: number;
  highestTier: CustomerTier;
  contacts: CustomerProfile[];
  domains: string[];
  lastActivity: string | null;
}

interface CustomerProfilesViewProps {
  onCreateTicketForCustomer?: (customer: CustomerProfile) => void;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

const TIER_COLORS: Record<CustomerTier, { bg: string; text: string; border: string }> = {
  standard: { bg: "bg-[#18222E]", text: "text-[#B4C2D0]", border: "border-[var(--line-2)]" },
  premium: { bg: "bg-[#7C5CFC]/15", text: "text-[#A78BFA]", border: "border-[#7C5CFC]/30" },
  enterprise: { bg: "bg-[#2ED8B6]/15", text: "text-[#2ED8B6]", border: "border-[#2ED8B6]/30" },
  vip: { bg: "bg-[#F5A623]/15", text: "text-[#F5A623]", border: "border-[#F5A623]/30" },
};

const SOURCE_COLORS: Record<CustomerSourceSystem, { bg: string; text: string; label: string }> = {
  local: { bg: "bg-[#1F2937]", text: "text-[#9CA3AF]", label: "Local Directory" },
  manual: { bg: "bg-[#1F2937]", text: "text-[#9CA3AF]", label: "Operator Manual" },
  stripe: { bg: "bg-[#635BFF]/15", text: "text-[#7A73FF]", label: "Stripe Billing" },
  zendesk: { bg: "bg-[#03363D]/40", text: "text-[#00A699]", label: "Zendesk Support" },
  intercom: { bg: "bg-[#0057FF]/15", text: "text-[#3B82F6]", label: "Intercom Lead" },
  orderv8: { bg: "bg-[#10B981]/15", text: "text-[#34D399]", label: "OrderV8 / Commerce" },
  shopify: { bg: "bg-[#95BF47]/15", text: "text-[#95BF47]", label: "Shopify Store" },
};

export function CustomerProfilesView({
  onCreateTicketForCustomer,
  onNotify,
}: CustomerProfilesViewProps) {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Subtab navigation: "customers" | "companies"
  const [activeSubTab, setActiveSubTab] = useState<"customers" | "companies">("customers");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  // Company Directory state
  const [companySearchQuery, setCompanySearchQuery] = useState<string>("");
  const [customCompanies, setCustomCompanies] = useState<string[]>([]);
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState<boolean>(false);
  const [companyFormName, setCompanyFormName] = useState<string>("");
  const [companyFormContactName, setCompanyFormContactName] = useState<string>("");
  const [companyFormEmail, setCompanyFormEmail] = useState<string>("");
  const [companyFormPhone, setCompanyFormPhone] = useState<string>("");
  const [companyFormTier, setCompanyFormTier] = useState<CustomerTier>("standard");
  const [companyFormSaving, setCompanyFormSaving] = useState<boolean>(false);
  const [companyFormError, setCompanyFormError] = useState<string | null>(null);

  // Sync menu state
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeSyncSource, setActiveSyncSource] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerProfile | null>(null);

  // Form state
  const [formName, setFormName] = useState<string>("");
  const [formCompany, setFormCompany] = useState<string>("");
  const [isCustomCompany, setIsCustomCompany] = useState<boolean>(false);
  const [formEmail, setFormEmail] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formTier, setFormTier] = useState<CustomerTier>("standard");
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Copy feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch customers
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AuthService.authenticatedFetch("/api/customers");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load customers");
      }
      setCustomers(data.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load customer profiles. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // Sync from target system
  const handleSync = async (sourceSystem: string) => {
    setSyncing(true);
    setActiveSyncSource(sourceSystem);
    setIsSyncMenuOpen(false);
    setNotice(null);
    try {
      const res = await AuthService.authenticatedFetch("/api/customers/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceSystem }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }
      const msg = `Synced ${data.data?.createdCount || 0} new and updated ${data.data?.updatedCount || 0} customer records from ${sourceSystem.toUpperCase()}.`;
      setNotice(msg);
      onNotify?.(msg, "success");
      await loadCustomers();
    } catch (err: unknown) {
      const errTxt = err instanceof Error ? err.message : "Sync failed. Please check connector health.";
      setError(errTxt);
      onNotify?.(errTxt, "error");
    } finally {
      setSyncing(false);
      setActiveSyncSource(null);
    }
  };

  const TIER_ORDER: Record<CustomerTier, number> = {
    vip: 4,
    enterprise: 3,
    premium: 2,
    standard: 1,
  };

  // Derive unique company summaries from customer profiles and custom companies
  const companySummaries = useMemo<CompanySummary[]>(() => {
    const map = new Map<string, CustomerProfile[]>();

    for (const c of customers) {
      const raw = (c.companyName || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(c);
    }

    for (const custom of customCompanies) {
      const raw = custom.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
    }

    const summaries: CompanySummary[] = [];

    for (const [key, contacts] of map.entries()) {
      const canonicalName =
        contacts[0]?.companyName?.trim() ||
        customCompanies.find((c) => c.trim().toLowerCase() === key)?.trim() ||
        key;

      let highestTier: CustomerTier = "standard";
      let highestRank = 1;
      const domainsSet = new Set<string>();
      let latestTimestamp = 0;

      for (const c of contacts) {
        const rank = TIER_ORDER[c.customerTier] || 1;
        if (rank > highestRank) {
          highestRank = rank;
          highestTier = c.customerTier;
        }
        if (c.email && c.email.includes("@")) {
          const domain = c.email.split("@")[1]?.trim().toLowerCase();
          if (domain) domainsSet.add(domain);
        }
        const actTime = new Date(c.lastSyncedAt || c.updatedAt).getTime();
        if (actTime > latestTimestamp) {
          latestTimestamp = actTime;
        }
      }

      summaries.push({
        name: canonicalName,
        customerCount: contacts.length,
        highestTier,
        contacts,
        domains: Array.from(domainsSet),
        lastActivity: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
      });
    }

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, customCompanies]);

  // Filtered companies for Companies subtab
  const filteredCompanies = useMemo(() => {
    if (!companySearchQuery.trim()) return companySummaries;
    const q = companySearchQuery.trim().toLowerCase();
    return companySummaries.filter((comp) => {
      if (comp.name.toLowerCase().includes(q)) return true;
      if (comp.domains.some((d) => d.toLowerCase().includes(q))) return true;
      if (comp.contacts.some((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [companySummaries, companySearchQuery]);

  // Open Add customer modal (optionally prefilled with company name)
  const openAddModal = (prefillCompany?: string) => {
    setFormName("");
    const targetComp = prefillCompany || "";
    setFormCompany(targetComp);
    setIsCustomCompany(
      Boolean(targetComp && !companySummaries.some((c) => c.name.toLowerCase() === targetComp.toLowerCase()))
    );
    setFormEmail("");
    setFormPhone("");
    setFormTier("standard");
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit customer modal
  const openEditModal = (c: CustomerProfile) => {
    setFormName(c.name);
    const comp = c.companyName || "";
    setFormCompany(comp);
    setIsCustomCompany(
      Boolean(comp && !companySummaries.some((cs) => cs.name.toLowerCase() === comp.toLowerCase()))
    );
    setFormEmail(c.email);
    setFormPhone(c.phone || "");
    setFormTier(c.customerTier);
    setFormError(null);
    setEditingCustomer(c);
  };

  // Open Add Company modal
  const openAddCompanyModal = () => {
    setCompanyFormName("");
    setCompanyFormContactName("");
    setCompanyFormEmail("");
    setCompanyFormPhone("");
    setCompanyFormTier("standard");
    setCompanyFormError(null);
    setIsAddCompanyModalOpen(true);
  };

  // Submit Add Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const compName = companyFormName.trim();
    if (!compName) {
      setCompanyFormError("Company name is required.");
      return;
    }

    if (companyFormEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyFormEmail.trim())) {
        setCompanyFormError("A valid email address is required.");
        return;
      }
      setCompanyFormSaving(true);
      setCompanyFormError(null);
      try {
        const contactName = companyFormContactName.trim() || `${compName} Primary`;
        const res = await AuthService.authenticatedFetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactName,
            companyName: compName,
            email: companyFormEmail.trim(),
            phone: companyFormPhone.trim(),
            customerTier: companyFormTier,
            sourceSystem: "local",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to create company contact");
        }
        if (!customCompanies.includes(compName)) {
          setCustomCompanies((prev) => [...prev, compName]);
        }
        setIsAddCompanyModalOpen(false);
        const msg = `Company ${compName} saved with initial contact.`;
        setNotice(msg);
        onNotify?.(msg, "success");
        await loadCustomers();
      } catch (err: unknown) {
        setCompanyFormError(err instanceof Error ? err.message : "Failed to create company");
      } finally {
        setCompanyFormSaving(false);
      }
    } else {
      if (!customCompanies.includes(compName)) {
        setCustomCompanies((prev) => [...prev, compName]);
      }
      setIsAddCompanyModalOpen(false);
      const msg = `Company ${compName} registered in directory.`;
      setNotice(msg);
      onNotify?.(msg, "success");
    }
  };

  // Submit Add Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Name and a valid email are required.");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const res = await AuthService.authenticatedFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          companyName: formCompany.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          customerTier: formTier,
          sourceSystem: "local",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create customer");
      }
      if (formCompany.trim()) {
        const comp = formCompany.trim();
        if (!customCompanies.includes(comp)) {
          setCustomCompanies((prev) => [...prev, comp]);
        }
      }
      setIsAddModalOpen(false);
      const msg = `Customer ${data.data.name} saved to local directory.`;
      setNotice(msg);
      onNotify?.(msg, "success");
      await loadCustomers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setFormSaving(false);
    }
  };

  // Submit Edit Customer
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!formName.trim() || !formEmail.trim()) {
      setFormError("Name and a valid email are required.");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const res = await AuthService.authenticatedFetch(`/api/customers/${editingCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          companyName: formCompany.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          customerTier: formTier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update customer");
      }
      if (formCompany.trim()) {
        const comp = formCompany.trim();
        if (!customCompanies.includes(comp)) {
          setCustomCompanies((prev) => [...prev, comp]);
        }
      }
      setEditingCustomer(null);
      const msg = `Customer ${data.data.name} biodata updated.`;
      setNotice(msg);
      onNotify?.(msg, "success");
      await loadCustomers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to update customer");
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    try {
      const res = await AuthService.authenticatedFetch(`/api/customers/${deletingCustomer.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete customer");
      }
      const msg = `Customer ${deletingCustomer.name} removed.`;
      setDeletingCustomer(null);
      setNotice(msg);
      onNotify?.(msg, "info");
      await loadCustomers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete customer");
    }
  };

  // Copy text helper
  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (selectedTier !== "all" && c.customerTier !== selectedTier) return false;
      if (selectedSource !== "all") {
        if (selectedSource === "local" && c.sourceSystem !== "local" && c.sourceSystem !== "manual") return false;
        if (selectedSource !== "local" && c.sourceSystem !== selectedSource) return false;
      }
      if (selectedCompany !== "all" && (c.companyName || "").trim().toLowerCase() !== selectedCompany.trim().toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          c.name.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [customers, selectedTier, selectedSource, selectedCompany, searchQuery]);

  // Customer Metrics
  const metrics = useMemo(() => {
    const total = customers.length;
    const vipOrEnterprise = customers.filter(
      (c) => c.customerTier === "vip" || c.customerTier === "enterprise"
    ).length;
    const syncedSystems = new Set(
      customers.map((c) => c.sourceSystem).filter((s) => s !== "local" && s !== "manual")
    ).size;
    const latestSync = customers
      .filter((c) => c.lastSyncedAt)
      .map((c) => new Date(c.lastSyncedAt!).getTime())
      .sort((a, b) => b - a)[0];

    return {
      total,
      vipOrEnterprise,
      syncedSystems: Math.max(syncedSystems, 4), // Connected target gateways
      latestSync: latestSync ? new Date(latestSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never",
    };
  }, [customers]);

  // Company Metrics
  const companyMetrics = useMemo(() => {
    const totalCompanies = companySummaries.length;
    const associatedContacts = customers.filter((c) => c.companyName?.trim()).length;
    const priorityAccounts = companySummaries.filter(
      (c) => c.highestTier === "enterprise" || c.highestTier === "vip"
    ).length;
    const verifiedDomains = new Set(companySummaries.flatMap((c) => c.domains)).size;
    return {
      totalCompanies,
      associatedContacts,
      priorityAccounts,
      verifiedDomains,
    };
  }, [companySummaries, customers]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HEADER SECTION */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/30 text-[#2ED8B6]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#EAF1F8]">Customer Directory<span className="sr-only"> &amp; Biodata</span></h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Sync Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              disabled={syncing}
              onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
              className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-2 text-xs font-mono flex items-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2ED8B6] ${syncing ? "animate-spin" : ""}`} />
              <span>
                {syncing ? (
                  `Syncing ${activeSyncSource || "..."}…`
                ) : (
                  <>
                    <span className="sr-only">Sync from Target Systems</span>
                    <span aria-hidden="true">Sync Systems</span>
                  </>
                )}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E9AA8]" />
            </button>

            {isSyncMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-[#101722] border border-[var(--line-2)] rounded-2xl shadow-2xl py-2 z-50 text-xs font-mono animate-in zoom-in-95 duration-100"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#8E9AA8] uppercase tracking-wider border-b border-[var(--line)]">
                  Connected Target Systems
                </div>
                <button
                  type="button"
                  onClick={() => handleSync("all")}
                  className="w-full text-left px-3 py-2 text-[#2ED8B6] hover:bg-[#18222E] flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold">Sync All Systems</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2ED8B6]/20">Full Pool</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSync("stripe")}
                  className="w-full text-left px-3 py-2 text-[#EAF1F8] hover:bg-[#18222E] flex items-center justify-between cursor-pointer"
                >
                  <span>Stripe Billing &amp; Subscriptions</span>
                  <span className="text-[10px] text-[#7A73FF]">Stripe</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSync("zendesk")}
                  className="w-full text-left px-3 py-2 text-[#EAF1F8] hover:bg-[#18222E] flex items-center justify-between cursor-pointer"
                >
                  <span>Zendesk Enterprise Requesters</span>
                  <span className="text-[10px] text-[#00A699]">Zendesk</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSync("intercom")}
                  className="w-full text-left px-3 py-2 text-[#EAF1F8] hover:bg-[#18222E] flex items-center justify-between cursor-pointer"
                >
                  <span>Intercom Visitor &amp; Lead Contacts</span>
                  <span className="text-[10px] text-[#3B82F6]">Intercom</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSync("orderv8")}
                  className="w-full text-left px-3 py-2 text-[#EAF1F8] hover:bg-[#18222E] flex items-center justify-between cursor-pointer"
                >
                  <span>OrderV8 / Shopify Store Buyers</span>
                  <span className="text-[10px] text-[#34D399]">Commerce</span>
                </button>
              </div>
            )}
          </div>

          {/* Subtab Aware Primary Action */}
          {activeSubTab === "customers" ? (
            <button
              type="button"
              onClick={() => openAddModal()}
              className="btn btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openAddCompanyModal}
              className="btn btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Company</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB NAVIGATION */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveSubTab("customers")}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "customers"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm"
              : "text-[#8E9AA8] hover:text-[#EAF1F8] hover:bg-[#141C26] border border-transparent"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#18222E] text-[10px] text-[#8E9AA8]">
            {customers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("companies")}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "companies"
              ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm"
              : "text-[#8E9AA8] hover:text-[#EAF1F8] hover:bg-[#141C26] border border-transparent"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Companies</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#18222E] text-[10px] text-[#8E9AA8]">
            {companySummaries.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* METRIC KPI TILES */}
      {/* ========================================================================= */}
      {activeSubTab === "customers" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Total Customer Profiles</div>
            <div className="text-2xl font-bold text-[#EAF1F8]">{metrics.total}</div>
            <div className="text-[10px] text-[#2ED8B6] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Active in local tenant store</span>
            </div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Enterprise &amp; VIP Accounts</div>
            <div className="text-2xl font-bold text-[#F5A623]">{metrics.vipOrEnterprise}</div>
            <div className="text-[10px] text-[#B4C2D0]">SLA Priority Escorts Enabled</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Connected Source Systems</div>
            <div className="text-2xl font-bold text-[#4D9FFF]">{metrics.syncedSystems}</div>
            <div className="text-[10px] text-[#8E9AA8]">Stripe • Zendesk • Intercom • OrderV8</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Last Gateway Sync</div>
            <div className="text-2xl font-bold text-[#EAF1F8]">{metrics.latestSync}</div>
            <div className="text-[10px] text-[#2ED8B6]">Automated deduplication active</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Total Companies</div>
            <div className="text-2xl font-bold text-[#EAF1F8]">{companyMetrics.totalCompanies}</div>
            <div className="text-[10px] text-[#2ED8B6] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Registered accounts</span>
            </div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Associated Contacts</div>
            <div className="text-2xl font-bold text-[#4D9FFF]">{companyMetrics.associatedContacts}</div>
            <div className="text-[10px] text-[#B4C2D0]">Affiliated profiles</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Priority Accounts</div>
            <div className="text-2xl font-bold text-[#F5A623]">{companyMetrics.priorityAccounts}</div>
            <div className="text-[10px] text-[#8E9AA8]">Enterprise &amp; VIP tiers</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--line)] bg-[#0E1520] space-y-1">
            <div className="text-[11px] font-mono text-[#8E9AA8]">Active Domains</div>
            <div className="text-2xl font-bold text-[#2ED8B6]">{companyMetrics.verifiedDomains}</div>
            <div className="text-[10px] text-[#2ED8B6]">Corporate email domains</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NOTICES & ALERTS */}
      {/* ========================================================================= */}
      {notice && (
        <div
          role="status"
          className="p-3.5 rounded-xl border border-[#2ED8B6]/30 bg-[#2ED8B6]/10 text-xs font-mono text-[#2ED8B6] flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[#FF7373]/30 bg-[#FF7373]/10 text-xs font-mono text-[#FF7373] flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="btn btn-secondary px-2.5 py-1 text-[11px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB CONTENT: CUSTOMERS OR COMPANIES */}
      {/* ========================================================================= */}
      {activeSubTab === "customers" ? (
        <>
          {/* ========================================================================= */}
          {/* CONTROLS & FILTER BAR */}
          {/* ========================================================================= */}
          <div className="card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="relative flex-1 min-w-[260px] sm:min-w-[320px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, company, email, or phone..."
                className="w-full bg-[#141C26] text-[#EAF1F8] pl-9 pr-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5 text-[#8E9AA8]">
                <span>Company:</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="bg-[#141C26] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer max-w-[170px] truncate"
                >
                  <option value="all">All Companies</option>
                  {companySummaries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.customerCount})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-[#8E9AA8]">
                <span>Tier:</span>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="bg-[#141C26] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Tiers</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="vip">VIP</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-[#8E9AA8]">
                <span>Source:</span>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="bg-[#141C26] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="local">Local Directory</option>
                  <option value="stripe">Stripe</option>
                  <option value="zendesk">Zendesk</option>
                  <option value="intercom">Intercom</option>
                  <option value="orderv8">OrderV8</option>
                  <option value="shopify">Shopify</option>
                </select>
              </label>

              {selectedCompany !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedCompany("all")}
                  className="px-2 py-1 rounded-lg bg-[#2ED8B6]/15 border border-[#2ED8B6]/30 text-[#2ED8B6] hover:bg-[#2ED8B6]/25 text-[11px] flex items-center gap-1 cursor-pointer"
                  title="Clear company filter"
                >
                  <span>{selectedCompany}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                onClick={() => void loadCustomers()}
                title="Refresh customer list"
                className="p-2 rounded-xl border border-[var(--line-2)] bg-[#141C26] hover:bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

      {/* ========================================================================= */}
      {/* CUSTOMER DIRECTORY DATA TABLE */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[#0E1520] shadow-sm">
        <table className="w-full text-left text-xs font-mono">
          <caption className="sr-only">Directory of workspace customer profiles</caption>
          <thead className="bg-[#121A24] text-[#8E9AA8] border-b border-[var(--line)]">
            <tr>
              <th scope="col" className="py-3 px-4">Customer &amp; Company</th>
              <th scope="col" className="py-3 px-4">Email</th>
              <th scope="col" className="py-3 px-4">Phone</th>
              <th scope="col" className="py-3 px-4">Tier</th>
              <th scope="col" className="py-3 px-4">Source System</th>
              <th scope="col" className="py-3 px-4">Last Sync / Activity</th>
              <th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--line)]">
            {loading && customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#8E9AA8]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#2ED8B6] mb-2" />
                  <span>Loading customer directory…</span>
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <Users className="w-10 h-10 text-[#6B7C8D] mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-[#EAF1F8]">No Customers</h3>
                  <p className="text-xs text-[#8E9AA8] mt-1 max-w-sm mx-auto">
                    {searchQuery || selectedTier !== "all" || selectedSource !== "all"
                      ? "No records match current filters."
                      : "Directory is empty. Add a customer or sync systems."}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => openAddModal()}
                      className="btn btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                      + Add Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSync("all")}
                      className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                    >
                      Sync from Target Systems
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => {
                const tierStyle = TIER_COLORS[c.customerTier] || TIER_COLORS.standard;
                const sourceStyle = SOURCE_COLORS[c.sourceSystem] || SOURCE_COLORS.local;
                const initials = c.name
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "CU";

                return (
                  <tr key={c.id} className="hover:bg-[#141C26]/60 transition-colors">
                    {/* Customer & Company */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2ED8B6]/20 to-[#4D9FFF]/20 border border-[var(--line-2)] flex items-center justify-center text-[#2ED8B6] font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-[#EAF1F8]">{c.name}</div>
                          {c.companyName ? (
                            <div className="flex items-center gap-1 text-[11px] text-[#8E9AA8]">
                              <Building className="w-3 h-3 text-[#6B7C8D]" />
                              <span>{c.companyName}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#6B7C8D] italic">Individual Account</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-[#6B7C8D] shrink-0" />
                        <a
                          href={`mailto:${c.email}`}
                          className="text-[#4D9FFF] hover:underline truncate max-w-[200px]"
                          title={c.email}
                        >
                          {c.email}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(c.email, `email_${c.id}`)}
                          className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                          title="Copy email address"
                        >
                          {copiedField === `email_${c.id}` ? (
                            <Check className="w-3 h-3 text-[#2ED8B6]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4">
                      {c.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-[#6B7C8D] shrink-0" />
                          <a href={`tel:${c.phone}`} className="text-[#EAF1F8] hover:text-[#2ED8B6]">
                            {c.phone}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.phone, `phone_${c.id}`)}
                            className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                            title="Copy phone number"
                          >
                            {copiedField === `phone_${c.id}` ? (
                              <Check className="w-3 h-3 text-[#2ED8B6]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#6B7C8D] italic">—</span>
                      )}
                    </td>

                    {/* Tier */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
                      >
                        {c.customerTier.toUpperCase()}
                      </span>
                    </td>

                    {/* Source System */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] ${sourceStyle.bg} ${sourceStyle.text}`}
                      >
                        {sourceStyle.label}
                      </span>
                    </td>

                    {/* Last Sync / Activity */}
                    <td className="py-3 px-4 text-[#8E9AA8] text-[11px]">
                      {c.lastSyncedAt
                        ? new Date(c.lastSyncedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : new Date(c.updatedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onCreateTicketForCustomer && (
                          <button
                            type="button"
                            onClick={() => onCreateTicketForCustomer(c)}
                            className="px-2.5 py-1 rounded-lg bg-[#2ED8B6]/15 hover:bg-[#2ED8B6]/25 border border-[#2ED8B6]/30 text-[#2ED8B6] font-bold text-[11px] cursor-pointer flex items-center gap-1"
                            title="Open ticket intake pre-filled with this customer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Ticket</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#8E9AA8] hover:text-[#EAF1F8] cursor-pointer"
                          title="Edit customer biodata"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingCustomer(c)}
                          className="p-1.5 rounded-lg bg-[#18222E] hover:bg-[#FF7373]/15 border border-[var(--line-2)] text-[#8E9AA8] hover:text-[#FF7373] cursor-pointer"
                          title="Delete customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  ) : (
    /* ========================================================================= */
    /* COMPANIES SUBTAB VIEW */
    /* ========================================================================= */
    <>
      {/* CONTROLS & SEARCH BAR FOR COMPANIES */}
      <div className="card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="relative flex-1 min-w-[260px] sm:min-w-[320px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C8D]" />
          <input
            type="text"
            value={companySearchQuery}
            onChange={(e) => setCompanySearchQuery(e.target.value)}
            placeholder="Search by company name, contact, or domain..."
            className="w-full bg-[#141C26] text-[#EAF1F8] pl-9 pr-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openAddCompanyModal}
            className="btn btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Company</span>
          </button>

          <button
            type="button"
            onClick={() => void loadCustomers()}
            title="Refresh company list"
            className="p-2 rounded-xl border border-[var(--line-2)] bg-[#141C26] hover:bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* COMPANIES DATA TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[#0E1520] shadow-sm">
        <table className="w-full text-left text-xs font-mono">
          <caption className="sr-only">Directory of workspace companies</caption>
          <thead className="bg-[#121A24] text-[#8E9AA8] border-b border-[var(--line)]">
            <tr>
              <th scope="col" className="py-3 px-4">Company</th>
              <th scope="col" className="py-3 px-4">Contacts</th>
              <th scope="col" className="py-3 px-4">Tier</th>
              <th scope="col" className="py-3 px-4">Domain</th>
              <th scope="col" className="py-3 px-4">Activity</th>
              <th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading && customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#8E9AA8]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#2ED8B6] mb-2" />
                  <span>Loading company directory…</span>
                </td>
              </tr>
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <Building className="w-10 h-10 text-[#6B7C8D] mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-[#EAF1F8]">No Companies</h3>
                  <p className="text-xs text-[#8E9AA8] mt-1 max-w-sm mx-auto">
                    {companySearchQuery
                      ? "No companies match current search query."
                      : "No company accounts registered yet. Add a company to get started."}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={openAddCompanyModal}
                      className="btn btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                      + Add Company
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCompanies.map((comp) => {
                const tierStyle = TIER_COLORS[comp.highestTier] || TIER_COLORS.standard;
                return (
                  <tr key={comp.name} className="hover:bg-[#121A24]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#141C26] border border-[var(--line-2)] flex items-center justify-center text-[#2ED8B6] font-bold shrink-0">
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-[#EAF1F8]">{comp.name}</div>
                          <div className="text-[10px] text-[#8E9AA8]">
                            {comp.customerCount === 1 ? "1 affiliated contact" : `${comp.customerCount} affiliated contacts`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line-2)] text-[#B4C2D0] font-bold text-[11px]">
                          {comp.customerCount} {comp.customerCount === 1 ? "Contact" : "Contacts"}
                        </span>
                        {comp.contacts.length > 0 && (
                          <div className="text-[10px] text-[#8E9AA8] truncate max-w-[200px]">
                            {comp.contacts.map((c) => c.name).slice(0, 2).join(", ")}
                            {comp.contacts.length > 2 && ` +${comp.contacts.length - 2}`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
                      >
                        {comp.highestTier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#B4C2D0]">
                      {comp.domains.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {comp.domains.slice(0, 2).map((d) => (
                            <span
                              key={d}
                              className="px-1.5 py-0.5 rounded bg-[#141C26] border border-[var(--line-2)] text-[10px] text-[#2ED8B6]"
                            >
                              @{d}
                            </span>
                          ))}
                          {comp.domains.length > 2 && (
                            <span className="text-[10px] text-[#8E9AA8]">+{comp.domains.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#6B7C8D]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#8E9AA8] text-[11px]">
                      {comp.lastActivity ? (
                        new Date(comp.lastActivity).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      ) : (
                        <span className="text-[#6B7C8D]">Never</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompany(comp.name);
                            setActiveSubTab("customers");
                          }}
                          title={`View contacts for ${comp.name}`}
                          className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#2ED8B6] px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Users className="w-3 h-3" />
                          <span>View Contacts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAddModal(comp.name)}
                          title={`Add new contact for ${comp.name}`}
                          className="btn bg-[#141C26] hover:bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Contact</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOMER */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-customer-modal-title"
            className="w-full max-w-md bg-[#0E1520] border border-[var(--line-2)] rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2ED8B6]" />
                <h3 id="add-customer-modal-title" className="text-sm font-bold text-[#EAF1F8]">
                  Add Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs font-mono">
              {formError && <p role="alert" className="text-[#FF7373]">{formError}</p>}

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Customer Full Name *</span>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Robert Caldwell"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </label>

              <div className="space-y-1 text-[#B4C2D0]">
                <div className="flex items-center justify-between">
                  <span>Company</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCompany(!isCustomCompany);
                      if (!isCustomCompany) {
                        setFormCompany("");
                      }
                    }}
                    className="text-[11px] text-[#2ED8B6] hover:underline cursor-pointer"
                  >
                    {isCustomCompany ? "Select Existing" : "+ New Company"}
                  </button>
                </div>
                {!isCustomCompany ? (
                  <select
                    value={formCompany}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCustomCompany(true);
                        setFormCompany("");
                      } else {
                        setFormCompany(e.target.value);
                      }
                    }}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  >
                    <option value="">Select Company (Optional)</option>
                    {companySummaries.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__NEW__">+ Add New Company…</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={255}
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Apex Global Logistics"
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    autoFocus
                  />
                )}
              </div>

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Email Address *</span>
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. robert@apexlogistics.com"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </label>

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Phone Number</span>
                <input
                  type="tel"
                  maxLength={64}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 234-8901"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </label>

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Customer Tier</span>
                <select
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as CustomerTier)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="vip">VIP</option>
                </select>
              </label>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  disabled={formSaving}
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="btn btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  {formSaving ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT CUSTOMER */}
      {/* ========================================================================= */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-customer-modal-title"
            className="w-full max-w-md bg-[#0E1520] border border-[var(--line-2)] rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#2ED8B6]" />
                <h3 id="edit-customer-modal-title" className="text-sm font-bold text-[#EAF1F8]">
                  Edit Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3.5 text-xs font-mono">
              {formError && <p role="alert" className="text-[#FF7373]">{formError}</p>}

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Customer Full Name *</span>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </label>

              <div className="space-y-1 text-[#B4C2D0]">
                <div className="flex items-center justify-between">
                  <span>Company</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCompany(!isCustomCompany);
                      if (!isCustomCompany) {
                        setFormCompany("");
                      }
                    }}
                    className="text-[11px] text-[#2ED8B6] hover:underline cursor-pointer"
                  >
                    {isCustomCompany ? "Select Existing" : "+ New Company"}
                  </button>
                </div>
                {!isCustomCompany ? (
                  <select
                    value={formCompany}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCustomCompany(true);
                        setFormCompany("");
                      } else {
                        setFormCompany(e.target.value);
                      }
                    }}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  >
                    <option value="">Select Company (Optional)</option>
                    {companySummaries.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__NEW__">+ Add New Company…</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={255}
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Apex Global Logistics"
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    autoFocus
                  />
                )}
              </div>

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Email Address *</span>
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </label>

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Phone Number</span>
                <input
                  type="tel"
                  maxLength={64}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </label>

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Customer Tier</span>
                <select
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as CustomerTier)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="vip">VIP</option>
                </select>
              </label>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  disabled={formSaving}
                  onClick={() => setEditingCustomer(null)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="btn btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  {formSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COMPANY */}
      {/* ========================================================================= */}
      {isAddCompanyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-company-modal-title"
            className="w-full max-w-md bg-[#0E1520] border border-[var(--line-2)] rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#2ED8B6]" />
                <h3 id="add-company-modal-title" className="text-sm font-bold text-[#EAF1F8]">
                  Add Company
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCompanyModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3.5 text-xs font-mono">
              {companyFormError && <p role="alert" className="text-[#FF7373]">{companyFormError}</p>}

              <label className="block space-y-1 text-[#B4C2D0]">
                <span>Company Name *</span>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={companyFormName}
                  onChange={(e) => setCompanyFormName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  autoFocus
                />
              </label>

              <div className="pt-2 border-t border-[var(--line)]">
                <div className="text-[11px] font-bold text-[#8E9AA8] uppercase tracking-wider mb-2">
                  Primary Contact (Optional)
                </div>

                <label className="block space-y-1 text-[#B4C2D0] mb-2.5">
                  <span>Contact Name</span>
                  <input
                    type="text"
                    maxLength={255}
                    value={companyFormContactName}
                    onChange={(e) => setCompanyFormContactName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </label>

                <label className="block space-y-1 text-[#B4C2D0] mb-2.5">
                  <span>Email</span>
                  <input
                    type="email"
                    maxLength={254}
                    value={companyFormEmail}
                    onChange={(e) => setCompanyFormEmail(e.target.value)}
                    placeholder="e.g. contact@acme.com"
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </label>

                <label className="block space-y-1 text-[#B4C2D0] mb-2.5">
                  <span>Phone</span>
                  <input
                    type="tel"
                    maxLength={64}
                    value={companyFormPhone}
                    onChange={(e) => setCompanyFormPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 019-2831"
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </label>

                <label className="block space-y-1 text-[#B4C2D0]">
                  <span>Tier</span>
                  <select
                    value={companyFormTier}
                    onChange={(e) => setCompanyFormTier(e.target.value as CustomerTier)}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="vip">VIP</option>
                  </select>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  disabled={companyFormSaving}
                  onClick={() => setIsAddCompanyModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={companyFormSaving}
                  className="btn btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  {companyFormSaving ? "Saving…" : "Save Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-customer-modal-title"
            className="w-full max-w-sm bg-[#0E1520] border border-[var(--line-2)] rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-2 text-[#FF7373]">
              <Trash2 className="w-5 h-5" />
              <h3 id="delete-customer-modal-title" className="text-sm font-bold">
                Delete Customer
              </h3>
            </div>
            <p className="text-xs text-[#B4C2D0] leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-[#EAF1F8]">{deletingCustomer.name}</span> ({deletingCustomer.email}) from the customer directory? Historical ticket records will retain customer reference.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                className="btn bg-[#FF7373] hover:bg-[#FF5555] text-black font-bold px-4 py-2 text-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
