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
  UserCheck,
  Server,
  FileCheck,
  Workflow,
  Radio,
  ShoppingBag,
  Plug,
  KeyRound,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

interface GlobalLandingViewProps {
  onOpenSignIn: () => void;
  onOpenTenantPortal: (slug?: string) => void;
  onOpenSignup: () => void;
}

export function GlobalLandingView({
  onOpenSignIn,
  onOpenTenantPortal,
  onOpenSignup,
}: GlobalLandingViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Signal particle network animation
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

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 130;
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.15;
            ctx.strokeStyle = `rgba(46, 216, 182, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      packets.forEach((p) => {
        const from = nodes[p.from];
        const to = nodes[p.to];
        if (!from || !to) return;
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          p.from = Math.floor(Math.random() * nodes.length);
          p.to = Math.floor(Math.random() * nodes.length);
        }
        const px = from.x + (to.x - from.x) * p.progress;
        const py = from.y + (to.y - from.y) * p.progress;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        ctx.fillStyle = `rgba(${n.color.r}, ${n.color.g}, ${n.color.b}, 0.7)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.baseRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.height = canvas.parentElement?.clientHeight || 650;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6]">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#090E15]/85 backdrop-blur-xl border-b border-[var(--line)] px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SupportV8Logo size={32} />
          <span className="font-extrabold text-xl tracking-tight text-[#EAF1F8]">
            Support<span className="text-[#2ED8B6]">V8</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#8E9AA8]">
          <a href="#capabilities" className="hover:text-[#2ED8B6] transition-colors">
            Capabilities
          </a>
          <a href="#workforce" className="hover:text-[#2ED8B6] transition-colors">
            AI Workforce
          </a>
          <a href="#architecture" className="hover:text-[#2ED8B6] transition-colors">
            Architecture
          </a>
          <a href="#security" className="hover:text-[#2ED8B6] transition-colors">
            Security
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Demo Sandbox Quick Jump */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#121A24] p-1 rounded-xl border border-[var(--line)] text-xs font-mono">
            <button
              onClick={() => onOpenTenantPortal("acme")}
              className="px-2.5 py-1 rounded-lg text-[#2ED8B6] hover:bg-[#18222E] flex items-center gap-1 cursor-pointer"
              title="Preview live seeded Acme Corp customer care sandbox"
            >
              <Users className="w-3 h-3 text-[#2ED8B6]" />
              <span>Acme Demo</span>
            </button>

            <button
              onClick={() => onOpenTenantPortal("meridian")}
              className="px-2.5 py-1 rounded-lg text-[#F5A623] hover:bg-[#18222E] flex items-center gap-1 cursor-pointer"
              title="Preview live seeded Meridian Logistics contractor dispatch sandbox"
            >
              <HardHat className="w-3 h-3 text-[#F5A623]" />
              <span>Meridian Demo</span>
            </button>
          </div>

          <button
            onClick={onOpenSignIn}
            className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Sign In</span>
          </button>

          <button
            onClick={onOpenSignup}
            className="btn btn-primary px-4 py-1.5 text-xs font-bold shadow-lg shadow-[#2ED8B6]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Sign Up</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section with Particle Canvas */}
      <section className="relative pt-20 pb-28 px-6 lg:px-12 overflow-hidden border-b border-[var(--line)]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#121A24]/90 border border-[#2ED8B6]/40 shadow-xl shadow-[#2ED8B6]/10 text-xs font-mono text-[#2ED8B6] animate-pulse">
            <span>Universal AI Support Engine • Multi-Stream Operations • Governed Automation</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#EAF1F8]">
            Universal AI Support &amp; <br />
            <span className="bg-gradient-to-r from-[#00F2FE] via-[#2ED8B6] to-[#059669] bg-clip-text text-transparent">
              Autonomous Operations Engine
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#8E9AA8] max-w-3xl mx-auto leading-relaxed">
            A single, adaptive support platform built for any enterprise. Seamlessly orchestrate B2B SaaS customer success, field contractor dispatches, e-commerce dispute resolutions, and inbound inquiries — grounded by deep domain knowledge and bounded by strict action limits.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={onOpenSignup}
              className="btn btn-primary px-7 py-3.5 rounded-2xl text-sm font-bold shadow-2xl shadow-[#2ED8B6]/30 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenTenantPortal("acme")}
              className="btn btn-secondary px-5 py-3.5 rounded-2xl text-sm font-mono flex items-center gap-2 cursor-pointer hover:border-[#2ED8B6]"
            >
              <Users className="w-4 h-4 text-[#2ED8B6]" />
              <span>Acme Demo (SaaS CX)</span>
            </button>

            <button
              onClick={() => onOpenTenantPortal("meridian")}
              className="btn btn-secondary px-5 py-3.5 rounded-2xl text-sm font-mono flex items-center gap-2 cursor-pointer hover:border-[#F5A623]"
            >
              <HardHat className="w-4 h-4 text-[#F5A623]" />
              <span>Meridian Demo (Field Dispatch)</span>
            </button>
          </div>

          {/* Metric Highlights Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto">
            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Account Health</div>
              <div className="text-2xl font-bold text-[#EAF1F8] mt-1">99.4% CSAT</div>
              <div className="text-[10px] text-[#2ED8B6] font-mono mt-0.5">Enterprise Tier-1 SLA</div>
            </div>

            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Resolution Rate</div>
              <div className="text-2xl font-bold text-[#2ED8B6] mt-1">74.2% Auto</div>
              <div className="text-[10px] text-[#8E9AA8] font-mono mt-0.5">First-Contact Resolution</div>
            </div>

            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Response Time</div>
              <div className="text-2xl font-bold text-[#4D9FFF] mt-1">1.2s Average</div>
              <div className="text-[10px] text-[#8E9AA8] font-mono mt-0.5">Instant Omnichannel Triage</div>
            </div>

            <div className="card p-4 text-left border-[var(--line)] bg-[#121A24]/60 backdrop-blur-md">
              <div className="text-[10px] font-mono text-[#6B7C8D] uppercase">Operational Safety</div>
              <div className="text-2xl font-bold text-[#F5A623] mt-1">Governed</div>
              <div className="text-[10px] text-[#F5A623] font-mono mt-0.5">Audited Action Limits</div>
            </div>
          </div>
        </div>
      </section>

      {/* INSTANT DEMO SANDBOX OPERATOR ACCESS */}
      <section className="py-12 px-6 lg:px-12 max-w-6xl mx-auto border-b border-[var(--line)]">
        <div className="p-8 rounded-3xl bg-gradient-to-b from-[#121A24] to-[#0D1520] border border-[var(--line-2)] shadow-2xl relative overflow-hidden space-y-6">
          {/* Subtle Ambient Background Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#2ED8B6]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#F5A623]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18222E] border border-[var(--line)] text-[11px] font-mono text-[#2ED8B6]">
                <Zap className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>INTERACTIVE LIVE SANDBOX DEMOS</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#EAF1F8] tracking-tight">
                Instant Demo Sandbox Operator Access
              </h2>
              <p className="text-xs sm:text-sm text-[#8E9AA8] max-w-xl leading-relaxed">
                Experience full operator access with live simulated telemetry, AI employees, and autonomous action gateways. Enter your work email to launch instantly.
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#6B7C8D]">
              <span className="text-[#2ED8B6] font-bold">2 Live Environments</span> Ready to Test
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            {/* Acme Corp Demo Card */}
            <div
              onClick={() => onOpenTenantPortal("acme")}
              className="p-5 rounded-2xl bg-[#141C26] hover:bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6] transition-all cursor-pointer group space-y-3 relative overflow-hidden shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">
                      Acme Corp Sandbox
                    </h3>
                    <p className="text-[10px] font-mono text-[#6B7C8D]">SaaS Customer Care &amp; Account Billing</p>
                  </div>
                </div>
                <span className="pill ok text-[10px] font-mono">
                  SOPHIA LEAD
                </span>
              </div>

              <p className="text-xs text-[#8E9AA8] leading-relaxed">
                Experience high-tier customer success, autonomous credit voucher adjustments, comprehensive account telemetry, and SLA breach auto-escalations.
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs font-mono">
                <span className="text-[11px] text-[#2ED8B6] flex items-center gap-1 group-hover:underline">
                  <span>Launch Acme Operator Desk</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] text-[#6B7C8D]">acme.support.servicev8.com</span>
              </div>
            </div>

            {/* Meridian Logistics Demo Card */}
            <div
              onClick={() => onOpenTenantPortal("meridian")}
              className="p-5 rounded-2xl bg-[#141C26] hover:bg-[#18222E] border border-[var(--line)] hover:border-[#F5A623] transition-all cursor-pointer group space-y-3 relative overflow-hidden shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#EAF1F8] group-hover:text-[#F5A623] transition-colors">
                      Meridian Logistics Sandbox
                    </h3>
                    <p className="text-[10px] font-mono text-[#6B7C8D]">Field Dispatch &amp; Contractor Coordination</p>
                  </div>
                </div>
                <span className="pill text-[10px] font-mono text-[#F5A623] bg-[#F5A623]/15 border border-[#F5A623]/30">
                  ALEX LEAD
                </span>
              </div>

              <p className="text-xs text-[#8E9AA8] leading-relaxed">
                Test emergency digital access PIN generation (8492-X), field technician dispatch, and contractor compliance verification.
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs font-mono">
                <span className="text-[11px] text-[#F5A623] flex items-center gap-1 group-hover:underline">
                  <span>Launch Meridian Operator Desk</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-[10px] text-[#6B7C8D]">meridian.support.servicev8.com</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: Capabilities & Omnichannel Architecture */}
      <section id="capabilities" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="pill text-xs font-mono uppercase bg-[#18222E] text-[#2ED8B6]">
            Universal Multi-Stream Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            3 Core Work Streams in One Unified Desk
          </h2>
          <p className="text-sm text-[#8E9AA8]">
            A single, governed engine designed to power customer success, vendor operations, and pre-sales across any enterprise industry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Customers & Clients */}
          <div
            onClick={() => onOpenTenantPortal("acme")}
            className="card p-6 rounded-3xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
                <Users className="w-6 h-6" />
              </div>
              <span className="pill text-[9.5px] font-mono text-[#2ED8B6]">Customer Care &rarr;</span>
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">
              1. Customer Care &amp; Success
            </h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Dedicated subscriber desk with account context, automated credit voucher issuance, subscription management, and proactive SLA escalation.
            </p>
            <ul className="space-y-2 text-xs text-[#B4C2D0] pt-2 border-t border-[var(--line)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Autonomous Account Credit Vouchers</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Customer 360 &amp; Sentiment Trajectory</span>
              </li>
            </ul>
          </div>

          {/* 2. Operations, Field & Partners */}
          <div
            onClick={() => onOpenTenantPortal("meridian")}
            className="card p-6 rounded-3xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#F5A623] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#F5A623]/15 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
                <HardHat className="w-6 h-6" />
              </div>
              <span className="pill text-[9.5px] font-mono text-[#F5A623]">Field &amp; Ops &rarr;</span>
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8] group-hover:text-[#F5A623] transition-colors">
              2. Operations, Field &amp; Partners
            </h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Contractor work order dispatching, compliance checks, electronic access code generation, and invoice payout verification with strict audit trails.
            </p>
            <ul className="space-y-2 text-xs text-[#B4C2D0] pt-2 border-t border-[var(--line)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>On-Site Emergency PIN Generation</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Work Order SOW &amp; Payout Dispatch</span>
              </li>
            </ul>
          </div>

          {/* 3. Inquiries & Pre-Sales */}
          <div
            onClick={() => onOpenTenantPortal("acme")}
            className="card p-6 rounded-3xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#4D9FFF] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#4D9FFF]/15 border border-[#4D9FFF]/40 flex items-center justify-center text-[#4D9FFF]">
                <HelpCircle className="w-6 h-6" />
              </div>
              <span className="pill text-[9.5px] font-mono text-[#4D9FFF]">Knowledge Desk &rarr;</span>
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8] group-hover:text-[#4D9FFF] transition-colors">
              3. Inquiries &amp; Knowledge Desk
            </h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Pre-sales product consultations, custom enterprise SLA calculators, developer API documentation citations, and partnership lead qualification.
            </p>
            <ul className="space-y-2 text-xs text-[#B4C2D0] pt-2 border-t border-[var(--line)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4D9FFF]" />
                <span>Vector RAG Whitepaper Citations</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4D9FFF]" />
                <span>Lead Qualification &amp; CRM Routing</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION 2: AI Workforce */}
      <section id="workforce" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="pill text-xs font-mono uppercase bg-[#18222E] text-[#2ED8B6]">
            Autonomous AI Workforce
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            Meet Your 24/7 Governed Support Team
          </h2>
          <p className="text-sm text-[#8E9AA8]">
            Pre-trained on domain care protocols, knowledge embeddings, and governed action dispatchers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Alex */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#2ED8B6]/20 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Alex</h4>
                <p className="text-[11px] text-[#2ED8B6] font-mono">Operations &amp; CX Lead</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Specialized in contractor dispatches, access codes, and work order operations.
            </p>
            <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#6B7C8D]">Autonomy</span>
              <span className="text-[#2ED8B6]">Autonomous L2</span>
            </div>
          </div>

          {/* Sophia */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#4D9FFF]/20 border border-[#4D9FFF]/40 flex items-center justify-center text-[#4D9FFF]">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Sophia</h4>
                <p className="text-[11px] text-[#4D9FFF] font-mono">Customer Success Lead</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Handles subscriber care, billing adjustments, and SLA incident escalations.
            </p>
            <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#6B7C8D]">Autonomy</span>
              <span className="text-[#4D9FFF]">Autonomous L2</span>
            </div>
          </div>

          {/* Barnaby */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Barnaby</h4>
                <p className="text-[11px] text-[#F5A623] font-mono">Knowledge Lead</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Curates vector documentation, identifies knowledge gaps, and provides RAG citations.
            </p>
            <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#6B7C8D]">Autonomy</span>
              <span className="text-[#F5A623]">Autonomous L1</span>
            </div>
          </div>

          {/* Arthur */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E5484D]/20 border border-[#E5484D]/40 flex items-center justify-center text-[#E5484D]">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#EAF1F8]">Arthur</h4>
                <p className="text-[11px] text-[#E5484D] font-mono">Technical Triage</p>
              </div>
            </div>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Correlates telemetry across issues, isolates root causes, and manages incident escalation.
            </p>
            <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#6B7C8D]">Autonomy</span>
              <span className="text-[#E5484D]">Supervised</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Platform Infrastructure (Rewritten Clean Enterprise Topology) */}
      <section id="architecture" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="pill text-xs font-mono uppercase bg-[#18222E] text-[#4D9FFF]">
            Enterprise Cloud Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            Unified Architecture &amp; Reliable Action Dispatch
          </h2>
          <p className="text-sm text-[#8E9AA8]">
            Decoupled commercial entitlement, central capability governance, and high-availability action dispatchers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          <div className="card p-6 rounded-3xl bg-[#121A24] border border-[var(--line)] space-y-3">
            <div className="flex items-center justify-between text-[#4D9FFF] font-bold">
              <span>TIER 1: SURFACES &amp; PORTALS</span>
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-[#EAF1F8]">Studio Marketplace &amp; Help Hub</h4>
            <p className="text-[#8E9AA8] text-[11px] leading-relaxed">
              Self-service customer hubs, vendor dispatch interfaces, and marketplace acquisition with seamless single sign-on.
            </p>
            <div className="p-2 rounded bg-[#18222E] text-[10px] text-[#2ED8B6]">
              Surface: /support
            </div>
          </div>

          <div className="card p-6 rounded-3xl bg-[#121A24] border border-[#2ED8B6]/40 space-y-3 shadow-lg shadow-[#2ED8B6]/5">
            <div className="flex items-center justify-between text-[#2ED8B6] font-bold">
              <span>TIER 2: CONTROL PLANE</span>
              <Server className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-[#EAF1F8]">Central Policy &amp; Tenant Governance</h4>
            <p className="text-[#8E9AA8] text-[11px] leading-relaxed">
              Centralized configuration engine managing product manifests, tenant entitlement ledgers, and compliance rules across all channels.
            </p>
            <div className="p-2 rounded bg-[#18222E] text-[10px] text-[#4CC38A]">
              Automated Scaling &amp; Isolation
            </div>
          </div>

          <div className="card p-6 rounded-3xl bg-[#121A24] border border-[var(--line)] space-y-3">
            <div className="flex items-center justify-between text-[#F5A623] font-bold">
              <span>TIER 3: DISPATCH &amp; WORKFLOWS</span>
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-[#EAF1F8]">Secure Action Dispatch Engine</h4>
            <p className="text-[#8E9AA8] text-[11px] leading-relaxed">
              Executes omnichannel communications and business actions with end-to-end encryption and guaranteed execution reliability.
            </p>
            <div className="p-2 rounded bg-[#18222E] text-[10px] text-[#F5A623]">
              Reliable Event Dispatch
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Security & Governance */}
      <section id="security" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-b border-[var(--line)]">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="pill text-xs font-mono uppercase bg-[#18222E] text-[#F5A623]">
            Enterprise Security Standards
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#EAF1F8]">
            Enterprise Security &amp; Governance Guardrails
          </h2>
          <p className="text-sm text-[#8E9AA8]">
            Bounded action limits, deterministic verification, and cryptographically signed audit trails.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="card p-6 rounded-3xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#EAF1F8]">Action Limit Guardrails</h4>
            <p className="text-xs text-[#8E9AA8]">
              Automated transactions and adjustments are bounded by configurable policy thresholds and required supervisor approvals.
            </p>
          </div>

          <div className="card p-6 rounded-3xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#4D9FFF]/15 text-[#4D9FFF] flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#EAF1F8]">Tenant Namespace Isolation</h4>
            <p className="text-xs text-[#8E9AA8]">
              Dedicated vector collections, segregated document vaults, and tenant isolation for compliance.
            </p>
          </div>

          <div className="card p-6 rounded-3xl bg-[#121A24] border-[var(--line)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#EAF1F8]">Tamper-Proof Audit Chaining</h4>
            <p className="text-xs text-[#8E9AA8]">
              Every AI action execution is recorded to persistent append-only database ledgers with verified audit trails.
            </p>
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
            Launch your dedicated tenant subdomain, configure custom BYOM model routing, and deploy your omnichannel desk in under 2 minutes.
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
              onClick={onOpenSignIn}
              className="btn bg-[#18222E] border border-[var(--line)] text-[#EAF1F8] px-6 py-3.5 rounded-2xl text-sm font-mono flex items-center gap-2 cursor-pointer hover:bg-[#1E2B3A]"
            >
              <UserCheck className="w-4 h-4 text-[#2ED8B6]" />
              <span>Sign In to Cockpit</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-8 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#6B7C8D]">
        <div className="flex items-center gap-2">
          <SupportV8Logo size={20} />
          <span>© 2026 SupportV8</span>
        </div>

        <div className="flex items-center gap-6">
          <span>support.servicev8.com</span>
        </div>
      </footer>
    </div>
  );
}
