import type { AuthSession } from "@/lib/auth-service";

export function supportRoleLabel(role: AuthSession["role"]): string {
  if (role === "observer") return "Workspace Member";
  if (role === "operator") return "Operator";
  if (role === "cx_lead") return "CX Lead";
  if (role === "superadmin") return "Administrator";
  return "Contractor";
}
