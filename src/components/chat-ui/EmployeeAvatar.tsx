import React from "react";
import { isCustomAvatarUrl, portraitKey, portraitSources } from "@/lib/portraits";

/**
 * SupportV8's one employee portrait: the canonical ServiceV8 beaver (small
 * WebP at 1x/2x, explicit width and height), or the custom avatar URL the data
 * carries. Decorative beside a visible name by default (empty alt).
 */
export function EmployeeAvatar({
  name = "",
  role = "",
  kind,
  size = 40,
  src: custom,
  alt = "",
  className = "",
}: {
  name?: string;
  role?: string;
  kind?: "employee" | "intern";
  size?: number;
  /** A custom avatar URL from the data; stock /avatars paths resolve canonically instead. */
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const classes = `employee-avatar ${className}`.trim();
  if (isCustomAvatarUrl(custom)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={classes} src={custom} alt={alt} width={size} height={size} loading="lazy" decoding="async" />;
  }
  const { src, srcSet, width, height } = portraitSources(portraitKey(name, role, kind === "intern" ? "intern" : undefined), size);
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={classes} src={src} srcSet={srcSet} alt={alt} width={width} height={height} loading="lazy" decoding="async" />;
}
