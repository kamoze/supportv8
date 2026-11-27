import React from "react";

interface SupportV8LogoProps { className?: string; size?: number; showText?: boolean; }

/**
 * The ServiceV8 family mark for SupportV8 (F4): a 2x2 grid with lime #C8FF00
 * down the left column, SupportV8 teal #2ED8B6 top-right and cyan #00F2FE
 * bottom-right. Same geometry as @kamoze/servicev8-family-ui logos/support.svg.
 */
export const SUPPORT_BRAND = { lime: "#C8FF00", secondary: "#2ED8B6", tertiary: "#00F2FE" } as const;

export function SupportV8Logo({ className = "", size = 34, showText = true }: SupportV8LogoProps) {
  return <div className="family-brand">
    <svg width={size} height={size} viewBox="0 0 31 31" className={className} aria-hidden="true">
      <rect x="0" y="0" width="14" height="14" rx="2" fill={SUPPORT_BRAND.lime} />
      <rect x="17" y="0" width="14" height="14" rx="2" fill={SUPPORT_BRAND.secondary} />
      <rect x="0" y="17" width="14" height="14" rx="2" fill={SUPPORT_BRAND.lime} />
      <rect x="17" y="17" width="14" height="14" rx="2" fill={SUPPORT_BRAND.tertiary} />
    </svg>
    {showText && <span className="family-wordmark" translate="no">support<span>v8</span></span>}
  </div>;
}
