"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  Plug,
  ExternalLink,
  Settings,
  Shield,
  Zap,
  Activity,
  ArrowRight,
  RefreshCw,
  Plus,
  Lock,
  Layers,
  Terminal,
  Server,
  Globe,
  Radio,
} from "lucide-react";
import type { MarketplaceConnector } from "@/lib/types/marketplace-types";

interface MarketplaceConnectorsViewProps {
  connectors: MarketplaceConnector[];
  verticals?: any[];
  onToggleConnector: (id: string, isSubscribed: boolean) => void;
  onOpenConfig: (connector: MarketplaceConnector) => void;
  onNotify?: (text: string, type: "success" | "error" | "info") => void;
}

export function MarketplaceConnectorsView({
  connectors,
  verticals = [],
  onToggleConnector,
  onOpenConfig,
  onNotify,
}: MarketplaceConnectorsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"connectors" | "verticals" | "dispatcher">("connectors");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedConnectorConfig, setSelectedConnectorConfig] = useState<MarketplaceConnector | null>(null);

  // Interactive Vertical Dispatcher States
  const [selectedVertical, setSelectedVertical] = useState<string>("orderv8");
  const [selectedVerticalOp, setSelectedVerticalOp] = useState<string>("order.lookup");
  const [verticalPayloadText, setVerticalPayloadText] = useState<string>('{\n  "orderId": "ORD-99412",\n  "customerId": "CUST-8821"\n}');
  const [verticalDispatchLoading, setVerticalDispatchLoading] = useState<boolean>(false);
  const [verticalDispatchResult, setVerticalDispatchResult] = useState<any | null>(null);

  const defaultVerticals = [
    { vertical: "orderv8", name: "OrderV8 (Commerce & Refunds)", endpointUrl: "http://orderv8.servicev8.internal:3000", latencyMs: 38, supportedOperations: ["order.lookup", "order.refund", "invoice.generate"] },
    { vertical: "carev8", name: "CareV8 (Healthcare & Patients)", endpointUrl: "http://carev8.servicev8.internal:3000", latencyMs: 44, supportedOperations: ["patient.lookup", "appointment.list", "chart.summary"] },
    { vertical: "propv8", name: "PropV8 (Property & Facilities)", endpointUrl: "http://propv8.servicev8.internal:3000", latencyMs: 52, supportedOperations: ["maintenance.create", "lease.lookup", "unit.inspect"] },
    { vertical: "growthv8", name: "GrowthV8 (CRM & VIP Retention)", endpointUrl: "http://growthv8.servicev8.internal:3000", latencyMs: 29, supportedOperations: ["lead.lookup", "retention.campaign.trigger", "voice.provision"] },
    { vertical: "dominion", name: "Dominion AIOps (Autonomous SRE)", endpointUrl: "http://dominion.servicev8.internal:3000", latencyMs: 24, supportedOperations: ["incident.lookup", "circuit_breaker.status", "traffic.reroute"] },
    { vertical: "workerv8", name: "WorkerV8 (Field Dispatches)", endpointUrl: "http://workerv8.servicev8.internal:3000", latencyMs: 49, supportedOperations: ["dispatch.lookup", "technician.eta", "work_order.update"] },
  ];

  const activeVerticals = verticals.length > 0 ? verticals : defaultVerticals;

  const filtered = connectors.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = [
    { id: "all", label: "All Integrations" },
    { id: "helpdesk", label: "Helpdesks & Chat" },
    { id: "telephony", label: "Voice & SIP" },
    { id: "knowledge", label: "Knowledge & RAG" },
    { id: "commerce", label: "Commerce & Orders" },
    { id: "crm", label: "CRM & VIP" },
    { id: "devops", label: "DevOps & SRE" },
    { id: "storage", label: "Document Storage" },
  ];

  const handleDispatchVerticalOp = async () => {
    setVerticalDispatchLoading(true);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(verticalPayloadText);
      } catch {
        if (onNotify) onNotify("Invalid JSON payload syntax", "error");
        return;
      }

      const res = await fetch("/api/verticals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical: selectedVertical,
          operation: selectedVerticalOp,
          payload: parsedPayload,
        }),
      }).then((r) => r.json());

      if (res.success) {
        if (onNotify) onNotify(res.message || `Dispatched ${selectedVerticalOp} successfully!`, "success");
        setVerticalDispatchResult(res.data);
      } else {
        if (onNotify) onNotify(res.error || "Dispatch failed", "error");
      }
    } catch (err) {
      if (onNotify) onNotify("Vertical API dispatch failed", "error");
    } finally {
      setVerticalDispatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-View Switcher */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
              <Plug className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Connectors &amp; Vertical Mesh Hub</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Unified integration plane: Subscribe to omnichannel ingress connectors, monitor cross-vertical service mesh apps, and test live microservice dispatches.
          </p>
        </div>

        {/* Sub-View Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#18222E] border border-[var(--line)] font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab("connectors")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "connectors"
                ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                : "text-[#6B7C8D] hover:text-[#EAF1F8]"
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            <span>Connectors ({connectors.filter((c) => c.isSubscribed).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("verticals")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "verticals"
                ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                : "text-[#6B7C8D] hover:text-[#EAF1F8]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vertical Mesh ({activeVerticals.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("dispatcher")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "dispatcher"
                ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                : "text-[#6B7C8D] hover:text-[#EAF1F8]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Dispatcher</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: OMNICHANNEL INGRESS CONNECTORS */}
      {/* ========================================================================= */}
      {activeSubTab === "connectors" && (
        <div className="space-y-5">
          {/* Filter and Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    categoryFilter === cat.id
                      ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-bold"
                      : "bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] border border-[var(--line)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search connectors..."
                className="w-full bg-[#18222E] text-[#EAF1F8] pl-8 pr-3 py-2 rounded-xl border border-[var(--line)] text-xs focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>
          </div>

          {/* Connectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((conn) => {
              const isSub = conn.isSubscribed;
              return (
                <div
                  key={conn.id}
                  className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isSub
                      ? "bg-[#121A24] border-[#2ED8B6]/40 shadow-sm"
                      : "bg-[#0E1520] border-[var(--line)] opacity-90 hover:opacity-100"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-center text-lg text-[#2ED8B6]">
                          <i className={conn.icon} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-[#EAF1F8]">{conn.name}</h3>
                          <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">
                            {conn.category} • {conn.tier}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`pill text-[9px] font-mono ${
                          isSub ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                        }`}
                      >
                        {isSub ? "ACTIVE" : "AVAILABLE"}
                      </span>
                    </div>

                    <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-2">
                      {conn.description}
                    </p>

                    {isSub && (
                      <div className="p-2.5 rounded-lg bg-[#18222E] border border-[var(--line)] grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div>
                          <span className="text-[#6B7C8D] block">Sync Interval:</span>
                          <span className="text-[#EAF1F8] font-bold">Every {conn.syncFrequencyMinutes} min</span>
                        </div>
                        <div>
                          <span className="text-[#6B7C8D] block">Events Today:</span>
                          <span className="text-[#2ED8B6] font-bold">{conn.eventsPerDay.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConnectorConfig(conn);
                        onOpenConfig(conn);
                      }}
                      className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleConnector(conn.id, !isSub)}
                      className={`btn text-xs py-1.5 px-4 font-bold flex items-center gap-1.5 cursor-pointer ${
                        isSub
                          ? "btn-secondary text-[#E5484D] hover:bg-[#E5484D]/15"
                          : "btn-primary shadow-sm"
                      }`}
                    >
                      {isSub ? (
                        <span>Disable</span>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          <span>Subscribe</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: SERVICEV8 VERTICAL APPS MESH */}
      {/* ========================================================================= */}
      {activeSubTab === "verticals" && (
        <div className="space-y-4">
          <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8] font-mono uppercase">
                  ServiceV8 Cross-Vertical Apps Mesh Topology
                </h3>
                <p className="text-xs text-[#B4C2D0] mt-0.5">
                  Real-time microservice communication mesh enabling automated order lookups, refunds, dispatches, tenant synchronization, and circuit-breaker telemetry.
                </p>
              </div>
              <span className="pill ok text-xs font-mono">
                <i className="dot"></i>
                {activeVerticals.length} Services Healthy
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeVerticals.map((vert: any) => (
                <div key={vert.vertical} className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6]/40 transition-all space-y-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-[#EAF1F8]">{vert.name}</h4>
                      <span className="font-mono text-[10px] text-[#6B7C8D] block mt-0.5">{vert.endpointUrl}</span>
                    </div>
                    <span className="pill ok text-[9px] font-mono">
                      {vert.latencyMs || 32}ms
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9.5px] font-mono text-[#6B7C8D] uppercase font-bold">Supported Operations:</span>
                    <div className="flex flex-wrap gap-1">
                      {(vert.supportedOperations || []).map((op: string) => (
                        <span key={op} className="px-2 py-0.5 rounded-md bg-[#121A24] border border-[var(--line)] text-[#2ED8B6] text-[9.5px] font-mono">
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                    <span>Status: <strong className="text-[#2ED8B6]">ONLINE</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVertical(vert.vertical);
                        if (vert.supportedOperations && vert.supportedOperations[0]) {
                          setSelectedVerticalOp(vert.supportedOperations[0]);
                        }
                        setActiveSubTab("dispatcher");
                      }}
                      className="text-[#4D9FFF] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Dispatch Test</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: INTERACTIVE VERTICAL API DISPATCHER */}
      {/* ========================================================================= */}
      {activeSubTab === "dispatcher" && (
        <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--line)]">
            <Terminal className="w-5 h-5 text-[#2ED8B6]" />
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Interactive Cross-Vertical API Dispatcher</h3>
              <p className="text-xs text-[#B4C2D0]">
                Directly execute authenticated interservice operations across the ServiceV8 mesh (OrderV8, CareV8, PropV8, GrowthV8, Dominion, WorkerV8).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Target Vertical Service</label>
                <select
                  value={selectedVertical}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedVertical(v);
                    if (v === "orderv8") {
                      setSelectedVerticalOp("order.lookup");
                      setVerticalPayloadText('{\n  "orderId": "ORD-99412",\n  "customerId": "CUST-8821"\n}');
                    } else if (v === "carev8") {
                      setSelectedVerticalOp("appointment.list");
                      setVerticalPayloadText('{\n  "patientId": "PAT-3011"\n}');
                    } else if (v === "propv8") {
                      setSelectedVerticalOp("maintenance.create");
                      setVerticalPayloadText('{\n  "propertyId": "PROP-A102",\n  "issue": "HVAC cooling failure"\n}');
                    } else if (v === "growthv8") {
                      setSelectedVerticalOp("retention.campaign.trigger");
                      setVerticalPayloadText('{\n  "customerId": "CUST-8821"\n}');
                    } else if (v === "dominion") {
                      setSelectedVerticalOp("incident.lookup");
                      setVerticalPayloadText('{\n  "service": "checkout-worker"\n}');
                    } else if (v === "workerv8") {
                      setSelectedVerticalOp("dispatch.lookup");
                      setVerticalPayloadText('{\n  "dispatchId": "DSP-7721"\n}');
                    }
                  }}
                  className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="orderv8">OrderV8 (Commerce, Orders &amp; Refunds)</option>
                  <option value="carev8">CareV8 (Healthcare, Patients &amp; Charts)</option>
                  <option value="propv8">PropV8 (Property &amp; Facilities)</option>
                  <option value="growthv8">GrowthV8 (CRM, Voice &amp; VIP Retention)</option>
                  <option value="dominion">Dominion (Autonomous AIOps &amp; SRE)</option>
                  <option value="workerv8">WorkerV8 (Field Dispatches &amp; ETAs)</option>
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Operation Action</label>
                <input
                  type="text"
                  value={selectedVerticalOp}
                  onChange={(e) => setSelectedVerticalOp(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Payload (JSON)</label>
                <textarea
                  rows={6}
                  value={verticalPayloadText}
                  onChange={(e) => setVerticalPayloadText(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] font-mono text-[11px] leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <button
                type="button"
                onClick={handleDispatchVerticalOp}
                disabled={verticalDispatchLoading}
                className="btn btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{verticalDispatchLoading ? "Dispatching API Call..." : "Dispatch Vertical API"}</span>
              </button>
            </div>

            {/* Results Console */}
            <div className="space-y-2 font-mono text-xs">
              <label className="text-[#6B7C8D] block uppercase text-[10px] font-bold">Response Telemetry Payload</label>
              <div className="p-4 rounded-xl bg-[#0B1017] border border-[var(--line)] min-h-[220px] max-h-[300px] overflow-y-auto text-[11px] leading-relaxed text-[#2ED8B6]">
                {verticalDispatchResult ? (
                  <pre>{JSON.stringify(verticalDispatchResult, null, 2)}</pre>
                ) : (
                  <div className="text-[#6B7C8D] italic pt-12 text-center">
                    Select a target vertical and click "Dispatch Vertical API" to inspect live response payload.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONNECTOR SETUP MODAL (e.g. AWS S3, Twilio, Zendesk, Salesforce) */}
      {/* ========================================================================= */}
      {selectedConnectorConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#18222E] border border-[var(--line)] flex items-center justify-center text-sm text-[#2ED8B6]">
                  <i className={selectedConnectorConfig.icon} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8] font-sans">
                    Configure {selectedConnectorConfig.name}
                  </h3>
                  <p className="text-[10px] text-[#6B7C8D]">
                    Tenant Integration &amp; Interservice Gateway Binding
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedConnectorConfig(null)}
                className="p-1.5 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#141C26] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {selectedConnectorConfig.id.includes("s3") || selectedConnectorConfig.name.includes("S3") ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#B4C2D0] block">AWS S3 Bucket Name / Domain</label>
                    <input
                      type="text"
                      defaultValue="timeforbed.s3.ca-central-1.amazonaws.com"
                      className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#B4C2D0] block">AWS Region</label>
                      <input
                        type="text"
                        defaultValue="ca-central-1"
                        className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#B4C2D0] block">Sync Prefix</label>
                      <input
                        type="text"
                        defaultValue="knowledge/"
                        className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#B4C2D0] block">AWS Access Key ID</label>
                    <input
                      type="text"
                      defaultValue="AKIAIOSFODNN7EXAMPLE"
                      className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#B4C2D0] block">AWS Secret Access Key</label>
                    <input
                      type="password"
                      defaultValue="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#B4C2D0] block">Endpoint / Instance URL</label>
                    <input
                      type="text"
                      defaultValue="https://tenant.api.servicev8.internal/v1"
                      className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#B4C2D0] block">Secret Authentication Token</label>
                    <input
                      type="password"
                      defaultValue="sec_live_994812a884bf01e3"
                      className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setSelectedConnectorConfig(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleConnector(selectedConnectorConfig.id, true);
                  if (onNotify) {
                    onNotify(`Configured and enabled ${selectedConnectorConfig.name} in tenant account.`, "success");
                  }
                  setSelectedConnectorConfig(null);
                }}
                className="btn btn-primary text-xs font-bold"
              >
                Save &amp; Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
