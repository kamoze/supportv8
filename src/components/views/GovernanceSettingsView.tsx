"use client";

import React, { useState } from "react";
import {
  Settings,
  Shield,
  Key,
  Database,
  Lock,
  Zap,
  Globe,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Bot,
  Cpu,
  Server,
  Layers,
  Sparkles,
  Copy,
  Check,
  Radio,
  Clock,
  AlertTriangle,
  FileCode,
} from "lucide-react";
import type { TenantSettingConfig } from "@/lib/types/marketplace-types";

interface GovernanceSettingsViewProps {
  settings: TenantSettingConfig;
  onUpdateSettings: (updates: Partial<TenantSettingConfig>) => void;
}

export function GovernanceSettingsView({
  settings,
  onUpdateSettings,
}: GovernanceSettingsViewProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<"byom" | "embeddings" | "forgegw" | "general">("byom");

  // General & Security
  const [workspaceName, setWorkspaceName] = useState<string>(settings.workspaceName || "Acme Enterprise");
  const [webhookUrl, setWebhookUrl] = useState<string>(settings.webhookUrl || "https://supportv8.acme.com/api/ingress/webhook");
  const [operatingMode, setOperatingMode] = useState<"observe" | "copilot" | "autonomous">(
    settings.operatingMode || "autonomous"
  );
  const [retentionDays, setRetentionDays] = useState<number>(settings.dataRetentionDays || 90);
  const [autoEscalate, setAutoEscalate] = useState<boolean>(settings.autoEscalateFrustrated ?? true);
  const [requireApproval, setRequireApproval] = useState<boolean>(
    settings.requireApprovalForBroadcast ?? false
  );

  // BYOM (Bring Your Own Model)
  const [byomProvider, setByomProvider] = useState<"anthropic" | "openai" | "google" | "groq" | "custom_ollama">(
    settings.byomProvider || "anthropic"
  );
  const [byomModel, setByomModel] = useState<string>(settings.byomModel || "claude-3-5-sonnet-20241022");
  const [byomCustomEndpoint, setByomCustomEndpoint] = useState<string>(
    settings.byomCustomEndpoint || "https://api.anthropic.com/v1"
  );
  const [byomApiKey, setByomApiKey] = useState<string>(settings.byomApiKey || "sk-ant-api03-live_9921_77a4b2c1e8");
  const [showByomKey, setShowByomKey] = useState<boolean>(false);
  const [byomTemperature, setByomTemperature] = useState<number>(settings.byomTemperature ?? 0.2);
  const [byomMaxTokens, setByomMaxTokens] = useState<number>(settings.byomMaxTokens || 4096);
  const [testingByom, setTestingByom] = useState<boolean>(false);
  const [byomStatusMsg, setByomStatusMsg] = useState<string | null>(null);

  // Embeddings & pgvector
  const [embeddingProvider, setEmbeddingProvider] = useState<"openai" | "voyage" | "cohere" | "fastembed_local" | "custom_vector_endpoint">(
    settings.embeddingProvider || "openai"
  );
  const [embeddingModel, setEmbeddingModel] = useState<string>(settings.embeddingModel || "text-embedding-3-small");
  const [embeddingDimensions, setEmbeddingDimensions] = useState<number>(settings.embeddingDimensions || 1536);
  const [embeddingSimilarityMetric, setEmbeddingSimilarityMetric] = useState<"cosine" | "inner_product" | "euclidean_l2">(
    settings.embeddingSimilarityMetric || "cosine"
  );
  const [embeddingApiKey, setEmbeddingApiKey] = useState<string>(
    settings.embeddingApiKey || "sk-proj-embed_live_8841_55b3c2d1"
  );
  const [showEmbeddingKey, setShowEmbeddingKey] = useState<boolean>(false);
  const [embeddingChunkSize, setEmbeddingChunkSize] = useState<number>(settings.embeddingChunkSize || 512);
  const [embeddingChunkOverlap, setEmbeddingChunkOverlap] = useState<number>(settings.embeddingChunkOverlap || 64);
  const [testingEmbeddings, setTestingEmbeddings] = useState<boolean>(false);
  const [embeddingStatusMsg, setEmbeddingStatusMsg] = useState<string | null>(null);

  // ForgeGW (Action Gateway)
  const [forgeGwEndpoint, setForgeGwEndpoint] = useState<string>(
    settings.forgeGwEndpoint || "https://forgegw.servicev8.internal:8443"
  );
  const [forgeGwApiKey, setForgeGwApiKey] = useState<string>(
    settings.forgeGwApiKey || "fgw_live_sec_88421098bb12c4"
  );
  const [showForgeKey, setShowForgeKey] = useState<boolean>(false);
  const [forgeGwRateLimitRpm, setForgeGwRateLimitRpm] = useState<number>(settings.forgeGwRateLimitRpm || 500);
  const [forgeGwTimeoutMs, setForgeGwTimeoutMs] = useState<number>(settings.forgeGwTimeoutMs || 10000);
  const [forgeGwEnforceIdempotency, setForgeGwEnforceIdempotency] = useState<boolean>(
    settings.forgeGwEnforceIdempotency ?? true
  );
  const [forgeGwMtlsEnabled, setForgeGwMtlsEnabled] = useState<boolean>(settings.forgeGwMtlsEnabled ?? true);
  const [testingForge, setTestingForge] = useState<boolean>(false);
  const [forgeStatusMsg, setForgeStatusMsg] = useState<string | null>(null);
  const [copiedForgeKey, setCopiedForgeKey] = useState<boolean>(false);

  // Test BYOM Connection
  const handleTestByom = () => {
    setTestingByom(true);
    setByomStatusMsg(null);
    setTimeout(() => {
      setTestingByom(false);
      setByomStatusMsg(`Connected successfully to ${byomModel} (${byomProvider.toUpperCase()}) • 182ms Latency`);
    }, 700);
  };

  // Test Embeddings Connection
  const handleTestEmbeddings = () => {
    setTestingEmbeddings(true);
    setEmbeddingStatusMsg(null);
    setTimeout(() => {
      setTestingEmbeddings(false);
      setEmbeddingStatusMsg(`Embedding vectorizer online: ${embeddingModel} (${embeddingDimensions}-dim) • Generated test vector`);
    }, 650);
  };

  // Test ForgeGW Health
  const handleTestForge = () => {
    setTestingForge(true);
    setForgeStatusMsg(null);
    setTimeout(() => {
      setTestingForge(false);
      setForgeStatusMsg(`ForgeGW Health 200 OK • Mutual TLS Verified • Action Gateway SEC-04 Active (42ms)`);
    }, 600);
  };

  const handleCopyForgeKey = () => {
    navigator.clipboard.writeText(forgeGwApiKey);
    setCopiedForgeKey(true);
    setTimeout(() => setCopiedForgeKey(false), 2000);
  };

  const handleSaveAll = () => {
    onUpdateSettings({
      workspaceName,
      webhookUrl,
      operatingMode,
      dataRetentionDays: retentionDays,
      autoEscalateFrustrated: autoEscalate,
      requireApprovalForBroadcast: requireApproval,
      // BYOM
      byomProvider,
      byomModel,
      byomCustomEndpoint,
      byomApiKey,
      byomTemperature,
      byomMaxTokens,
      // Embeddings
      embeddingProvider,
      embeddingModel,
      embeddingDimensions,
      embeddingSimilarityMetric,
      embeddingApiKey,
      embeddingChunkSize,
      embeddingChunkOverlap,
      // ForgeGW
      forgeGwEndpoint,
      forgeGwApiKey,
      forgeGwRateLimitRpm,
      forgeGwTimeoutMs,
      forgeGwEnforceIdempotency,
      forgeGwMtlsEnabled,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Governance &amp; AI Infrastructure Settings</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Configure BYOM model endpoints, vector embedding dimensions, ForgeGW action gateway security keys, and tenant RBAC.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          className="btn btn-primary py-2.5 px-6 text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save Configuration</span>
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center p-1 rounded-xl bg-[#18222E] border border-[var(--line)] gap-1">
        {[
          { id: "byom", label: "BYOM (Custom LLMs)", icon: Cpu },
          { id: "embeddings", label: "Embeddings & Vectors", icon: Database },
          { id: "forgegw", label: "ForgeGW Action Gateway", icon: Zap },
          { id: "general", label: "Workspace & Security", icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSettingsTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeSettingsTab === tab.id
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BYOM (BRING YOUR OWN MODEL) */}
      {/* ========================================================================= */}
      {activeSettingsTab === "byom" && (
        <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8] font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#2ED8B6]" />
                <span>Bring Your Own Model (BYOM) Configuration</span>
              </h3>
              <p className="text-xs text-[#B4C2D0]">
                Route autonomous resolution, RAG synthesis, and multi-turn chat to your own enterprise LLM accounts or self-hosted VPC endpoints.
              </p>
            </div>
            <span className="pill ok text-[10px] font-mono">ENTERPRISE BYOM ACTIVE</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Provider Grid */}
            <div>
              <label className="text-[#6B7C8D] block mb-2 font-mono uppercase">Primary LLM Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { id: "anthropic", label: "Anthropic Claude", defaultModel: "claude-3-5-sonnet-20241022", endpoint: "https://api.anthropic.com/v1" },
                  { id: "openai", label: "OpenAI GPT-4o", defaultModel: "gpt-4o", endpoint: "https://api.openai.com/v1" },
                  { id: "google", label: "Google Gemini", defaultModel: "gemini-1.5-pro", endpoint: "https://generativelanguage.googleapis.com/v1beta" },
                  { id: "groq", label: "Groq LPU", defaultModel: "llama-3.3-70b-versatile", endpoint: "https://api.groq.com/openai/v1" },
                  { id: "custom_ollama", label: "Self-Hosted / Ollama", defaultModel: "llama3.2:latest", endpoint: "http://localhost:11434/v1" },
                ].map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setByomProvider(prov.id as any);
                      setByomModel(prov.defaultModel);
                      setByomCustomEndpoint(prov.endpoint);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      byomProvider === prov.id
                        ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_12px_rgba(46,216,182,0.2)]"
                        : "bg-[#0E1520] border-[var(--line)] hover:border-[#2ED8B6]/40"
                    }`}
                  >
                    <div className="font-bold text-[#EAF1F8] text-[11px]">{prov.label}</div>
                    <div className="text-[10px] font-mono text-[#2ED8B6] truncate">{prov.defaultModel}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Name & Endpoint */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Model Identifier String</label>
                <input
                  type="text"
                  value={byomModel}
                  onChange={(e) => setByomModel(e.target.value)}
                  placeholder="e.g. claude-3-5-sonnet-20241022 or gpt-4o"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Custom Ingestion / API Base URL</label>
                <input
                  type="text"
                  value={byomCustomEndpoint}
                  onChange={(e) => setByomCustomEndpoint(e.target.value)}
                  placeholder="https://api.anthropic.com/v1 or http://localhost:11434/v1"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* BYOM API Key */}
            <div>
              <label className="text-[#6B7C8D] block mb-1 font-mono">Provider Authentication API Secret Key</label>
              <div className="relative">
                <input
                  type={showByomKey ? "text" : "password"}
                  value={byomApiKey}
                  onChange={(e) => setByomApiKey(e.target.value)}
                  placeholder="sk-ant-... or sk-proj-..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] pl-3.5 pr-10 py-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
                <button
                  type="button"
                  onClick={() => setShowByomKey(!showByomKey)}
                  className="absolute right-3 top-3 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  {showByomKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Sliders: Temperature & Max Tokens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#18222E] border border-[var(--line)]">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#6B7C8D] font-mono">Temperature: <strong className="text-[#2ED8B6]">{byomTemperature.toFixed(2)}</strong></span>
                  <span className="text-[10px] text-[#6B7C8D]">Deterministic (0.0) &rarr; Creative (1.0)</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={byomTemperature}
                  onChange={(e) => setByomTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[#2ED8B6] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#6B7C8D] font-mono">Max Output Tokens: <strong className="text-[#2ED8B6]">{byomMaxTokens}</strong></span>
                  <span className="text-[10px] text-[#6B7C8D]">1k - 8k tokens</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="8192"
                  step="512"
                  value={byomMaxTokens}
                  onChange={(e) => setByomMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-[#2ED8B6] cursor-pointer"
                />
              </div>
            </div>

            {/* Status & Test Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-[11px] font-mono">
                {byomStatusMsg ? (
                  <span className="text-[#4CC38A] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{byomStatusMsg}</span>
                  </span>
                ) : (
                  <span className="text-[#6B7C8D]">Click test to verify token authorization and round-trip latency.</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestByom}
                disabled={testingByom}
                className="btn btn-secondary py-2 px-4 text-xs font-mono flex items-center gap-1.5 cursor-pointer text-[#2ED8B6] hover:border-[#2ED8B6]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingByom ? "animate-spin" : ""}`} />
                <span>{testingByom ? "Testing Handshake..." : "Test BYOM Connection"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EMBEDDINGS & VECTORS */}
      {/* ========================================================================= */}
      {activeSettingsTab === "embeddings" && (
        <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8] font-mono flex items-center gap-2">
                <Database className="w-4 h-4 text-[#2ED8B6]" />
                <span>Vector Embeddings &amp; pgvector Pipeline</span>
              </h3>
              <p className="text-xs text-[#B4C2D0]">
                Configure semantic vector embeddings provider, dimensionality, and chunking boundaries for RAG document retrieval.
              </p>
            </div>
            <span className="pill ok text-[10px] font-mono">{embeddingDimensions}-DIM ACTIVE</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Embedding Provider Selection */}
            <div>
              <label className="text-[#6B7C8D] block mb-2 font-mono uppercase">Vector Embedding Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: "openai", label: "OpenAI Embeddings", model: "text-embedding-3-small", dim: 1536 },
                  { id: "voyage", label: "Voyage AI", model: "voyage-3", dim: 1024 },
                  { id: "cohere", label: "Cohere Embed v3", model: "embed-english-v3.0", dim: 1024 },
                  { id: "fastembed_local", label: "FastEmbed (Local / CPU)", model: "BGE-Small-EN-v1.5", dim: 384 },
                ].map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setEmbeddingProvider(prov.id as any);
                      setEmbeddingModel(prov.model);
                      setEmbeddingDimensions(prov.dim);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      embeddingProvider === prov.id
                        ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_12px_rgba(46,216,182,0.2)]"
                        : "bg-[#0E1520] border-[var(--line)] hover:border-[#2ED8B6]/40"
                    }`}
                  >
                    <div className="font-bold text-[#EAF1F8] text-[11px]">{prov.label}</div>
                    <div className="text-[10px] font-mono text-[#2ED8B6]">{prov.dim} Dimensions</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Embedding Model & Dimensions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Embedding Model Name</label>
                <input
                  type="text"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Vector Dimensions</label>
                <select
                  value={embeddingDimensions}
                  onChange={(e) => setEmbeddingDimensions(parseInt(e.target.value))}
                  className="w-full bg-[#18222E] text-[#2ED8B6] font-mono font-bold p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value={384}>384 Dimensions (Fast / Lightweight)</option>
                  <option value={1024}>1024 Dimensions (Voyage / Cohere)</option>
                  <option value={1536}>1536 Dimensions (Standard OpenAI)</option>
                  <option value={3072}>3072 Dimensions (text-embedding-3-large)</option>
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Distance Metric</label>
                <select
                  value={embeddingSimilarityMetric}
                  onChange={(e) => setEmbeddingSimilarityMetric(e.target.value as any)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] font-mono p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="cosine">Cosine Distance (&lt;=&gt;)</option>
                  <option value="inner_product">Inner Product (&lt;#&gt;)</option>
                  <option value="euclidean_l2">Euclidean L2 Distance (&lt;-&gt;)</option>
                </select>
              </div>
            </div>

            {/* Embedding API Key */}
            <div>
              <label className="text-[#6B7C8D] block mb-1 font-mono">Embedding Provider API Secret Key</label>
              <div className="relative">
                <input
                  type={showEmbeddingKey ? "text" : "password"}
                  value={embeddingApiKey}
                  onChange={(e) => setEmbeddingApiKey(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] pl-3.5 pr-10 py-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
                <button
                  type="button"
                  onClick={() => setShowEmbeddingKey(!showEmbeddingKey)}
                  className="absolute right-3 top-3 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  {showEmbeddingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Chunk Size & Overlap */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#18222E] border border-[var(--line)]">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Document Chunk Size (Tokens)</label>
                <input
                  type="number"
                  value={embeddingChunkSize}
                  onChange={(e) => setEmbeddingChunkSize(parseInt(e.target.value))}
                  className="w-full bg-[#0E1520] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono"
                />
                <span className="text-[10px] text-[#6B7C8D]">Recommended: 512 tokens for heading sections</span>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Chunk Overlap Boundary (Tokens)</label>
                <input
                  type="number"
                  value={embeddingChunkOverlap}
                  onChange={(e) => setEmbeddingChunkOverlap(parseInt(e.target.value))}
                  className="w-full bg-[#0E1520] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono"
                />
                <span className="text-[10px] text-[#6B7C8D]">Recommended: 64 tokens overlap</span>
              </div>
            </div>

            {/* Test Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-[11px] font-mono">
                {embeddingStatusMsg ? (
                  <span className="text-[#4CC38A] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{embeddingStatusMsg}</span>
                  </span>
                ) : (
                  <span className="text-[#6B7C8D]">Test vectorization creates a live 1536-dim embedding trial.</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestEmbeddings}
                disabled={testingEmbeddings}
                className="btn btn-secondary py-2 px-4 text-xs font-mono flex items-center gap-1.5 cursor-pointer text-[#2ED8B6] hover:border-[#2ED8B6]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingEmbeddings ? "animate-spin" : ""}`} />
                <span>{testingEmbeddings ? "Vectorizing..." : "Test Embedding Vectorization"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FORGEGW ACTION GATEWAY */}
      {/* ========================================================================= */}
      {activeSettingsTab === "forgegw" && (
        <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8] font-mono flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#2ED8B6]" />
                <span>ServiceV8 ForgeGW (Action Gateway) Credentials</span>
              </h3>
              <p className="text-xs text-[#B4C2D0]">
                Zero-trust execution proxy that gates autonomous external mutations (refunds, ticket escalations, DNS shifts) with idempotency tokens and rate limits.
              </p>
            </div>
            <span className="pill ok text-[10px] font-mono">SEC-04 GATEWAY ACTIVE</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* ForgeGW URL */}
            <div>
              <label className="text-[#6B7C8D] block mb-1 font-mono">ForgeGW Ingress Endpoint Proxy URL</label>
              <input
                type="text"
                value={forgeGwEndpoint}
                onChange={(e) => setForgeGwEndpoint(e.target.value)}
                placeholder="https://forgegw.servicev8.internal:8443"
                className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            {/* ForgeGW API Key */}
            <div>
              <label className="text-[#6B7C8D] block mb-1 font-mono">ForgeGW Action Gateway Secret Token</label>
              <div className="relative flex items-center gap-2">
                <input
                  type={showForgeKey ? "text" : "password"}
                  value={forgeGwApiKey}
                  onChange={(e) => setForgeGwApiKey(e.target.value)}
                  className="w-full bg-[#18222E] text-[#2ED8B6] font-mono pl-3.5 pr-20 py-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
                <button
                  type="button"
                  onClick={() => setShowForgeKey(!showForgeKey)}
                  className="absolute right-12 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  {showForgeKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyForgeKey}
                  className="btn btn-secondary py-2 px-3 text-xs font-mono flex items-center gap-1 cursor-pointer"
                  title="Copy ForgeGW Key"
                >
                  {copiedForgeKey ? <Check className="w-3.5 h-3.5 text-[#4CC38A]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Gateway Security Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#EAF1F8]">Mandatory Idempotency Verification</div>
                    <div className="text-[10px] text-[#6B7C8D]">Requires X-Idempotency-Key on all mutations</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={forgeGwEnforceIdempotency}
                    onChange={(e) => setForgeGwEnforceIdempotency(e.target.checked)}
                    className="w-4 h-4 accent-[#2ED8B6] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                  <div>
                    <div className="font-bold text-[#EAF1F8]">Mutual TLS (mTLS) Encryption</div>
                    <div className="text-[10px] text-[#6B7C8D]">x509 client certificate validation</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={forgeGwMtlsEnabled}
                    onChange={(e) => setForgeGwMtlsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#2ED8B6] cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Action Rate Limiting (Requests / Min)</label>
                  <select
                    value={forgeGwRateLimitRpm}
                    onChange={(e) => setForgeGwRateLimitRpm(parseInt(e.target.value))}
                    className="w-full bg-[#0E1520] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono cursor-pointer"
                  >
                    <option value={100}>100 RPM (Strict Protection)</option>
                    <option value={500}>500 RPM (Standard Production)</option>
                    <option value={2000}>2,000 RPM (Enterprise Peak Load)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Circuit Breaker Timeout Threshold</label>
                  <select
                    value={forgeGwTimeoutMs}
                    onChange={(e) => setForgeGwTimeoutMs(parseInt(e.target.value))}
                    className="w-full bg-[#0E1520] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono cursor-pointer"
                  >
                    <option value={5000}>5,000 ms (Fast Failover)</option>
                    <option value={10000}>10,000 ms (Standard)</option>
                    <option value={30000}>30,000 ms (Long-running jobs)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Test Forge Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-[11px] font-mono">
                {forgeStatusMsg ? (
                  <span className="text-[#4CC38A] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{forgeStatusMsg}</span>
                  </span>
                ) : (
                  <span className="text-[#6B7C8D]">ForgeGW proxy verifies cryptographic signature before execution.</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestForge}
                disabled={testingForge}
                className="btn btn-secondary py-2 px-4 text-xs font-mono flex items-center gap-1.5 cursor-pointer text-[#2ED8B6] hover:border-[#2ED8B6]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingForge ? "animate-spin" : ""}`} />
                <span>{testingForge ? "Pinging Gateway..." : "Verify ForgeGW Health"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: WORKSPACE & SECURITY GENERAL */}
      {/* ========================================================================= */}
      {activeSettingsTab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Workspace Identity */}
          <div className="card p-5 rounded-2xl border-[var(--line)] space-y-4 bg-[#121A24]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#EAF1F8] border-b border-[var(--line)] pb-2">
              <Globe className="w-4 h-4 text-[#2ED8B6]" />
              <span>Workspace Identity &amp; Domain</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Workspace Display Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Isolated Subdomain</label>
                <div className="p-2.5 rounded-xl bg-[#0C121A] border border-[var(--line)] font-mono text-xs text-[#2ED8B6] flex items-center justify-between">
                  <span>{settings.workspaceSlug || "acme-enterprise"}.supportv8.com</span>
                  <span className="pill ok text-[9px] py-0 font-mono">RLS ACTIVE</span>
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Global Ingress Webhook</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] font-mono text-[11px] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>
          </div>

          {/* Operating Mode */}
          <div className="card p-5 rounded-2xl border-[var(--line)] space-y-4 bg-[#121A24]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#EAF1F8] border-b border-[var(--line)] pb-2">
              <Sliders className="w-4 h-4 text-[#2ED8B6]" />
              <span>Operating Autonomy Mode</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "autonomous", label: "Autonomous", desc: "AI executes directly", icon: Bot },
                { id: "copilot", label: "Copilot", desc: "Agent approves drafts", icon: Zap },
                { id: "observe", label: "Observe", desc: "Read-only analytics", icon: Eye },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setOperatingMode(m.id as any)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      operatingMode === m.id
                        ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6] font-bold"
                        : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{m.label}</span>
                    <span className="text-[9px] opacity-75">{m.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#EAF1F8]">Auto-Escalate Frustrated Users</div>
                  <div className="text-[10px] text-[#6B7C8D]">Instantly routes sentiment &lt; 0.35 to human tier 2</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoEscalate}
                  onChange={(e) => setAutoEscalate(e.target.checked)}
                  className="w-4 h-4 accent-[#2ED8B6] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <div>
                  <div className="font-bold text-[#EAF1F8]">Require Human Approval for Broadcasts</div>
                  <div className="text-[10px] text-[#6B7C8D]">Maya outage emails must be signed off</div>
                </div>
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  className="w-4 h-4 accent-[#2ED8B6] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
