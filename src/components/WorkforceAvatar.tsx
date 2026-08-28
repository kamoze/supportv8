"use client";

import React from "react";
import {
  Bot,
  Brain,
  BookOpen,
  Mic,
  Briefcase,
  Sparkles,
  Wrench,
  Headphones,
  User,
  Shield,
  Zap,
  Tag,
  FileText,
  Clock,
  Layers,
} from "lucide-react";

interface WorkforceAvatarProps {
  avatar?: string;
  avatarUrl?: string;
  name?: string;
  role?: string;
  level?: "ai_employee" | "ai_intern" | string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function WorkforceAvatar({
  avatar,
  avatarUrl,
  name = "Agent",
  role = "",
  level = "ai_employee",
  className = "",
  size = "md",
}: WorkforceAvatarProps) {
  const isIntern = level === "ai_intern" || role.toLowerCase().includes("intern") || name.toLowerCase().includes("intern");

  // Determine appropriate modern flat vector icon
  const getIcon = () => {
    const key = (avatar || "").toLowerCase() + " " + (name || "").toLowerCase() + " " + (role || "").toLowerCase();

    if (key.includes("voice") || key.includes("sophia") || key.includes("🎙") || key.includes("mic") || key.includes("telephony")) {
      return <Mic className="w-full h-full" />;
    }
    if (key.includes("brain") || key.includes("maya") || key.includes("analyst") || key.includes("impact") || key.includes("🧠")) {
      return <Brain className="w-full h-full" />;
    }
    if (key.includes("book") || key.includes("jordan") || key.includes("knowledge") || key.includes("kb") || key.includes("📚")) {
      return <BookOpen className="w-full h-full" />;
    }
    if (key.includes("tag") || key.includes("chip") || key.includes("categoriz")) {
      return <Tag className="w-full h-full" />;
    }
    if (key.includes("stale") || key.includes("sweeper") || key.includes("broom") || key.includes("🧹")) {
      return <Wrench className="w-full h-full" />;
    }
    if (key.includes("summar") || key.includes("note") || key.includes("digest")) {
      return <FileText className="w-full h-full" />;
    }
    if (key.includes("triage") || key.includes("frontline") || key.includes("🎧") || key.includes("headphone")) {
      return <Headphones className="w-full h-full" />;
    }
    if (key.includes("manager") || key.includes("lead") || key.includes("alex") || key.includes("💼")) {
      return <Briefcase className="w-full h-full" />;
    }
    if (isIntern) {
      return <Sparkles className="w-full h-full" />;
    }
    return <Bot className="w-full h-full" />;
  };

  const sizeClasses = {
    sm: "w-6 h-6 p-1 text-xs rounded-md",
    md: "w-8 h-8 p-1.5 text-sm rounded-lg",
    lg: "w-10 h-10 p-2 text-base rounded-xl",
    xl: "w-12 h-12 p-2.5 text-lg rounded-2xl",
  }[size];

  const colorClasses = isIntern
    ? "bg-[#4D9FFF]/15 text-[#4D9FFF] border border-[#4D9FFF]/30"
    : "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30";

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 shadow-sm ${sizeClasses} ${colorClasses} ${className}`}
      title={name}
    >
      {getIcon()}
    </div>
  );
}
