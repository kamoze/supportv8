"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Bot,
  Zap,
  ArrowRight,
  Database,
  Sparkles,
  Lock,
  Headphones,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  Globe,
  Star,
  ExternalLink,
  Users,
  HardHat,
  HelpCircle,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

interface GlobalLandingViewProps {
  onEnterCockpit: () => void;
  onOpenTenantPortal: (slug?: string) => void;
  onOpenSignup: () => void;
}

export function GlobalLandingView({
  onEnterCockpit,
  onOpenTenantPortal,
  onOpenSignup,
}: GlobalLandingViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeDemoTab, setActiveDemoTab] = useState<"omnichannel" | "knowledge" | "governance">("omnichannel");

  // GrowthV8-inspired interactive signal particle network
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let w = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let h = (canvas.height = canvas.parentElement?.clientHeight || 650);

    const PALETTE = [
      { r: 46, g: 216, b: 182, hex: "#2ED8B6" }, // Teal
      { r: 77, g: 159, b: 255, hex: "#4D9FFF" }, // Blue
      { r: 245, g: 166, b: 35, hex: "#F5A623" }, // Amber
      { r: 52, g: 211, b: 153, hex: "#34D399" }, // Emerald
    ];

    interface ParticleNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseRadius: number;
      color: (typeof PALETTE)[0];
      isHub: boolean;
    }

    interface Packet {
      from: number;
      to: number;
      progress: number;
      speed: number;
      color: string;
    }

    const nodeCount = Math.max(16, Math.min(36, Math.floor(w / 45)));
    const nodes: ParticleNode[] = [];
    const packets: Packet[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        baseRadius: i % 6 === 0 ? 3.5 : 1.8,
        color: PALETTE[i % PALETTE.length],
        isHub: i % 6 === 0,
      });
    }

    for (let p = 0; p < 10; p++) {
      packets.push({
        from: Math.floor(Math.random() * nodes.length),
        to: Math.floor(Math.random() * nodes.length),
        progress: Math.random(),
        speed: 0.004 + Math.random() * 0.006,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)].hex,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      w = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.height = canvas.parentElement?.clientHeight || 650;
    };
    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, w, h);

      // Update and draw node links
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        n1.x += n1.vx;
        n1.y += n1.vy;
        if (n1.x < 0 || n1.x > w) n1.vx *= -1;
        if (n1.y < 0 || n1.y > h) n1.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          if (dist < 150) {
            ctx.strokeStyle = `rgba(46, 216, 182, ${0.18 * (1 - dist / 150)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // Draw traveling telemetry signal packets
      packets.forEach((pkt) => {
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          pkt.progress = 0;
          pkt.from = Math.floor(Math.random() * nodes.length);
          pkt.to = (pkt.from + 1 + Math.floor(Math.random() * (nodes.length - 1))) % nodes.length;
        }

        const n1 = nodes[pkt.from];
        const n2 = nodes[pkt.to];
        if (!n1 || !n2) return;

        const px = n1.x + (n2.x - n1.x) * pkt.progress;
        const py = n1.y + (n2.y - n1.y) * pkt.progress;

        ctx.fillStyle = pkt.color;
        ctx.shadowColor = pkt.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw node circles
      nodes.forEach((n) => {
        ctx.fillStyle = n.color.hex;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.baseRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6]">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#090E15]/80 backdrop-blur-xl border-b border-[var(--line)] px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SupportV8Logo size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-[#EAF1F8] via-[#2ED8B6] to-[#00F2FE] bg-clip-text text-transparent">
                supportV8
              </span>
              <span className="pill text-[9px] font-mono uppercase bg-[#18222E] border-[#2ED8B6]/40 text-[#2ED8B6]">
                v0.3.0 Production
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#6B7C8D]">ServiceV8 Agentic Operating System</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#8E9AA8]">
          <button
            onClick={() => onOpenTenantPortal("acme")}
            className="hover:text-[#2ED8B6] transition-colors cursor-pointer"
          >
            Tenant Help Hub
          </button>
          <a href="#workforce" className="hover:text-[#2ED8B6] transition-colors">
            AI Workforce
          </a>
          <a href="#architecture" className="hover:text-[#2ED8B6] transition-colors">
            Architecture
          </a>
          <a href="#governance" className="hover:text-[#2ED8B6] transition-colors">
            Zero-Trust Security
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenTenantPortal("acme")}
            className="btn btn-secondary px-3.5 py-2 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#4D9FFF]" />
            <span>Tenant Preview</span>
          </button>

          <button
            onClick={onOpenSignup}
            className="btn btn-primary px-4 py-2 text-xs font-bold shadow-lg shadow-[#2ED8B6]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Sign Up / Provision</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onEnterCockpit}
            className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-2 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <span>Admin Cockpit</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#2ED8B6]" />
          </button>
        </div>
      </header>

      {/* Hero Section with Particle Canvas */}
      <section className="relative pt-20 pb-28 px-6 lg:px-12 overflow-hidden border-b border-[var(--line)]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121A24]/90 border border-[#2ED8B6]/40 shadow-xl shadow-[#2ED8B6]/10 text-xs font-mono text-[#2ED8B6] animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous CX • Vector Knowledge Graph • Zero-Trust ForgeGW</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#EAF1F8]">
            Governed AI Support Intelligence & <br />
            <span className="bg-gradient-to-r from-[#00F2FE] via-[#2ED8B6] to-[#059669] bg-clip-text text-transparent">
              Autonomous Omnichannel Triage
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#8E9AA8] max-w-3xl mx-auto leading-relaxed">
            Empower your enterprise with dedicated AI customer support employees and unified contractor/customer workflows. Grounded by 1536-dim vector topologies and bounded by strict cryptographic action limits.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onOpenSignup}
              className="btn btn-primary px-7 py-3.5 rounded-2xl text-sm font-bold shadow-2xl shadow-[#2ED8B6]/30 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
            >
              <span>Provision Instant Tenant Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenTenantPortal("acme")}
              className="btn btn-secondary px-6 py-3.5 rounded-2xl text-sm font-mono flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#4D9FFF]" />
              <span>Launch Customer Chat Widget</span>
            </button>
          </div>

          {/* Metric Highlights Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto">
            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Protected Value</div>
              <div className="text-2xl font-bold text-[#EAF1F8] mt-1">$420k ARR</div>
              <div className="text-[10px] text-[#2ED8B6] font-mono mt-0.5">Enterprise Tier-1 SLA</div>
            </div>

            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Resolution Rate</div>
              <div className="text-2xl font-bold text-[#2ED8B6] mt-1">74.2% VARR</div>
              <div className="text-[10px] text-[#8E9AA8] font-mono mt-0.5">Verified Autonomous</div>
            </div>

            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Response Time</div>
              <div className="text-2xl font-bold text-[#4D9FFF] mt-1">1.2s Mean</div>
              <div className="text-[10px] text-[#8E9AA8] font-mono mt-0.5">Instant Telemetry</div>
            </div>

            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Safety Guarantee</div>
              <div className="text-2xl font-bold text-[#F5A623] mt-1">Zero-Trust</div>
              <div className="text-[10px] text-[#F5A623] font-mono mt-0.5">mTLS & SHA-256 Audit</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Omnichannel Customer Channels */}
      <section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="pill text-xs font-mono uppercase bg-[#18222E] text-[#2ED8B6]">
            Omnichannel Triaging Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            3 Specialized Workflows in One Unified Desk
          </h2>
          <p className="text-sm text-[#8E9AA8]">
            Whether an on-site contractor needs emergency lockbox access, a prospect seeks custom pricing, or an enterprise customer needs an OrderV8 refund token.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contractors & Vendors */}
          <div className="card p-6 rounded-3xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#F5A623]/50 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-[#F5A623]/15 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
              <HardHat className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8]">1. Contractors & Vendors</h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Field work order dispatch, W9/COI compliance checks, lockbox code generation, and invoice payout dispute workflows with strict verification.
            </p>
            <ul className="space-y-2 text-xs text-[#B4C2D0] pt-2 border-t border-[var(--line)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>On-Site Emergency PIN Generation</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Automated Invoice & Payout Verification</span>
              </li>
            </ul>
          </div>

          {/* General Enquiries */}
          <div className="card p-6 rounded-3xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#4D9FFF]/50 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-[#4D9FFF]/15 border border-[#4D9FFF]/40 flex items-center justify-center text-[#4D9FFF]">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8]">2. General Enquiries</h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Pre-sales product consultations, custom enterprise SLA calculators, developer API documentation citations, and partnership qualification.
            </p>
            <ul className="space-y-2 text-xs text-[#B4C2D0] pt-2 border-t border-[var(--line)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4D9FFF]" />
                <span>Knowledge Graph Citations & Whitepapers</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4D9FFF]" />
                <span>Lead Qualification & Handoff</span>
              </li>
            </ul>
          </div>

          {/* Customers & Clients */}
          <div className="card p-6 rounded-3xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/50 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8]">3. Customers & Clients</h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              High-priority subscriber desk with $420k ARR customer context, 1-click OrderV8 refund token dispatching, and automated SLA incident tracking.
            </p>
            <ul className="space-y-2 text-xs text-[#B4C2D0] pt-2 border-t border-[var(--line)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Autonomous Refund Tokens (&lt; $500)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Live Human Takeover & Presence</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* AI Workforce Section */}
      <section id="workforce" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="pill text-xs font-mono uppercase bg-[#18222E] text-[#2ED8B6]">
            Autonomous AI Workforce
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            Meet Your 24/7 Governed Support Team
          </h2>
          <p className="text-sm text-[#8E9AA8]">
            Pre-trained on ServiceV8 customer care protocols, vector embeddings, and zero-trust action dispatchers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Alex */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/avatars/beaver-manager.jpg"
                alt="Alex"
                className="w-12 h-12 rounded-xl object-cover border-2 border-[#2ED8B6]/40 shadow-md"
              />
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Alex</h4>
                <p className="text-[11px] text-[#2ED8B6] font-mono">Contractor & CX Lead</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8]">Specializes in contractor work order triage, site access locks, and team coordination.</p>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
              <span>Autonomy: Full (Level 3)</span>
              <span className="text-[#2ED8B6]">99.8% CSAT</span>
            </div>
          </div>

          {/* Sophia */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/avatars/beaver-sophia.jpg"
                alt="Sophia"
                className="w-12 h-12 rounded-xl object-cover border-2 border-[#2ED8B6]/40 shadow-md"
              />
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Sophia</h4>
                <p className="text-[11px] text-[#2ED8B6] font-mono">Customer Success Lead</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8]">Handles enterprise account billing, SLA monitoring, and OrderV8 token dispatches.</p>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
              <span>Autonomy: Copilot (Level 2)</span>
              <span className="text-[#2ED8B6]">98.9% CSAT</span>
            </div>
          </div>

          {/* Barnaby */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/avatars/beaver-curator.jpg"
                alt="Barnaby"
                className="w-12 h-12 rounded-xl object-cover border-2 border-[#4D9FFF]/40 shadow-md"
              />
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Barnaby</h4>
                <p className="text-[11px] text-[#4D9FFF] font-mono">Knowledge Intelligence</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8]">Indexes S3 Vault documents, synthesizes concept topologies, and curates RAG citations.</p>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
              <span>Autonomy: Full (Level 3)</span>
              <span className="text-[#4D9FFF]">1536-Dim Embed</span>
            </div>
          </div>

          {/* Arthur */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/avatars/beaver-analyst.jpg"
                alt="Arthur"
                className="w-12 h-12 rounded-xl object-cover border-2 border-[#F5A623]/40 shadow-md"
              />
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Arthur</h4>
                <p className="text-[11px] text-[#F5A623] font-mono">Technical Triage Lead</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8]">Analyzes cluster telemetry, correlates recurring bugs, and triggers proactive comms.</p>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
              <span>Autonomy: Supervised</span>
              <span className="text-[#F5A623]">Root-Cause AI</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-20 px-6 lg:px-12 bg-gradient-to-b from-[#090E15] via-[#121A24] to-[#090E15]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            Ready to Deploy Autonomous AI Customer Support?
          </h2>
          <p className="text-sm text-[#8E9AA8] max-w-xl mx-auto">
            Provision your dedicated tenant subdomain, configure custom BYOM model routing, and launch your omnichannel desk in under 2 minutes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenSignup}
              className="btn btn-primary px-8 py-3.5 rounded-2xl text-sm font-bold shadow-xl shadow-[#2ED8B6]/30 flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started Free</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={onEnterCockpit}
              className="btn bg-[#18222E] border border-[var(--line)] text-[#EAF1F8] px-6 py-3.5 rounded-2xl text-sm font-mono flex items-center gap-2 cursor-pointer hover:bg-[#1E2B3A]"
            >
              <span>Open Admin Interface</span>
              <ExternalLink className="w-4 h-4 text-[#2ED8B6]" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-8 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#6B7C8D]">
        <div className="flex items-center gap-2">
          <SupportV8Logo size={20} />
          <span>© 2026 supportV8 • ServiceV8 Enterprise Infrastructure</span>
        </div>

        <div className="flex items-center gap-6">
          <span>ALB Terminated SSL</span>
          <span>Zero-Trust ForgeGW SEC-04</span>
          <span>support.servicev8.com</span>
        </div>
      </footer>
    </div>
  );
}
