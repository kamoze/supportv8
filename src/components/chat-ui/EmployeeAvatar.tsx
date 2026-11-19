import React from "react";
import { employeeAvatarSources } from "@/lib/chat/employee-avatar";

/**
 * Decorative beside the employee's visible name and role, so the alt text is
 * empty (as in Runtime). Serves the small WebP copies at 1x/2x with explicit
 * width and height.
 */
export function EmployeeAvatar({ name = "", role = "", kind, size = 40 }: { name?: string; role?: string; kind?: "employee" | "intern"; size?: number }) {
  const { src, srcSet } = employeeAvatarSources(name, role, kind, size);
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="employee-avatar" src={src} srcSet={srcSet} alt="" width={size} height={size} loading="lazy" decoding="async" />;
}
