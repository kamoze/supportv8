"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  Brain,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Shield,
  X,
  FileText,
  Database,
  Globe,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type {
  KnowledgeArticle,
  KnowledgeGap,
  KnowledgeProposal,
  KnowledgeDocument,
  KnowledgeWebSource,
} from "@/lib/types";

interface KnowledgeGraphCanvasProps {
  knowledge: {
    articles: KnowledgeArticle[];
    gaps: KnowledgeGap[];
    proposals: KnowledgeProposal[];
    documents?: KnowledgeDocument[];
    webSources?: KnowledgeWebSource[];
  };
  onPublishProposal?: (proposalId: string) => void;
  onNotify?: (text: string, type?: "success" | "error" | "info") => void;
}

interface SatelliteNode {
  id: string;
  title: string;
  type: "article" | "document" | "web_source" | "proposal" | "gap";
  category: string;
  color: string;
  dx: number;
  dy: number;
  size: number;
  meta: any;
}

interface ClusterCore {
  id: string;
  title: string;
  category: string;
  color: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  discRad: number;
  open: number;
  pinned: boolean;
  fixed?: boolean;
  members: SatelliteNode[];
  memberById: Record<string, SatelliteNode>;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function KnowledgeGraphCanvas({
  knowledge,
  onPublishProposal,
  onNotify,
}: KnowledgeGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<"topology" | "lifecycle">("topology");
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [hoverNode, setHoverNode] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Life-cycle trace state
  const [litLifecycleNode, setLitLifecycleNode] = useState<string | null>(null);

  // Build cluster topology from knowledge data
  const clusterData = useMemo(() => {
    const articles = knowledge.articles || [];
    const docs = knowledge.documents || [];
    const webs = knowledge.webSources || [];
    const proposals = knowledge.proposals || [];
    const gaps = knowledge.gaps || [];

    const clusters: Record<string, { title: string; color: string; members: SatelliteNode[] }> = {
      auth_sso: {
        title: "Authentication & enterprise SSO",
        color: "#4D9FFF",
        members: [],
      },
      billing: {
        title: "Billing, Stripe & OrderV8",
        color: "#2ED8B6",
        members: [],
      },
      telephony: {
        title: "Telephony & Voice SIP Hub",
        color: "#F5A623",
        members: [],
      },
      infrastructure: {
        title: "Infrastructure & API Status",
        color: "#9085e9",
        members: [],
      },
      deficits: {
        title: "Knowledge Deficit Radar",
        color: "#E5484D",
        members: [],
      },
    };

    // Distribute Articles
    articles.forEach((art) => {
      let cKey = "billing";
      if (art.category.includes("auth") || art.title.toLowerCase().includes("sso") || art.title.toLowerCase().includes("keycloak")) cKey = "auth_sso";
      else if (art.category.includes("voice") || art.title.toLowerCase().includes("sip") || art.title.toLowerCase().includes("twilio")) cKey = "telephony";
      else if (art.category.includes("infra") || art.title.toLowerCase().includes("status")) cKey = "infrastructure";

      clusters[cKey].members.push({
        id: art.id,
        title: art.title,
        type: "article",
        category: art.category,
        color: clusters[cKey].color,
        dx: 0,
        dy: 0,
        size: 3.5,
        meta: art,
      });
    });

    // Distribute Documents
    docs.forEach((doc) => {
      let cKey = "infrastructure";
      if (doc.category.includes("auth")) cKey = "auth_sso";
      else if (doc.category.includes("bill") || doc.category.includes("checkout")) cKey = "billing";

      clusters[cKey].members.push({
        id: doc.id,
        title: doc.title,
        type: "document",
        category: doc.category,
        color: "#38BDF8",
        dx: 0,
        dy: 0,
        size: 4,
        meta: doc,
      });
    });

    // Distribute Web Sources
    webs.forEach((web) => {
      let cKey = "billing";
      if (web.category.includes("auth")) cKey = "auth_sso";
      else if (web.category.includes("infra")) cKey = "infrastructure";

      clusters[cKey].members.push({
        id: web.id,
        title: web.title,
        type: "web_source",
        category: web.category,
        color: "#A78BFA",
        dx: 0,
        dy: 0,
        size: 3.8,
        meta: web,
      });
    });

    // Distribute Proposals
    proposals.forEach((prop) => {
      clusters["deficits"].members.push({
        id: prop.id,
        title: prop.title,
        type: "proposal",
        category: "proposed_resolution",
        color: "#2ED8B6",
        dx: 0,
        dy: 0,
        size: 3.5,
        meta: prop,
      });
    });

    // Distribute Gaps
    gaps.forEach((gap) => {
      clusters["deficits"].members.push({
        id: gap.id,
        title: gap.topic,
        type: "gap",
        category: "deficit_gap",
        color: "#E5484D",
        dx: 0,
        dy: 0,
        size: 4.5,
        meta: gap,
      });
    });

    return clusters;
  }, [knowledge]);

  // Canvas Force Simulation Loop
  useEffect(() => {
    if (viewMode !== "topology") return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let dashPhase = 0;

    // Viewport transform
    let scale = 1.0;
    let ox = cv.clientWidth / 2;
    let oy = cv.clientHeight / 2;

    // Setup Root Node
    const rootNode = {
      id: "__root__",
      title: "supportV8 Knowledge Vault",
      color: "#2ED8B6",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fixed: true,
      discRad: 18,
    };

    // Setup Cluster Cores with Golden Spiral Satellites
    const clusterEntries = Object.entries(clusterData);
    const clusterCores: ClusterCore[] = clusterEntries.map(([key, data], idx) => {
      const angle = (idx / clusterEntries.length) * Math.PI * 2;
      const dist = 180;
      const count = data.members.length;
      const discRad = 16 + Math.sqrt(count) * 8.5;

      const members = data.members.map((m, k) => {
        const rr = discRad * Math.sqrt((k + 0.5) / Math.max(1, count));
        const th = k * GOLDEN;
        return {
          ...m,
          dx: Math.cos(th) * rr,
          dy: Math.sin(th) * rr,
        };
      });

      const memberById: Record<string, SatelliteNode> = {};
      members.forEach((mm) => {
        memberById[mm.id] = mm;
      });

      return {
        id: `core_${key}`,
        title: data.title,
        category: key,
        color: data.color,
        count: members.length,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        discRad: 12 + Math.min(14, Math.sqrt(count) * 1.5),
        open: 1.0,
        pinned: true,
        fixed: false,
        members,
        memberById,
      };
    });

    const allNodes: any[] = [rootNode, ...clusterCores];

    // Coordinate transforms
    function toScreen(n: { x: number; y: number }) {
      return { x: n.x * scale + ox, y: n.y * scale + oy };
    }
    function toWorld(px: number, py: number) {
      return { x: (px - ox) / scale, y: (py - oy) / scale };
    }

    // Physics step
    function step() {
      if (isPaused) return;

      const REPULSE = 3200;
      const CENTER_PULL = 0.004;
      const DAMP = 0.85;

      for (let i = 0; i < allNodes.length; i++) {
        const a = allNodes[i];
        if (a.fixed) continue;
        let fx = 0;
        let fy = 0;

        for (let j = 0; j < allNodes.length; j++) {
          if (i === j) continue;
          const b = allNodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.1;
          const d = Math.sqrt(d2);
          const f = (REPULSE / Math.max(400, d2)) * 5;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }

        // Pull to center
        fx -= a.x * CENTER_PULL;
        fy -= a.y * CENTER_PULL;

        // Spring connection to Root
        const dxR = -a.x;
        const dyR = -a.y;
        const distR = Math.sqrt(dxR * dxR + dyR * dyR) + 0.1;
        const springF = 0.015 * (distR - 190);
        fx += (dxR / distR) * springF;
        fy += (dyR / distR) * springF;

        a.vx = (a.vx + fx) * DAMP;
        a.vy = (a.vy + fy) * DAMP;
        a.x += a.vx;
        a.y += a.vy;
      }
    }

    // Render loop
    function render() {
      if (!cv || !ctx) return;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      const DPR = Math.min(window.devicePixelRatio || 1, 2);

      if (cv.width !== W * DPR || cv.height !== H * DPR) {
        cv.width = W * DPR;
        cv.height = H * DPR;
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      step();

      // Animate flowing lines
      dashPhase = (dashPhase + 0.4) % 14;

      // Draw Edges from Root to Cluster Cores
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -dashPhase;

      const sRoot = toScreen(rootNode);

      clusterCores.forEach((core) => {
        const sCore = toScreen(core);
        ctx.strokeStyle = `${core.color}55`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sRoot.x, sRoot.y);
        ctx.lineTo(sCore.x, sCore.y);
        ctx.stroke();

        // Draw spokes to expanded satellites
        if (core.open > 0.1) {
          ctx.strokeStyle = `${core.color}22`;
          ctx.lineWidth = 1;
          core.members.forEach((m) => {
            const sm = toScreen({
              x: core.x + m.dx * core.open,
              y: core.y + m.dy * core.open,
            });
            ctx.beginPath();
            ctx.moveTo(sCore.x, sCore.y);
            ctx.lineTo(sm.x, sm.y);
            ctx.stroke();
          });
        }
      });

      ctx.setLineDash([]);

      // Draw Satellite Nodes
      clusterCores.forEach((core) => {
        core.members.forEach((m) => {
          const sm = toScreen({
            x: core.x + m.dx * core.open,
            y: core.y + m.dy * core.open,
          });

          // Glow on hover or select
          const isHovered = hoverNode && hoverNode.id === m.id;
          const isSelected = selectedNode && selectedNode.id === m.id;

          if (isHovered || isSelected) {
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, m.size * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `${m.color}44`;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(sm.x, sm.y, m.size, 0, Math.PI * 2);
          ctx.fillStyle = m.color;
          ctx.fill();
          ctx.strokeStyle = "#0B1017";
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      });

      // Draw Cluster Cores
      clusterCores.forEach((core) => {
        const sCore = toScreen(core);
        const rad = core.discRad;

        // Outer glow
        ctx.beginPath();
        ctx.arc(sCore.x, sCore.y, rad + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${core.color}20`;
        ctx.fill();

        // Core Circle
        ctx.beginPath();
        ctx.arc(sCore.x, sCore.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = "#121A24";
        ctx.fill();
        ctx.strokeStyle = core.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Badge count inside
        ctx.font = "bold 10px ui-monospace, monospace";
        ctx.fillStyle = "#EAF1F8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(core.count), sCore.x, sCore.y);

        // Core label below
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#B4C2D0";
        ctx.fillText(core.title, sCore.x, sCore.y + rad + 14);
      });

      // Draw Root Node
      ctx.beginPath();
      ctx.arc(sRoot.x, sRoot.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#2ED8B615";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sRoot.x, sRoot.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#121A24";
      ctx.fill();
      ctx.strokeStyle = "#2ED8B6";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sRoot.x, sRoot.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#2ED8B6";
      ctx.fill();

      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#EAF1F8";
      ctx.textAlign = "center";
      ctx.fillText("supportV8 Vault", sRoot.x, sRoot.y + 32);

      animId = requestAnimationFrame(render);
    }

    render();

    // Mouse Interaction Handlers
    let isDragging = false;
    let dragNode: any = null;
    let startPos = { x: 0, y: 0 };
    let hasMoved = false;

    function onMouseDown(e: MouseEvent) {
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      startPos = { x: mx, y: my };
      hasMoved = false;
      isDragging = true;

      // Hit test cores and satellites
      const hit = findHitNode(mx, my);
      if (hit) {
        dragNode = hit;
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (isDragging) {
        const dx = mx - startPos.x;
        const dy = my - startPos.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;

        if (dragNode && !dragNode.fixed) {
          const wPos = toWorld(mx, my);
          dragNode.x = wPos.x;
          dragNode.y = wPos.y;
          dragNode.vx = 0;
          dragNode.vy = 0;
        } else if (!dragNode) {
          ox += dx;
          oy += dy;
          startPos = { x: mx, y: my };
        }
      } else {
        // Hover detection
        const hit = findHitNode(mx, my);
        setHoverNode(hit);
        if (hit) {
          setTooltipPos({ x: e.clientX, y: e.clientY });
        } else {
          setTooltipPos(null);
        }
      }
    }

    function onMouseUp(e: MouseEvent) {
      isDragging = false;
      if (!hasMoved && dragNode) {
        setSelectedNode(dragNode);
      }
      dragNode = null;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      scale = Math.max(0.4, Math.min(2.5, scale * zoomFactor));
    }

    function findHitNode(mx: number, my: number) {
      // Check Root
      const sRoot = toScreen(rootNode);
      if (Math.hypot(mx - sRoot.x, my - sRoot.y) < 22) return rootNode;

      // Check Cluster Cores
      for (const core of clusterCores) {
        const sCore = toScreen(core);
        if (Math.hypot(mx - sCore.x, my - sCore.y) < core.discRad + 4) return core;

        // Check Satellites
        if (core.open > 0.1) {
          for (const m of core.members) {
            const sm = toScreen({
              x: core.x + m.dx * core.open,
              y: core.y + m.dy * core.open,
            });
            if (Math.hypot(mx - sm.x, my - sm.y) < m.size + 4) return m;
          }
        }
      }
      return null;
    }

    cv.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    cv.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      cv.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      cv.removeEventListener("wheel", onWheel);
    };
  }, [clusterData, viewMode, isPaused]);

  return (
    <div ref={containerRef} className="space-y-4">
      {/* View Mode & Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#18222E] p-1 rounded-xl border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setViewMode("topology")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                viewMode === "topology"
                  ? "bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold border border-[#2ED8B6]/40 shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                <span>Cluster Topology</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("lifecycle")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                viewMode === "lifecycle"
                  ? "bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold border border-[#2ED8B6]/40 shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Life-Cycle Trace Flow</span>
              </span>
            </button>
          </div>

          <span className="pill ok text-[10px] font-mono hidden md:inline-flex">
            OPENAI ADA-002 (1536-DIM)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {viewMode === "topology" && (
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="btn btn-secondary p-2 text-xs font-mono cursor-pointer"
              title={isPaused ? "Resume Physics Simulation" : "Pause Physics Simulation"}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-[#4CC38A]" /> : <Pause className="w-3.5 h-3.5 text-[#F5A623]" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="btn btn-secondary p-2 text-xs font-mono cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: CLUSTER TOPOLOGY (FORCE GRAPH CANVAS) */}
      {viewMode === "topology" && (
        <div className={`relative w-full rounded-2xl bg-[#0A111F] border border-[var(--line-2)] overflow-hidden ${isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen" : "h-[540px]"}`}>
          {/* HTML5 Force Canvas */}
          <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing touch-none" />

          {/* Interactive Legend */}
          <div className="absolute top-3 left-4 z-10 flex flex-wrap gap-3 font-mono text-[11px] text-[#6B7C8D] bg-[#0A111F]/85 p-2 rounded-xl border border-[var(--line)] backdrop-blur-sm pointer-events-none">
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[#2ED8B6] inline-block" />
              <span>Billing &amp; Stripe</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[#4D9FFF] inline-block" />
              <span>Auth &amp; SAML</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[#F5A623] inline-block" />
              <span>Voice SIP</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[#9085e9] inline-block" />
              <span>Infrastructure</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[#E5484D] inline-block" />
              <span>Deficit Gap</span>
            </span>
          </div>

          {/* Canvas Hint */}
          <div className="absolute bottom-3 left-4 z-10 font-mono text-[10px] text-[#6B7C8D] bg-[#0A111F]/80 px-2.5 py-1 rounded-lg border border-[var(--line)] pointer-events-none">
            Drag to pan &bull; Scroll to zoom &bull; Click node to inspect details
          </div>

          {/* Hover Tooltip */}
          {hoverNode && tooltipPos && (
            <div
              style={{
                position: "fixed",
                left: `${tooltipPos.x + 12}px`,
                top: `${tooltipPos.y - 12}px`,
                pointerEvents: "none",
                zIndex: 40,
              }}
              className="bg-[#0C121A] border border-[#2ED8B6] rounded-xl p-3 shadow-2xl max-w-xs text-xs space-y-1 backdrop-blur-md"
            >
              <div className="font-bold text-[#EAF1F8]">{hoverNode.title}</div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7C8D]">
                <span className="uppercase text-[#2ED8B6]">{hoverNode.type || "CLUSTER HUB"}</span>
                {hoverNode.count !== undefined && <span>{hoverNode.count} items</span>}
              </div>
            </div>
          )}

          {/* Slide-Out Side Detail Panel (kg-panel) */}
          {selectedNode && (
            <div className="absolute top-0 right-0 bottom-0 w-80 max-w-[85%] z-30 bg-[#0E1520] border-l border-[#2ED8B6]/40 p-5 overflow-y-auto space-y-4 shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <span className="text-[10px] font-mono text-[#2ED8B6] uppercase tracking-wider">
                  {selectedNode.type || "CLUSTER CORE"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[#EAF1F8]">{selectedNode.title}</h3>
                <span className="pill ok text-[10px] font-mono uppercase">
                  {selectedNode.category || "General"}
                </span>
              </div>

              {/* Node Metadata */}
              <div className="space-y-2 p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] text-xs font-mono">
                {selectedNode.meta?.chunkCount && (
                  <div className="flex justify-between">
                    <span className="text-[#6B7C8D]">Vector Chunks</span>
                    <span className="text-[#2ED8B6] font-bold">{selectedNode.meta.chunkCount} chunks</span>
                  </div>
                )}
                {selectedNode.meta?.usageCount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-[#6B7C8D]">Resolution Usage</span>
                    <span className="text-[#EAF1F8] font-bold">{selectedNode.meta.usageCount}x</span>
                  </div>
                )}
                {selectedNode.meta?.csatScore && (
                  <div className="flex justify-between">
                    <span className="text-[#6B7C8D]">CSAT Rating</span>
                    <span className="text-[#4CC38A] font-bold">{selectedNode.meta.csatScore}%</span>
                  </div>
                )}
                {selectedNode.meta?.s3SnapshotUrl && (
                  <div className="space-y-1 pt-1 border-t border-[var(--line)]">
                    <span className="text-[#6B7C8D] text-[10px]">S3 SNAPSHOT</span>
                    <div className="text-[10px] text-[#2ED8B6] truncate">{selectedNode.meta.s3SnapshotUrl}</div>
                  </div>
                )}
              </div>

              {/* Summary / Body */}
              {(selectedNode.meta?.summary || selectedNode.meta?.proposedContent || selectedNode.meta?.suggestedAction) && (
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Summary / Context</span>
                  <p className="text-[11px] text-[#B4C2D0] leading-relaxed p-3 rounded-xl bg-[#121A24] border border-[var(--line)]">
                    {selectedNode.meta?.summary || selectedNode.meta?.proposedContent || selectedNode.meta?.suggestedAction}
                  </p>
                </div>
              )}

              {/* Direct Actions */}
              <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                {selectedNode.type === "proposal" && onPublishProposal && (
                  <button
                    type="button"
                    onClick={() => {
                      onPublishProposal(selectedNode.id);
                      setSelectedNode(null);
                    }}
                    className="btn btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Publish to KnowledgeV8</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onNotify) onNotify(`RAG queried with topic: ${selectedNode.title}`, "info");
                  }}
                  className="btn btn-secondary w-full py-2 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer hover:border-[#2ED8B6] text-[#2ED8B6]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Query RAG Embedding</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: LIFE-CYCLE TRACE FLOW (SVG MAP) */}
      {viewMode === "lifecycle" && (
        <div className="relative w-full rounded-2xl bg-[#0A111F] border border-[var(--line-2)] p-6 overflow-x-auto min-h-[500px]">
          <div className="min-w-[760px] space-y-6">
            <div className="grid grid-cols-4 gap-4 text-center font-mono text-[11px] text-[#6B7C8D] uppercase tracking-wider border-b border-[var(--line)] pb-3">
              <div>1. Ingress Sources</div>
              <div>2. Semantic Concepts</div>
              <div>3. AI Curators</div>
              <div>4. Resolution Targets</div>
            </div>

            {/* SVG Interactive Multi-Stage Flow */}
            <div className="grid grid-cols-4 gap-6 relative">
              {/* Column 1: Sources */}
              <div className="space-y-3">
                {[
                  { id: "src_s3", label: "S3 Document Vault", type: "Storage Ingest", color: "#38BDF8" },
                  { id: "src_web", label: "Web Portal Crawler", type: "Docs Scraper", color: "#A78BFA" },
                  { id: "src_voice", label: "Twilio Voice Audio", type: "IVR SIP Mesh", color: "#F5A623" },
                  { id: "src_tickets", label: "Zendesk & Slack Feed", type: "Ticket Ingress", color: "#2ED8B6" },
                ].map((src) => {
                  const isLit = litLifecycleNode === src.id;
                  return (
                    <div
                      key={src.id}
                      onMouseEnter={() => setLitLifecycleNode(src.id)}
                      onMouseLeave={() => setLitLifecycleNode(null)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isLit
                          ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_15px_rgba(46,216,182,0.2)] scale-[1.02]"
                          : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/50"
                      }`}
                    >
                      <div className="text-xs font-bold text-[#EAF1F8]">{src.label}</div>
                      <div className="text-[10px] font-mono text-[#6B7C8D]">{src.type}</div>
                    </div>
                  );
                })}
              </div>

              {/* Column 2: Concepts */}
              <div className="space-y-3">
                {[
                  { id: "c_auth", label: "SSO & SAML Token Auth", color: "#4D9FFF" },
                  { id: "c_bill", label: "OrderV8 Refund Policy", color: "#2ED8B6" },
                  { id: "c_voice", label: "Voice Acoustic Triage", color: "#F5A623" },
                  { id: "c_infra", label: "Stripe Webhook Latency", color: "#9085e9" },
                ].map((c) => {
                  const isLit = litLifecycleNode === c.id;
                  return (
                    <div
                      key={c.id}
                      onMouseEnter={() => setLitLifecycleNode(c.id)}
                      onMouseLeave={() => setLitLifecycleNode(null)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isLit
                          ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_15px_rgba(46,216,182,0.2)] scale-[1.02]"
                          : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/50"
                      }`}
                    >
                      <div className="text-xs font-bold text-[#EAF1F8]">{c.label}</div>
                      <div className="text-[10px] font-mono text-[#2ED8B6]">pgvector 1536-dim</div>
                    </div>
                  );
                })}
              </div>

              {/* Column 3: AI Curators */}
              <div className="space-y-3">
                {[
                  { id: "emp_jordan", name: "Jordan (KB Specialist)", role: "Deficit Mining", avatar: "/avatars/beaver-curator.jpg" },
                  { id: "emp_alex", name: "Alex (Support Lead)", role: "Autonomous Resolution", avatar: "/avatars/beaver-manager.jpg" },
                  { id: "emp_maya", name: "Maya (Incident Analyst)", role: "Blast Radius Analysis", avatar: "/avatars/beaver-analyst.jpg" },
                  { id: "emp_eleanor", name: "Eleanor (Governance)", role: "Safety Auditing", avatar: "/avatars/beaver-eleanor.jpg" },
                ].map((emp) => {
                  const isLit = litLifecycleNode === emp.id;
                  return (
                    <div
                      key={emp.id}
                      onMouseEnter={() => setLitLifecycleNode(emp.id)}
                      onMouseLeave={() => setLitLifecycleNode(null)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                        isLit
                          ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_15px_rgba(46,216,182,0.2)] scale-[1.02]"
                          : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/50"
                      }`}
                    >
                      <img src={emp.avatar} alt={emp.name} className="w-7 h-7 rounded-lg object-cover border border-[var(--line)]" />
                      <div>
                        <div className="text-xs font-bold text-[#EAF1F8]">{emp.name.split("(")[0]}</div>
                        <div className="text-[10px] font-mono text-[#6B7C8D]">{emp.role}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Column 4: Outcomes */}
              <div className="space-y-3">
                {[
                  { id: "out_rag", label: "Live pgvector RAG Hit", badge: "74.8% VARR", color: "#4CC38A" },
                  { id: "out_pub", label: "KnowledgeV8 Published", badge: "Chain-Synced", color: "#2ED8B6" },
                  { id: "out_action", label: "Autonomous $49 Refund", badge: "OrderV8 Executed", color: "#4D9FFF" },
                  { id: "out_tier2", label: "Tier 2 Warm Handoff", badge: "Token Routed", color: "#F5A623" },
                ].map((out) => {
                  const isLit = litLifecycleNode === out.id;
                  return (
                    <div
                      key={out.id}
                      onMouseEnter={() => setLitLifecycleNode(out.id)}
                      onMouseLeave={() => setLitLifecycleNode(null)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isLit
                          ? "bg-[#18222E] border-[#2ED8B6] shadow-[0_0_15px_rgba(46,216,182,0.2)] scale-[1.02]"
                          : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/50"
                      }`}
                    >
                      <div className="text-xs font-bold text-[#EAF1F8]">{out.label}</div>
                      <div className="text-[10px] font-mono text-[#4CC38A]">{out.badge}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
