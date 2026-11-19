import type { AuthSession } from "@/lib/auth-service";
import { isSupportDemoTenantSlug } from "@/lib/demo-mode";

export interface DemoPersona {
  role: AuthSession["role"];
  email: string;
  name: string;
  slug: "acme" | "meridian";
  label: string;
}

/** Fixture personas of the demo sandbox. Never shown to a real tenant. */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { role: "contractor_lead", email: "dispatch@meridian.com", name: "Meridian Field Dispatch", slug: "meridian", label: "Field Dispatch (Contractor)" },
  { role: "operator", email: "david.kim@acme.com", name: "David Kim", slug: "acme", label: "David Kim (Operator)" },
  { role: "cx_lead", email: "admin@acme.com", name: "Sarah Chen", slug: "acme", label: "Sarah Chen (CX Lead)" },
  { role: "observer", email: "auditor@compliance.org", name: "Audit Officer", slug: "acme", label: "Compliance Auditor" },
];

/**
 * The persona switcher is offered only when all hold: the deployment enables
 * the demo sandbox, the workspace is one of its fixture tenants, and the
 * session is not a Runtime hand-off (a real Runtime tenant may use the domain
 * `acme` or `meridian`; its verified session must never be swapped for a
 * fabricated one).
 */
export function demoPersonasFor(input: {
  demoEnabled: boolean;
  tenantSlug: string | null | undefined;
  runtimeHandoff: boolean;
}): DemoPersona[] {
  if (!input.demoEnabled || input.runtimeHandoff) return [];
  if (!isSupportDemoTenantSlug(input.tenantSlug)) return [];
  const slug = (input.tenantSlug ?? "").trim().toLowerCase();
  return DEMO_PERSONAS.filter((persona) => persona.slug === slug);
}
