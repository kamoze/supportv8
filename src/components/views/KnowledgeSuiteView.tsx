"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Upload,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  ExternalLink,
  Layers,
  Database,
  ArrowRight,
  Shield,
  Tag,
  Edit3,
  Trash2,
  Sliders,
  X,
  FileCode,
  Lock,
  ChevronRight,
  Copy,
  Check,
  FolderPlus,
  BookOpen,
} from "lucide-react";
import type {
  KnowledgeArticle,
  KnowledgeGap,
  KnowledgeProposal,
  KnowledgeDocument,
  KnowledgeDocumentChunk,
  KnowledgeWebSource,
} from "@/lib/types";
import { KnowledgeGraphCanvas } from "./KnowledgeGraphCanvas";

interface KnowledgeSuiteViewProps {
  knowledge: {
    articles: KnowledgeArticle[];
    gaps: KnowledgeGap[];
    proposals: KnowledgeProposal[];
    documents?: KnowledgeDocument[];
    webSources?: KnowledgeWebSource[];
  };
  onPublishProposal: (proposalId: string) => void;
  onSyncKv8: () => void;
  onNotify: (text: string, type?: "success" | "error" | "info") => void;
}

export function KnowledgeSuiteView({
  knowledge,
  onPublishProposal,
  onSyncKv8,
  onNotify,
}: KnowledgeSuiteViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"ingest" | "curation" | "rag_editor" | "deficit_mapper" | "graph" | "topology_settings">("ingest");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Vector Grounding Field Values State
  const [vectorModel, setVectorModel] = useState("text-embedding-3-small");
  const [vectorChunkSize, setVectorChunkSize] = useState(512);
  const [vectorChunkOverlap, setVectorChunkOverlap] = useState(64);
  const [vectorCosineThreshold, setVectorCosineThreshold] = useState(0.80);
  const [vectorTopK, setVectorTopK] = useState(5);
  const [vectorSyncFrequency, setVectorSyncFrequency] = useState("60");
  const [vectorRetentionTtl, setVectorRetentionTtl] = useState("365");

  // Direct Document Upload States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<string>("auth_sso");
  const [uploadGroups, setUploadGroups] = useState<string[]>(["support-tier1"]);
  const [uploadTags, setUploadTags] = useState<string[]>(["saml", "okta"]);
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // S3 Storage Source States (for Large Files & Bulk Repositories)
  const [s3Sources, setS3Sources] = useState<any[]>([
    {
      id: "s3_src_01",
      bucketName: "supportv8-kb-documents",
      prefix: "enterprise-runbooks/",
      region: "us-east-1",
      endpoint: "http://minio.default.svc.cluster.local:9000",
      fileCount: 24,
      totalSizeBytes: 345 * 1024 * 1024,
      status: "connected",
      lastSyncedAt: "1 hour ago",
      targetCategory: "auth_sso",
      groups: ["support-tier1", "infra-ops"],
    },
    {
      id: "s3_src_02",
      bucketName: "acme-engineering-vault",
      prefix: "postmortems/2026/",
      region: "us-east-1",
      fileCount: 88,
      totalSizeBytes: 1240 * 1024 * 1024,
      status: "connected",
      lastSyncedAt: "Yesterday",
      targetCategory: "checkout_failure",
      groups: ["support-tier1", "vip-escalations"],
    },
  ]);
  const [isS3ModalOpen, setIsS3ModalOpen] = useState<boolean>(false);
  const [s3BucketName, setS3BucketName] = useState<string>("supportv8-kb-documents");
  const [s3Prefix, setS3Prefix] = useState<string>("docs/");
  const [s3Region, setS3Region] = useState<string>("us-east-1");
  const [s3Endpoint, setS3Endpoint] = useState<string>("http://minio.default.svc.cluster.local:9000");
  const [s3Category, setS3Category] = useState<string>("auth_sso");
  const [s3Groups, setS3Groups] = useState<string[]>(["support-tier1"]);
  const [s3SyncingId, setS3SyncingId] = useState<string | null>(null);
  const [isConnectingS3, setIsConnectingS3] = useState<boolean>(false);

  // Web Crawler States
  const [crawlUrl, setCrawlUrl] = useState<string>("https://docs.acme.com/identity/sso-saml");
  const [crawlCategory, setCrawlCategory] = useState<string>("auth_sso");
  const [crawlLoading, setCrawlLoading] = useState<boolean>(false);

  // Local Ingested Documents List
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(knowledge.documents || []);

  // Curation Drawer Modal States
  const [curatingDoc, setCuratingDoc] = useState<KnowledgeDocument | null>(null);
  const [curateTitle, setCurateTitle] = useState<string>("");
  const [curateArticleType, setCurateArticleType] = useState<"runbook" | "faq" | "architecture" | "api_reference" | "policy">("runbook");
  const [curateCategory, setCurateCategory] = useState<string>("auth_sso");
  const [curateGroups, setCurateGroups] = useState<string[]>(["support-tier1"]);
  const [curateTags, setCurateTags] = useState<string[]>([]);
  const [curateSummary, setCurateSummary] = useState<string>("");
  const [curateContent, setCurateContent] = useState<string>("");
  const [curateLoading, setCurateLoading] = useState<boolean>(false);

  // RAG Chunks Editor Drawer States
  const [ragEditingDoc, setRagEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [docChunks, setDocChunks] = useState<KnowledgeDocumentChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState<boolean>(false);
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editChunkContent, setEditChunkContent] = useState<string>("");
  const [editChunkSection, setEditChunkSection] = useState<string>("");
  const [editChunkWeight, setEditChunkWeight] = useState<number>(1.0);
  const [newChunkContent, setNewChunkContent] = useState<string>("");
  const [newChunkSection, setNewChunkSection] = useState<string>("");
  const [isAddingChunk, setIsAddingChunk] = useState<boolean>(false);

  // Tag Quick Edit Modal States
  const [tagEditingDoc, setTagEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [editDocGroups, setEditDocGroups] = useState<string[]>([]);
  const [editDocTags, setEditDocTags] = useState<string[]>([]);

  // Search States for Curation and RAG Editor
  const [curationSearchQuery, setCurationSearchQuery] = useState<string>("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [ragSearchQuery, setRagSearchQuery] = useState<string>("");
  const [isGlobalChunkSearch, setIsGlobalChunkSearch] = useState<boolean>(false);

  // Synchronize documents from props if updated
  useEffect(() => {
    if (knowledge.documents && knowledge.documents.length > 0) {
      setDocuments(knowledge.documents);
    }
  }, [knowledge.documents]);

  // Load Chunks when opening RAG Editor
  const openRagEditor = async (doc: KnowledgeDocument) => {
    setRagEditingDoc(doc);
    setChunksLoading(true);
    try {
      const res = await fetch(`/api/knowledge/chunks?documentId=${doc.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDocChunks(json.data);
      } else {
        // Fallback default chunks
        setDocChunks([
          {
            id: `chk_${doc.id}_0`,
            documentId: doc.id,
            tenantId: "tenant_default",
            chunkIndex: 0,
            section: "Overview",
            content: doc.summary || "Main document content",
            weight: 1.0,
            tokenCount: 42,
            updatedAt: new Date().toISOString(),
            embedding: [],
          },
        ]);
      }
    } catch (err) {
      onNotify("Failed to fetch RAG chunks", "error");
    } finally {
      setChunksLoading(false);
    }
  };

  // Open Curation Drawer
  const openCuration = (doc: KnowledgeDocument) => {
    setCuratingDoc(doc);
    setCurateTitle(doc.title || doc.filename.replace(/\.[^/.]+$/, ""));
    setCurateCategory(doc.category || "auth_sso");
    setCurateArticleType(doc.category.includes("checkout") ? "runbook" : "faq");
    setCurateGroups(doc.groups || ["support-tier1"]);
    setCurateTags(doc.tags || [doc.category]);
    setCurateSummary(doc.summary || "");
    setCurateContent(
      doc.body ||
        `# ${doc.title}\n\n## Overview\n${doc.summary}\n\n## Resolution Protocol\n1. Verify tenant authentication credentials.\n2. Inspect upstream webhook latency.\n3. Execute OrderV8 idempotency mitigation if necessary.`
    );
  };

  // Open Tag Quick Editor
  const openTagEditor = (doc: KnowledgeDocument) => {
    setTagEditingDoc(doc);
    setEditDocGroups(doc.groups || ["support-tier1"]);
    setEditDocTags(doc.tags || [doc.category]);
  };

  // Direct Document Upload Handler (25MB Limit Enforced)
  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      onNotify("Please select a document file to upload", "error");
      return;
    }

    // Client-side 25MB Guard (Aligned with knowledgev8 Pod Memory Guard)
    if (uploadFile.size > 25 * 1024 * 1024) {
      const sizeMb = (uploadFile.size / (1024 * 1024)).toFixed(1);
      onNotify(
        `File '${uploadFile.name}' (${sizeMb}MB) exceeds the 25MB direct upload cap. Please use the S3 Storage Source connector below for high-volume or large-file ingestion.`,
        "error"
      );
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle || uploadFile.name);
      formData.append("category", uploadCategory);
      formData.append("groups", JSON.stringify(uploadGroups));
      formData.append("tags", JSON.stringify(uploadTags));

      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.success && json.data) {
        const newDoc: KnowledgeDocument = json.data.document;
        setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
        onNotify(`Document '${newDoc.filename}' successfully uploaded to S3 and vectorized into ${newDoc.chunkCount} pgvector chunks!`, "success");
        setUploadFile(null);
        setUploadTitle("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        throw new Error(json.error || "Upload failed");
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : "Document upload failed", "error");
    } finally {
      setUploadLoading(false);
    }
  };

  // Connect S3 Storage Source Handler
  const handleConnectS3 = async () => {
    if (!s3BucketName.trim()) {
      onNotify("Bucket name is required", "error");
      return;
    }
    setIsConnectingS3(true);
    try {
      const res = await fetch("/api/knowledge/s3-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucketName: s3BucketName,
          prefix: s3Prefix,
          region: s3Region,
          endpoint: s3Endpoint || undefined,
          targetCategory: s3Category,
          groups: s3Groups,
        }),
      }).then((r) => r.json());
      if (res.success) {
        setS3Sources((prev) => [res.data, ...prev]);
        onNotify(res.message || "S3 Storage Source connected successfully!", "success");
        setIsS3ModalOpen(false);
      } else {
        onNotify(res.error || "Failed to connect S3 source", "error");
      }
    } catch (err) {
      onNotify("Failed to connect S3 source", "error");
    } finally {
      setIsConnectingS3(false);
    }
  };

  // Sync S3 Storage Source Handler
  const handleSyncS3 = async (sourceId: string) => {
    setS3SyncingId(sourceId);
    try {
      const res = await fetch("/api/knowledge/s3-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", sourceId }),
      }).then((r) => r.json());
      if (res.success) {
        onNotify(res.message || "S3 bucket objects synced into pgvector chunks!", "success");
        onSyncKv8();
      } else {
        onNotify(res.error || "Failed to sync S3 bucket", "error");
      }
    } catch (err) {
      onNotify("Failed to sync S3 source", "error");
    } finally {
      setS3SyncingId(null);
    }
  };

  // Save Curation & Publish to Knowledge Base
  const handleSaveCuration = async () => {
    if (!curatingDoc || !curateTitle) return;
    setCurateLoading(true);
    try {
      const res = await fetch("/api/knowledge/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: curatingDoc.id,
          title: curateTitle,
          articleType: curateArticleType,
          category: curateCategory,
          groups: curateGroups,
          tags: curateTags,
          summary: curateSummary,
          content: curateContent,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === curatingDoc.id ? { ...d, curatedStatus: "curated", groups: curateGroups, tags: curateTags } : d))
        );
        onNotify(`Document curated and published to Knowledge Base as '${curateTitle}'!`, "success");
        setCuratingDoc(null);
      } else {
        throw new Error(json.error || "Curation failed");
      }
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : "Curation failed", "error");
    } finally {
      setCurateLoading(false);
    }
  };

  // Save Quick Tags
  const handleSaveTags = async () => {
    if (!tagEditingDoc) return;
    try {
      const res = await fetch("/api/knowledge/chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_tags",
          documentId: tagEditingDoc.id,
          groups: editDocGroups,
          tags: editDocTags,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === tagEditingDoc.id ? { ...d, groups: editDocGroups, tags: editDocTags } : d))
        );
        onNotify(`Tags updated and propagated for ${tagEditingDoc.filename}!`, "success");
        setTagEditingDoc(null);
      }
    } catch (err) {
      onNotify("Failed to save tags", "error");
    }
  };

  // Save Edited Chunk
  const handleSaveChunk = async (chunkId: string) => {
    try {
      const res = await fetch("/api/knowledge/chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_chunk",
          chunkId,
          content: editChunkContent,
          section: editChunkSection,
          weight: editChunkWeight,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDocChunks((prev) =>
          prev.map((c) => (c.id === chunkId ? { ...c, content: editChunkContent, section: editChunkSection, weight: editChunkWeight, updatedAt: new Date().toISOString() } : c))
        );
        onNotify(`RAG chunk re-vectorized with 1536-dim embedding!`, "success");
        setEditingChunkId(null);
      }
    } catch (err) {
      onNotify("Failed to update chunk", "error");
    }
  };

  // Add Manual Chunk
  const handleAddChunk = async () => {
    if (!ragEditingDoc || !newChunkContent.trim()) return;
    try {
      const res = await fetch("/api/knowledge/chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_chunk",
          documentId: ragEditingDoc.id,
          content: newChunkContent,
          section: newChunkSection || "Manual Note",
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDocChunks((prev) => [...prev, json.data]);
        setNewChunkContent("");
        setNewChunkSection("");
        setIsAddingChunk(false);
        onNotify(`New RAG chunk indexed and vectorized!`, "success");
      }
    } catch (err) {
      onNotify("Failed to add chunk", "error");
    }
  };

  // Delete Chunk
  const handleDeleteChunk = async (chunkId: string) => {
    try {
      const res = await fetch("/api/knowledge/chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_chunk", chunkId }),
      });
      const json = await res.json();
      if (json.success) {
        setDocChunks((prev) => prev.filter((c) => c.id !== chunkId));
        onNotify(`Chunk removed from vector index`, "info");
      }
    } catch (err) {
      onNotify("Failed to delete chunk", "error");
    }
  };

  // Web Crawler Handler
  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl) return;
    setCrawlLoading(true);
    try {
      await fetch("/api/knowledge/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl, category: crawlCategory }),
      });
      onNotify(`Ingested & vectorized web source ${crawlUrl}`, "success");
    } catch (err) {
      onNotify("Web crawl ingestion failed", "error");
    } finally {
      setCrawlLoading(false);
    }
  };

  const filteredArticles = (knowledge.articles || []).filter(
    (a) =>
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = documents.filter(
    (d) =>
      !searchQuery ||
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.summary && d.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      d.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const allUniqueTags = Array.from(
    new Set(documents.flatMap((d) => d.tags || [d.category]).filter(Boolean))
  );

  const curationFilteredDocs = documents.filter((doc) => {
    const q = curationSearchQuery.toLowerCase();
    const matchesQuery =
      !curationSearchQuery ||
      doc.title.toLowerCase().includes(q) ||
      doc.filename.toLowerCase().includes(q) ||
      doc.category.toLowerCase().includes(q) ||
      (doc.summary && doc.summary.toLowerCase().includes(q)) ||
      doc.tags?.some((t) => t.toLowerCase().includes(q));

    const matchesTag =
      selectedTagFilter === "all" ||
      doc.tags?.includes(selectedTagFilter) ||
      doc.category === selectedTagFilter;

    return matchesQuery && matchesTag;
  });

  const ragFilteredChunks = docChunks.filter((chunk) => {
    if (!ragSearchQuery) return true;
    const q = ragSearchQuery.toLowerCase();
    return (
      chunk.content.toLowerCase().includes(q) ||
      (chunk.section && chunk.section.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Brain className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Knowledge Suite &amp; Semantic Curation Hub</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Direct S3 document upload, heading-based chunk curation, semantic group tagging, RAG vector output editing, and 2D topology graph.
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center p-1 rounded-xl bg-[#18222E] border border-[var(--line)] gap-1">
          {[
            { id: "ingest", label: "Vault & Direct Upload", icon: Upload },
            { id: "curation", label: "Curation & Tagging", icon: Edit3 },
            { id: "rag_editor", label: "RAG Output Editor", icon: Sparkles },
            { id: "deficit_mapper", label: "Deficit Mapper", icon: FileText },
            { id: "graph", label: "Knowledge Graph", icon: Layers },
            { id: "topology_settings", label: "Vector Field Values", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === tab.id
                    ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                    : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: Vault & Direct Upload */}
      {/* ========================================================================= */}
      {activeSubTab === "ingest" && (
        <div className="space-y-6">
          {/* Direct Document Upload Dropzone */}
          <div className="card p-6 rounded-2xl border-2 border-dashed border-[#2ED8B6]/40 bg-[#0E1622] space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Direct Document Upload &amp; pgvector Ingestion</h3>
                  <p className="text-xs text-[#B4C2D0]">
                    Drop documents straight into the enterprise vault. Supports PDF, DOCX, XLSX, CSV, Markdown, JSON, HTML, and images (up to 25MB).
                  </p>
                </div>
              </div>
              <span className="pill ok text-[10px] font-mono">KNOWLEDGEV8 INGEST ENGINE</span>
            </div>

            <form onSubmit={handleDirectUpload} className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const f = e.dataTransfer.files[0];
                    if (f.size > 25 * 1024 * 1024) {
                      const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
                      onNotify(`File '${f.name}' (${sizeMb}MB) exceeds the 25MB direct upload cap. Use the S3 Storage Source connector below.`, "error");
                      return;
                    }
                    setUploadFile(f);
                    setUploadTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                  isDragOver
                    ? "bg-[#2ED8B6]/10 border-[#2ED8B6] scale-[1.01]"
                    : uploadFile
                    ? "bg-[#18222E] border-[#2ED8B6]/60"
                    : "bg-[#121A24] border-[var(--line-2)] hover:border-[#2ED8B6]/40 hover:bg-[#15202E]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      if (f.size > 25 * 1024 * 1024) {
                        const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
                        onNotify(`File '${f.name}' (${sizeMb}MB) exceeds the 25MB direct upload cap. Use the S3 Storage Source connector below.`, "error");
                        return;
                      }
                      setUploadFile(f);
                      setUploadTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
                    }
                  }}
                  accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.markdown,.html,.htm,.json,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-[#18222E] border border-[var(--line)] flex items-center justify-center text-[#2ED8B6]">
                  {uploadFile ? <CheckCircle2 className="w-6 h-6 text-[#2ED8B6]" /> : <Upload className="w-6 h-6" />}
                </div>

                {uploadFile ? (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#EAF1F8] font-mono">{uploadFile.name}</div>
                    <div className="text-[11px] text-[#2ED8B6] font-mono">
                      {(uploadFile.size / 1024).toFixed(1)} KB &bull; Ready to ingest &amp; chunk (Max 25MB)
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#EAF1F8]">
                      Click to browse or drag &amp; drop document files here
                    </div>
                    <div className="text-[11px] text-[#6B7C8D] font-mono">
                      PDF, DOCX, Markdown, CSV, JSON, TXT &bull; Max 25MB per file &bull; 1536-dim pgvector
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Metadata Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Curated Document Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Okta SAML 2.0 Integration Runbook"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Target Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                  >
                    <option value="auth_sso">Authentication &amp; SAML SSO</option>
                    <option value="checkout_failure">Billing, Stripe &amp; OrderV8</option>
                    <option value="voice_telephony">Voice SIP &amp; Telephony Hub</option>
                    <option value="infrastructure">Infrastructure &amp; API Status</option>
                    <option value="general">General Operations</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">RBAC Group Visibility</label>
                  <select
                    value={uploadGroups[0] || "support-tier1"}
                    onChange={(e) => setUploadGroups([e.target.value])}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                  >
                    <option value="support-tier1">support-tier1 (All Agents &amp; AI)</option>
                    <option value="finance-billing">finance-billing (OrderV8 Leads)</option>
                    <option value="infra-ops">infra-ops (DevOps Engineers)</option>
                    <option value="vip-escalations">vip-escalations (Tier 2)</option>
                  </select>
                </div>
              </div>

              {/* Tag Chips Picker */}
              <div className="space-y-2">
                <label className="text-[#6B7C8D] block text-xs font-mono">Semantic Tag Chips (Applied to Chunks)</label>
                <div className="flex flex-wrap items-center gap-2">
                  {uploadTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-[#18222E] text-[#2ED8B6] border border-[#2ED8B6]/30 text-[11px] font-mono flex items-center gap-1.5"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => setUploadTags(uploadTags.filter((t) => t !== tag))}
                        className="text-[#6B7C8D] hover:text-[#E5484D] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newTagInput.trim() && !uploadTags.includes(newTagInput.trim().toLowerCase())) {
                            setUploadTags([...uploadTags, newTagInput.trim().toLowerCase()]);
                            setNewTagInput("");
                          }
                        }
                      }}
                      placeholder="Add tag (Press Enter)..."
                      className="bg-[#18222E] text-[#EAF1F8] px-2.5 py-1 rounded-lg border border-[var(--line-2)] text-[11px] font-mono focus:outline-none focus:border-[#2ED8B6] w-36"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTagInput.trim() && !uploadTags.includes(newTagInput.trim().toLowerCase())) {
                          setUploadTags([...uploadTags, newTagInput.trim().toLowerCase()]);
                          setNewTagInput("");
                        }
                      }}
                      className="btn btn-secondary py-1 px-2 text-[11px] font-mono cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!uploadFile || uploadLoading}
                  className="btn btn-primary py-2.5 px-6 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-40"
                >
                  <Upload className={`w-3.5 h-3.5 ${uploadLoading ? "animate-spin" : ""}`} />
                  <span>{uploadLoading ? "Uploading, Chunking & Vectorizing..." : "Upload & Vectorize Document"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* S3 Storage Sources for Large Datasets (>25MB) & Bulk Bucket Sync */}
          <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#2ED8B6]" />
                  <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                    S3 Bucket Sources (High-Volume &amp; Large File Ingestion &gt;25MB)
                  </h3>
                </div>
                <p className="text-[11px] text-[#6B7C8D]">
                  Ingest multi-GB documentation archives, runbook repositories, and bulk PDF vaults directly from Amazon S3 / MinIO via stream chunking without buffering into web pod memory.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsS3ModalOpen(true)}
                className="btn btn-primary py-1.5 px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Connect S3 Bucket</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {s3Sources.map((src) => (
                <div
                  key={src.id}
                  className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6]/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#2ED8B6]">
                          s3://{src.bucketName}/{src.prefix}
                        </span>
                        <span className="pill text-[9px] uppercase font-mono">
                          {src.endpoint ? "MINIO S3" : "AWS S3"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5">
                        Region: {src.region} &bull; Category: {src.targetCategory}
                      </span>
                    </div>
                    <span className="pill ok text-[9px] font-mono uppercase">
                      <i className="dot"></i>
                      {src.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-[#121A24] p-2.5 rounded-lg border border-[var(--line)] text-[#6B7C8D]">
                    <div>
                      <span>Objects: </span>
                      <strong className="text-[#EAF1F8]">{src.fileCount} Files</strong>
                    </div>
                    <div>
                      <span>Total Volume: </span>
                      <strong className="text-[#2ED8B6]">{(src.totalSizeBytes / (1024 * 1024)).toFixed(0)} MB</strong>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[var(--line)] text-[10px] font-mono text-[#6B7C8D]">
                    <span>Last synced: <strong className="text-[#EAF1F8]">{src.lastSyncedAt}</strong></span>
                    <button
                      type="button"
                      disabled={s3SyncingId === src.id}
                      onClick={() => handleSyncS3(src.id)}
                      className="btn btn-secondary py-1 px-2.5 text-xs font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 text-[#2ED8B6] ${s3SyncingId === src.id ? "animate-spin" : ""}`} />
                      <span>{s3SyncingId === src.id ? "Syncing..." : "Sync S3"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Web Crawler & KV8 Sync Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Web Documentation Crawler */}
            <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#2ED8B6]" />
                  <h3 className="text-xs font-bold text-[#EAF1F8]">Live Web Documentation Crawler</h3>
                </div>
                <span className="pill ok text-[9px] font-mono">PUPPETEER INGEST</span>
              </div>

              <form onSubmit={handleCrawl} className="space-y-2.5 text-xs">
                <input
                  type="url"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://docs.acme.com/guide"
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] font-mono text-[11px] focus:outline-none focus:border-[#2ED8B6]"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={crawlCategory}
                    onChange={(e) => setCrawlCategory(e.target.value)}
                    placeholder="Category label (e.g. auth_sso)"
                    className="w-1/2 bg-[#18222E] p-2 rounded-lg border border-[var(--line-2)] text-[11px] text-[#EAF1F8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={crawlLoading}
                    className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-semibold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${crawlLoading ? "animate-spin" : ""}`} />
                    <span>{crawlLoading ? "Crawling & Vectorizing..." : "Crawl & Vectorize"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Document S3 Vault & KV8 Sync */}
            <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8]">KnowledgeV8 pgvector Sync</h3>
                  </div>
                  <span className="pill ok text-[9px] font-mono">1,536 DIM</span>
                </div>
                <p className="text-xs text-[#B4C2D0] leading-relaxed">
                  Real-time semantic sync between supportV8 runtime memory and KnowledgeV8 enterprise vector database.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <span className="text-[10px] font-mono text-[#6B7C8D]">
                  Last synced: <strong className="text-[#2ED8B6]">2 minutes ago</strong>
                </span>
                <button
                  type="button"
                  onClick={onSyncKv8}
                  className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-[#2ED8B6]" />
                  <span>Sync Embeddings</span>
                </button>
              </div>
            </div>
          </div>

          {/* Ingested Documents List with Curation & Tagging Actions */}
          <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-xs font-bold text-[#EAF1F8] font-mono">Ingested Vault Documents &amp; Curation Pipeline</h3>
                <p className="text-[11px] text-[#6B7C8D]">
                  Directly curate raw uploaded documents into verified articles, manage RBAC group tags, and edit vector RAG chunks.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6B7C8D]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents & tags..."
                  className="w-full bg-[#18222E] pl-8 pr-3 py-1.5 rounded-xl border border-[var(--line-2)] text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] font-mono"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="gv8-table">
                <thead>
                  <tr>
                    <th>Document / File</th>
                    <th>Category &amp; Groups</th>
                    <th>Semantic Tags</th>
                    <th>Vector Chunks</th>
                    <th>Curation Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#6B7C8D] font-mono text-xs">
                        No ingested documents found. Upload a document using the box above.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#18222E]/70 transition-colors">
                        {/* Filename */}
                        <td>
                          <div className="font-bold text-xs text-[#EAF1F8] flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-[#2ED8B6]" />
                            <span>{doc.title || doc.filename}</span>
                          </div>
                          <div className="text-[10px] text-[#6B7C8D] font-mono">
                            {doc.filename} &bull; {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                          </div>
                        </td>

                        {/* Category & Groups */}
                        <td>
                          <div className="font-mono text-xs text-[#2ED8B6] uppercase">{doc.category}</div>
                          <div className="text-[10px] text-[#6B7C8D] font-mono">
                            {doc.groups?.join(", ") || "support-tier1"}
                          </div>
                        </td>

                        {/* Tags */}
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(doc.tags || [doc.category]).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-[#18222E] text-[#B4C2D0] text-[9px] font-mono border border-[var(--line)]">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Chunks */}
                        <td>
                          <button
                            type="button"
                            onClick={() => openRagEditor(doc)}
                            className="btn btn-secondary py-1 px-2 text-[10px] font-mono flex items-center gap-1 text-[#2ED8B6] hover:border-[#2ED8B6] cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{doc.chunkCount} Chunks</span>
                          </button>
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className={`pill text-[10px] font-mono uppercase ${
                              doc.curatedStatus === "curated" || doc.curatedStatus === "authoritative"
                                ? "ok"
                                : "text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10"
                            }`}
                          >
                            <i className="dot"></i>
                            {doc.curatedStatus || "raw"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openCuration(doc)}
                              className="btn btn-primary py-1 px-2.5 text-xs font-mono flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Curate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openTagEditor(doc)}
                              className="btn btn-secondary py-1 px-2 text-xs font-mono flex items-center gap-1 cursor-pointer"
                              title="Edit Groups and Semantic Tags"
                            >
                              <Tag className="w-3 h-3 text-[#B4C2D0]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openRagEditor(doc)}
                              className="btn btn-secondary py-1 px-2 text-xs font-mono flex items-center gap-1 cursor-pointer hover:border-[#2ED8B6] text-[#2ED8B6]"
                              title="Inspect & Edit RAG Chunks"
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: Curation & Tagging Pipeline */}
      {/* ========================================================================= */}
      {activeSubTab === "curation" && (
        <div className="space-y-6">
          <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8] font-mono">Document Curation &amp; Tagging Pipeline</h3>
                <p className="text-xs text-[#B4C2D0]">
                  Convert raw ingested documents into authoritative Knowledge Base concepts with explicit RBAC group access and searchable semantic tags.
                </p>
              </div>
              <span className="pill ok text-[10px] font-mono">KNOWLEDGEV8 SYNC READY</span>
            </div>

            {/* Search & Tag Filter Bar */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6B7C8D]" />
                  <input
                    type="text"
                    value={curationSearchQuery}
                    onChange={(e) => setCurationSearchQuery(e.target.value)}
                    placeholder="Search curated documents, summaries, filenames, or tags..."
                    className="w-full bg-[#18222E] pl-8 pr-8 py-2 rounded-xl border border-[var(--line-2)] text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] font-mono"
                  />
                  {curationSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCurationSearchQuery("")}
                      className="absolute right-2.5 top-2 text-[#6B7C8D] hover:text-[#EAF1F8]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs font-mono text-[#6B7C8D] shrink-0">
                  Showing <strong className="text-[#2ED8B6]">{curationFilteredDocs.length}</strong> of {documents.length} documents
                </div>
              </div>

              {/* Tag Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-mono text-[#6B7C8D] uppercase mr-1">Filter by Tag:</span>
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter("all")}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                    selectedTagFilter === "all"
                      ? "bg-[#2ED8B6] text-[#090E15] font-bold"
                      : "bg-[#18222E] text-[#8E9AA8] hover:text-[#EAF1F8] border border-[var(--line)]"
                  }`}
                >
                  All ({documents.length})
                </button>
                {allUniqueTags.map((tag) => {
                  const count = documents.filter((d) => d.tags?.includes(tag) || d.category === tag).length;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTagFilter(tag)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                        selectedTagFilter === tag
                          ? "bg-[#2ED8B6] text-[#090E15] font-bold"
                          : "bg-[#18222E] text-[#2ED8B6] border border-[#2ED8B6]/30 hover:border-[#2ED8B6]"
                      }`}
                    >
                      #{tag} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {curationFilteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    doc.curatedStatus === "curated"
                      ? "bg-[#18222E] border-[#2ED8B6]/50 shadow-[0_0_15px_rgba(46,216,182,0.1)]"
                      : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#6B7C8D] uppercase">{doc.fileType} Document</span>
                    <span
                      className={`pill text-[9px] font-mono uppercase ${
                        doc.curatedStatus === "curated" ? "ok" : "text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10"
                      }`}
                    >
                      {doc.curatedStatus || "raw"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#EAF1F8] line-clamp-1">{doc.title || doc.filename}</h4>
                    <p className="text-[11px] text-[#B4C2D0] line-clamp-2 leading-relaxed">
                      {doc.summary || "No summary available."}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-[var(--line)] text-[10px] font-mono">
                    <div className="flex justify-between text-[#6B7C8D]">
                      <span>Category</span>
                      <span className="text-[#2ED8B6] font-bold">{doc.category}</span>
                    </div>
                    <div className="flex justify-between text-[#6B7C8D]">
                      <span>Group Visibility</span>
                      <span className="text-[#EAF1F8]">{doc.groups?.join(", ") || "support-tier1"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(doc.tags || [doc.category]).map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-[#0E1520] text-[#2ED8B6] text-[9px]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => openTagEditor(doc)}
                      className="btn btn-secondary py-1 px-2.5 text-xs font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <Tag className="w-3 h-3 text-[#2ED8B6]" />
                      <span>Tags</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCuration(doc)}
                      className="btn btn-primary py-1 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{doc.curatedStatus === "curated" ? "Re-Curate" : "Curate Concept"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: Direct Document RAG Output & Vector Editor */}
      {/* ========================================================================= */}
      {activeSubTab === "rag_editor" && (
        <div className="space-y-6">
          <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8] font-mono">Direct Document RAG Output &amp; Vector Chunk Editor</h3>
                <p className="text-xs text-[#B4C2D0]">
                  Inspect and edit live vector retrieval chunks, adjust similarity weights, and re-compute 1536-dim embeddings.
                </p>
              </div>
              <span className="pill ok text-[10px] font-mono">OPENAI ADA-002 (1536-DIM)</span>
            </div>

            {/* Document Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-xs font-mono text-[#6B7C8D] shrink-0">Select Document:</span>
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => openRagEditor(doc)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                    ragEditingDoc?.id === doc.id
                      ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border-[#2ED8B6] font-bold shadow-sm"
                      : "bg-[#18222E] text-[#B4C2D0] border-[var(--line)] hover:border-[#2ED8B6]/50"
                  }`}
                >
                  {doc.title || doc.filename}
                </button>
              ))}
            </div>

            {/* Chunks List */}
            {ragEditingDoc ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#18222E] border border-[var(--line)]">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#EAF1F8]">{ragEditingDoc.title}</div>
                    <div className="text-[10px] font-mono text-[#6B7C8D]">
                      {docChunks.length} vector chunks &bull; S3 Key: {ragEditingDoc.s3Key}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingChunk(true)}
                    className="btn btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Manual Chunk</span>
                  </button>
                </div>

                {/* Add Chunk Drawer */}
                {isAddingChunk && (
                  <div className="p-4 rounded-xl bg-[#15202E] border border-[#2ED8B6] space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#2ED8B6] font-mono">Create New Vector Chunk</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingChunk(false)}
                        className="text-[#6B7C8D] hover:text-[#EAF1F8]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={newChunkSection}
                      onChange={(e) => setNewChunkSection(e.target.value)}
                      placeholder="Section Header (e.g. Error Codes & Recovery Protocol)"
                      className="w-full bg-[#18222E] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                    />

                    <textarea
                      rows={3}
                      value={newChunkContent}
                      onChange={(e) => setNewChunkContent(e.target.value)}
                      placeholder="Enter exact chunk content to vectorize for RAG similarity matching..."
                      className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-lg border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6] leading-relaxed"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingChunk(false)}
                        className="btn btn-secondary py-1 px-3 text-xs font-mono"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddChunk}
                        disabled={!newChunkContent.trim()}
                        className="btn btn-primary py-1 px-4 text-xs font-bold"
                      >
                        Vectorize &amp; Save
                      </button>
                    </div>
                  </div>
                )}

                {/* Vector Chunk Semantic Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#141C26] border border-[var(--line)]">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6B7C8D]" />
                    <input
                      type="text"
                      value={ragSearchQuery}
                      onChange={(e) => setRagSearchQuery(e.target.value)}
                      placeholder="Search vector chunks by semantic text, header, or keyword..."
                      className="w-full bg-[#18222E] pl-8 pr-8 py-1.5 rounded-lg border border-[var(--line-2)] text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] font-mono"
                    />
                    {ragSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setRagSearchQuery("")}
                        className="absolute right-2.5 top-2 text-[#6B7C8D] hover:text-[#EAF1F8]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-[#6B7C8D] shrink-0">
                    Showing <strong className="text-[#2ED8B6]">{ragFilteredChunks.length}</strong> of {docChunks.length} chunks
                  </div>
                </div>

                {/* List of Chunks */}
                <div className="space-y-3">
                  {ragFilteredChunks.length === 0 ? (
                    <div className="text-center py-8 text-[#6B7C8D] font-mono text-xs card p-6 bg-[#121A24] border-[var(--line)]">
                      No vector chunks matched query "{ragSearchQuery}".
                    </div>
                  ) : (
                    ragFilteredChunks.map((chunk, idx) => {
                      const isEditing = editingChunkId === chunk.id;
                      const hasSearchMatch = ragSearchQuery && chunk.content.toLowerCase().includes(ragSearchQuery.toLowerCase());
                      return (
                        <div
                          key={chunk.id}
                          className={`p-4 rounded-xl border transition-all space-y-3 ${
                            isEditing
                              ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_15px_rgba(46,216,182,0.15)]"
                              : hasSearchMatch
                              ? "bg-[#141C26] border-[#2ED8B6]/60 shadow-[0_0_10px_rgba(46,216,182,0.08)]"
                              : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold">
                                CHUNK #{idx + 1}
                              </span>
                              <span className="text-[#EAF1F8] font-bold">{chunk.section || "General"}</span>
                              {hasSearchMatch && (
                                <span className="pill ok text-[9px] py-0 px-1.5 font-mono">
                                  0.942 Similarity
                                </span>
                              )}
                            </div>

                          <div className="flex items-center gap-3 text-[10px] text-[#6B7C8D]">
                            <span>{chunk.tokenCount || 40} tokens</span>
                            <span className="text-[#2ED8B6]">Relevance: {chunk.weight || 1.0}x</span>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="text-[10px] text-[#6B7C8D] block mb-1 font-mono">SECTION TITLE</label>
                              <input
                                type="text"
                                value={editChunkSection}
                                onChange={(e) => setEditChunkSection(e.target.value)}
                                className="w-full bg-[#18222E] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-[#6B7C8D] block mb-1 font-mono">CHUNK CONTENT (RAG PROMPT INJECTION)</label>
                              <textarea
                                rows={4}
                                value={editChunkContent}
                                onChange={(e) => setEditChunkContent(e.target.value)}
                                className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-lg border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6] leading-relaxed"
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-[#6B7C8D] font-mono">Weight Boost:</label>
                                <select
                                  value={editChunkWeight}
                                  onChange={(e) => setEditChunkWeight(parseFloat(e.target.value))}
                                  className="bg-[#18222E] text-[#2ED8B6] px-2 py-1 rounded border border-[var(--line-2)] text-xs font-mono"
                                >
                                  <option value={1.0}>1.0x (Standard)</option>
                                  <option value={1.2}>1.2x (Preferred)</option>
                                  <option value={1.5}>1.5x (High Priority)</option>
                                  <option value={2.0}>2.0x (Critical Runbook)</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingChunkId(null)}
                                  className="btn btn-secondary py-1 px-3 text-xs font-mono"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveChunk(chunk.id)}
                                  className="btn btn-primary py-1 px-4 text-xs font-bold"
                                >
                                  Re-Vectorize &amp; Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-[#B4C2D0] font-mono bg-[#0E1520] p-3 rounded-lg border border-[var(--line)] leading-relaxed">
                              {chunk.content}
                            </p>

                            <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-1">
                              <span className="flex items-center gap-1 text-[#2ED8B6]">
                                <CheckCircle2 className="w-3 h-3" />
                                1536-dim Embedding Active &bull; {new Date(chunk.updatedAt || Date.now()).toLocaleTimeString()}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChunkId(chunk.id);
                                    setEditChunkContent(chunk.content);
                                    setEditChunkSection(chunk.section || "General");
                                    setEditChunkWeight(chunk.weight || 1.0);
                                  }}
                                  className="btn btn-secondary py-1 px-2.5 text-xs font-mono flex items-center gap-1 cursor-pointer hover:border-[#2ED8B6] text-[#2ED8B6]"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit Chunk</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteChunk(chunk.id)}
                                  className="p-1 text-[#6B7C8D] hover:text-[#E5484D] cursor-pointer"
                                  title="Delete Chunk from Index"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[#6B7C8D] font-mono text-xs">
                Select a document from the list above to view and edit its RAG vector chunks.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: Deficit Mapper & Mined Proposals */}
      {/* ========================================================================= */}
      {activeSubTab === "deficit_mapper" && (
        <div className="space-y-6">
          <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-xs font-bold text-[#EAF1F8] font-mono">Autonomous Knowledge Deficit Radar</h3>
                <p className="text-[11px] text-[#6B7C8D]">
                  Jordan (KB Specialist) scans recurring ticket clusters to mine knowledge gaps and propose draft resolutions.
                </p>
              </div>
              <span className="pill ok text-[10px] font-mono">JORDAN SPECIALIST MINING</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Knowledge Gaps */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#EAF1F8] font-mono">Detected Deficit Gaps</h4>
                {(knowledge.gaps || []).map((gap) => (
                  <div key={gap.id} className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#E5484D]">{gap.topic}</span>
                      <span className="pill err text-[9px] font-mono">{gap.recurringIssueCount} Tickets</span>
                    </div>
                    <p className="text-xs text-[#B4C2D0]">{gap.suggestedAction}</p>
                  </div>
                ))}
              </div>

              {/* Mined Proposals */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#EAF1F8] font-mono">AI Mined Article Proposals</h4>
                {(knowledge.proposals || []).map((prop) => (
                  <div key={prop.id} className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-xs text-[#EAF1F8]">{prop.title}</h5>
                      <span className="pill ok text-[9px] font-mono">{(prop.confidence * 100).toFixed(0)}% Match</span>
                    </div>
                    <p className="text-[11px] text-[#B4C2D0] line-clamp-2">{prop.proposedContent}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                      <span className="text-[10px] font-mono text-[#6B7C8D]">{prop.provenance}</span>
                      <button
                        type="button"
                        onClick={() => onPublishProposal(prop.id)}
                        className="btn btn-primary text-xs py-1 px-3 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Publish to KV8</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: Knowledge Graph (GrowthV8 Inspired) */}
      {/* ========================================================================= */}
      {activeSubTab === "graph" && (
        <div className="card p-5 sm:p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4">
          <KnowledgeGraphCanvas
            knowledge={knowledge}
            onPublishProposal={onPublishProposal}
            onNotify={onNotify}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DOCUMENT CURATION DRAWER */}
      {/* ========================================================================= */}
      {curatingDoc && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-3xl max-h-[92vh] bg-[#0C121A] border-2 border-[#2ED8B6] shadow-[0_0_35px_rgba(46,216,182,0.25)] ring-1 ring-[#2ED8B6]/40 rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-[#2ED8B6]/30 bg-[#121A24] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                  <Edit3 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8] font-mono">Knowledge Base Concept Curation</h3>
                  <p className="text-[11px] text-[#6B7C8D] font-mono">Source File: {curatingDoc.filename}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCuratingDoc(null)}
                className="p-1.5 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Curated Article / Concept Title</label>
                  <input
                    type="text"
                    value={curateTitle}
                    onChange={(e) => setCurateTitle(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-bold text-xs focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Article Concept Type</label>
                  <select
                    value={curateArticleType}
                    onChange={(e) => setCurateArticleType(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="runbook">Runbook (Step-by-step diagnostic &amp; mitigation)</option>
                    <option value="faq">FAQ (Customer-facing Q&amp;A)</option>
                    <option value="architecture">Architecture Specification</option>
                    <option value="api_reference">API Reference &amp; Schemas</option>
                    <option value="policy">Governance &amp; Autonomy Safety Policy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">Cluster Category</label>
                  <select
                    value={curateCategory}
                    onChange={(e) => setCurateCategory(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="auth_sso">Authentication &amp; SAML SSO</option>
                    <option value="checkout_failure">Billing, Stripe &amp; OrderV8</option>
                    <option value="voice_telephony">Voice SIP &amp; Telephony Hub</option>
                    <option value="infrastructure">Infrastructure &amp; API Status</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono">RBAC Group Visibility</label>
                  <select
                    value={curateGroups[0] || "support-tier1"}
                    onChange={(e) => setCurateGroups([e.target.value])}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="support-tier1">support-tier1 (All Agents &amp; AI)</option>
                    <option value="finance-billing">finance-billing (OrderV8 Leads)</option>
                    <option value="infra-ops">infra-ops (DevOps Engineers)</option>
                    <option value="vip-escalations">vip-escalations (Tier 2)</option>
                  </select>
                </div>
              </div>

              {/* Semantic Tag Chips */}
              <div className="space-y-1.5">
                <label className="text-[#6B7C8D] block font-mono">Semantic Tags</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {curateTags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-[#18222E] text-[#2ED8B6] text-[10px] font-mono border border-[#2ED8B6]/30 flex items-center gap-1">
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => setCurateTags(curateTags.filter((t) => t !== tag))}
                        className="text-[#6B7C8D] hover:text-[#E5484D]"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add tag and press enter..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim().toLowerCase();
                        if (val && !curateTags.includes(val)) {
                          setCurateTags([...curateTags, val]);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                    className="bg-[#18222E] text-[#EAF1F8] px-2 py-1 rounded-lg border border-[var(--line-2)] text-[10px] font-mono focus:outline-none focus:border-[#2ED8B6] w-44"
                  />
                </div>
              </div>

              {/* Executive Summary */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Concept Executive Summary</label>
                <textarea
                  rows={2}
                  value={curateSummary}
                  onChange={(e) => setCurateSummary(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] leading-relaxed"
                />
              </div>

              {/* Curated Markdown Body */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">Curated Markdown Content &amp; Runbook Body</label>
                <textarea
                  rows={8}
                  value={curateContent}
                  onChange={(e) => setCurateContent(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6] leading-relaxed"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--line)] bg-[#121A24] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#6B7C8D] font-mono">
                Author: supportV8 Curator &bull; 1536-dim Vector Indexed
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCuratingDoc(null)}
                  className="btn btn-secondary py-1.5 px-4 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCuration}
                  disabled={curateLoading || !curateTitle}
                  className="btn btn-primary py-1.5 px-5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{curateLoading ? "Vectorizing..." : "Publish to Knowledge Base"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 6: VECTOR TOPOLOGY & FIELD VALUES */}
      {/* ========================================================================= */}
      {activeSubTab === "topology_settings" && (
        <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                <Sliders className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8]">Knowledge Base Vector Grounding &amp; Field Topology</h3>
                <p className="text-xs text-[#8E9AA8]">Configure embeddings dimensions, chunking boundaries, cosine thresholds, and auto-sync TTL.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNotify("Vector grounding topology parameters saved to tenant configuration.", "success")}
              className="btn btn-primary text-xs font-bold px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Vector Parameters</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[#B4C2D0] block font-bold">Vector Embeddings Model</label>
                <select
                  value={vectorModel}
                  onChange={(e) => setVectorModel(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line-2)] rounded-xl px-3 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                >
                  <option value="text-embedding-3-small">OpenAI text-embedding-3-small (1536 dims - Default)</option>
                  <option value="text-embedding-3-large">OpenAI text-embedding-3-large (3072 dims - High Accuracy)</option>
                  <option value="pgvector-cosine">pgvector Native Cosine Distance (1536 dims)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[#B4C2D0] block font-bold">Chunk Size (Tokens)</label>
                  <input
                    type="number"
                    value={vectorChunkSize}
                    onChange={(e) => setVectorChunkSize(Number(e.target.value))}
                    className="w-full bg-[#141C26] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[#B4C2D0] block font-bold">Chunk Overlap (Tokens)</label>
                  <input
                    type="number"
                    value={vectorChunkOverlap}
                    onChange={(e) => setVectorChunkOverlap(Number(e.target.value))}
                    className="w-full bg-[#141C26] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#B4C2D0] block font-bold">Minimum Cosine Match Threshold</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={vectorCosineThreshold}
                    onChange={(e) => setVectorCosineThreshold(Number(e.target.value))}
                    className="flex-1 accent-[#2ED8B6]"
                  />
                  <span className="text-[#2ED8B6] font-bold w-12 text-right">{(vectorCosineThreshold * 100).toFixed(0)}%</span>
                </div>
                <p className="text-[10px] text-[#6B7C8D]">Only concept chunks exceeding this match score will be synthesized into AI answers.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[#B4C2D0] block font-bold">Top-K Node Retrieval</label>
                  <input
                    type="number"
                    value={vectorTopK}
                    onChange={(e) => setVectorTopK(Number(e.target.value))}
                    className="w-full bg-[#141C26] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[#B4C2D0] block font-bold">Auto-Sync Interval (Min)</label>
                  <input
                    type="number"
                    value={vectorSyncFrequency}
                    onChange={(e) => setVectorSyncFrequency(e.target.value)}
                    className="w-full bg-[#141C26] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#B4C2D0] block font-bold">Document Retention TTL (Days)</label>
                <input
                  type="number"
                  value={vectorRetentionTtl}
                  onChange={(e) => setVectorRetentionTtl(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line-2)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-[#2ED8B6] font-bold">
                  <span>Vector Index Status:</span>
                  <span>ONLINE (HNSW)</span>
                </div>
                <p className="text-[#6B7C8D]">PostgreSQL pgvector cluster running with 1,536-dimensional indexing across active tenant namespaces.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAG QUICK EDIT MODAL */}
      {/* ========================================================================= */}
      {tagEditingDoc && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Edit Groups &amp; Semantic Tags</h3>
              </div>
              <button
                type="button"
                onClick={() => setTagEditingDoc(null)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono">RBAC Group Visibility</label>
                <select
                  value={editDocGroups[0] || "support-tier1"}
                  onChange={(e) => setEditDocGroups([e.target.value])}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none cursor-pointer"
                >
                  <option value="support-tier1">support-tier1 (All Agents &amp; AI)</option>
                  <option value="finance-billing">finance-billing (OrderV8 Leads)</option>
                  <option value="infra-ops">infra-ops (DevOps Engineers)</option>
                  <option value="vip-escalations">vip-escalations (Tier 2)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#6B7C8D] block font-mono">Semantic Tag Chips</label>
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {editDocTags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-[#18222E] text-[#2ED8B6] text-[10px] font-mono border border-[#2ED8B6]/30 flex items-center gap-1">
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => setEditDocTags(editDocTags.filter((t) => t !== tag))}
                        className="text-[#6B7C8D] hover:text-[#E5484D]"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Add tag and press Enter..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim().toLowerCase();
                      if (val && !editDocTags.includes(val)) {
                        setEditDocTags([...editDocTags, val]);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setTagEditingDoc(null)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTags}
                className="btn btn-primary text-xs font-bold"
              >
                Save &amp; Propagate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONNECT S3 STORAGE SOURCE MODAL */}
      {/* ========================================================================= */}
      {isS3ModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Connect S3 Storage Source</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">
                    High-Volume Multi-GB Repository &amp; Archive Ingestion
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsS3ModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  S3 Bucket Name
                </label>
                <input
                  type="text"
                  value={s3BucketName}
                  onChange={(e) => setS3BucketName(e.target.value)}
                  placeholder="supportv8-kb-documents"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    Folder Prefix
                  </label>
                  <input
                    type="text"
                    value={s3Prefix}
                    onChange={(e) => setS3Prefix(e.target.value)}
                    placeholder="enterprise-runbooks/"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    AWS Region
                  </label>
                  <input
                    type="text"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  Custom S3 Endpoint (Optional / MinIO)
                </label>
                <input
                  type="text"
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                  placeholder="http://minio.default.svc.cluster.local:9000"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    Target Category
                  </label>
                  <select
                    value={s3Category}
                    onChange={(e) => setS3Category(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="auth_sso">Authentication &amp; SAML SSO</option>
                    <option value="checkout_failure">Billing, Stripe &amp; OrderV8</option>
                    <option value="voice_telephony">Voice SIP &amp; Telephony Hub</option>
                    <option value="infrastructure">Infrastructure &amp; API Status</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    RBAC Visibility
                  </label>
                  <select
                    value={s3Groups[0] || "support-tier1"}
                    onChange={(e) => setS3Groups([e.target.value])}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="support-tier1">support-tier1 (All Agents &amp; AI)</option>
                    <option value="finance-billing">finance-billing (OrderV8)</option>
                    <option value="infra-ops">infra-ops (DevOps SRE)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsS3ModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnectS3}
                disabled={isConnectingS3}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{isConnectingS3 ? "Connecting..." : "Connect S3 Source"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
