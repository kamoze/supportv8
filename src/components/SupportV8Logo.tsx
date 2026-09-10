import React from "react";

interface SupportV8LogoProps { className?: string; size?: number; showText?: boolean; }

export function SupportV8Logo({ className = "", size = 34, showText = true }: SupportV8LogoProps) {
  return <div className="family-brand">
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect width="12" height="12" fill="#c8ff00" />
      <rect y="16" width="12" height="12" fill="#c8ff00" />
      <rect x="16" width="12" height="12" fill="#2ED8B6" />
      <rect x="16" y="16" width="12" height="12" fill="#00F2FE" />
    </svg>
    {showText && <span className="family-wordmark" translate="no">support<span>v8</span></span>}
  </div>;
}
