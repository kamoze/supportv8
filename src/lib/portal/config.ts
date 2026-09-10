import { portalMediaTenantSegment, type PortalMediaKind } from "@/lib/portal/media";

export const PORTAL_PAGE_SLUG = "home";

export type PortalActionMode = "answer" | "chat";
export type PortalActionIcon = "tools" | "book" | "billing" | "shield" | "message" | "status";
export type PortalSectionKey = "actions" | "search" | "tracker" | "channels";

export interface PortalBranding {
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export interface PortalAction {
  id: string;
  slug: string;
  label: string;
  description: string;
  prompt: string;
  mode: PortalActionMode;
  icon: PortalActionIcon;
  categories: string[];
  enabled: boolean;
}

export interface PortalConfig {
  schemaVersion: 1;
  branding: PortalBranding;
  supportName: string;
  headline: string;
  introduction: string;
  searchPlaceholder: string;
  actionsHeading: string;
  sections: Record<PortalSectionKey, boolean>;
  actions: PortalAction[];
}

const TEXT_LIMITS = {
  supportName: 80,
  headline: 120,
  introduction: 280,
  searchPlaceholder: 120,
  actionsHeading: 80,
  actionLabel: 80,
  actionDescription: 220,
  actionPrompt: 500,
  category: 64,
} as const;

const ACTION_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const ACTION_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_BRANDING: PortalBranding = {
  logoUrl: null,
  heroImageUrl: null,
  primaryColor: "#2ED8B6",
  accentColor: "#57E5C8",
};
const ACTION_ICONS = new Set<PortalActionIcon>([
  "tools",
  "book",
  "billing",
  "shield",
  "message",
  "status",
]);

export class PortalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalConfigError";
  }
}

function tenantDisplayName(value: string): string {
  return value
    .replace(/^tenant_/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
    .join(" ") || "Your organization";
}

export function emptyPortalConfig(tenantName: string): PortalConfig {
  const name = tenantDisplayName(tenantName);
  return {
    schemaVersion: 1,
    branding: { ...DEFAULT_BRANDING },
    supportName: `${name} Support`,
    headline: `How can ${name} help?`,
    introduction: "Search published guidance, choose a support topic, or start a conversation with the support team.",
    searchPlaceholder: "Describe what you need help with…",
    actionsHeading: "Get help with a topic",
    sections: {
      actions: true,
      search: true,
      tracker: true,
      channels: true,
    },
    actions: [],
  };
}

function optionalHttpsImage(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2_048) {
    throw new PortalConfigError(`${field} must be an HTTPS image URL.`);
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new Error();
    return url.toString();
  } catch {
    throw new PortalConfigError(`${field} must be an HTTPS image URL without embedded credentials.`);
  }
}

function colorValue(value: unknown, field: string, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !HEX_COLOR.test(value.trim())) {
    throw new PortalConfigError(`${field} must be a 6-digit hex color such as #2ED8B6.`);
  }
  const normalized = value.trim().toUpperCase();
  if (contrastRatio(normalized, "#090E15") < 3) {
    throw new PortalConfigError(`${field} must remain visible against the dark portal background.`);
  }
  return normalized;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const high = Math.max(relativeLuminance(first), relativeLuminance(second));
  const low = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (high + 0.05) / (low + 0.05);
}

function brandingValue(value: unknown): PortalBranding {
  if (value === undefined || value === null) return { ...DEFAULT_BRANDING };
  const branding = record(value, "Portal branding");
  return {
    logoUrl: optionalHttpsImage(branding.logoUrl, "Logo URL"),
    heroImageUrl: optionalHttpsImage(branding.heroImageUrl, "Hero image URL"),
    primaryColor: colorValue(branding.primaryColor, "Primary color", DEFAULT_BRANDING.primaryColor),
    accentColor: colorValue(branding.accentColor, "Accent color", DEFAULT_BRANDING.accentColor),
  };
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PortalConfigError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new PortalConfigError(`${field} must be text.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(normalized)) {
    throw new PortalConfigError(`${field} must contain between 1 and ${max} readable characters.`);
  }
  return normalized;
}

function actionValue(value: unknown, index: number): PortalAction {
  const action = record(value, `Action ${index + 1}`);
  const id = textValue(action.id, `Action ${index + 1} ID`, 64);
  const slug = textValue(action.slug, `Action ${index + 1} slug`, 64).toLowerCase();
  if (!ACTION_ID.test(id)) throw new PortalConfigError(`Action ${index + 1} has an invalid ID.`);
  if (!ACTION_SLUG.test(slug)) {
    throw new PortalConfigError(`Action ${index + 1} slug must use lowercase letters, numbers, and hyphens.`);
  }
  const mode = action.mode;
  if (mode !== "answer" && mode !== "chat") {
    throw new PortalConfigError(`Action ${index + 1} must either show an answer or open chat.`);
  }
  const icon = action.icon;
  if (typeof icon !== "string" || !ACTION_ICONS.has(icon as PortalActionIcon)) {
    throw new PortalConfigError(`Action ${index + 1} has an unsupported icon.`);
  }
  if (!Array.isArray(action.categories) || action.categories.length > 8) {
    throw new PortalConfigError(`Action ${index + 1} may use up to 8 knowledge categories.`);
  }
  const categories = action.categories.map((category, categoryIndex) =>
    textValue(category, `Action ${index + 1} category ${categoryIndex + 1}`, TEXT_LIMITS.category).toLowerCase()
  );

  return {
    id,
    slug,
    label: textValue(action.label, `Action ${index + 1} label`, TEXT_LIMITS.actionLabel),
    description: textValue(action.description, `Action ${index + 1} description`, TEXT_LIMITS.actionDescription),
    prompt: textValue(action.prompt, `Action ${index + 1} prompt`, TEXT_LIMITS.actionPrompt),
    mode,
    icon: icon as PortalActionIcon,
    categories: [...new Set(categories)],
    enabled: action.enabled !== false,
  };
}

export function parsePortalConfig(value: unknown): PortalConfig {
  const config = record(value, "Portal configuration");
  const sections = record(config.sections, "Portal sections");
  if (!Array.isArray(config.actions) || config.actions.length > 12) {
    throw new PortalConfigError("A support portal may contain up to 12 help actions.");
  }
  const actions = config.actions.map(actionValue);
  if (new Set(actions.map((action) => action.slug)).size !== actions.length) {
    throw new PortalConfigError("Every help action must have a unique link slug.");
  }
  if (new Set(actions.map((action) => action.id)).size !== actions.length) {
    throw new PortalConfigError("Every help action must have a unique ID.");
  }

  return {
    schemaVersion: 1,
    branding: brandingValue(config.branding),
    supportName: textValue(config.supportName, "Support name", TEXT_LIMITS.supportName),
    headline: textValue(config.headline, "Headline", TEXT_LIMITS.headline),
    introduction: textValue(config.introduction, "Introduction", TEXT_LIMITS.introduction),
    searchPlaceholder: textValue(config.searchPlaceholder, "Search placeholder", TEXT_LIMITS.searchPlaceholder),
    actionsHeading: textValue(config.actionsHeading, "Help topics heading", TEXT_LIMITS.actionsHeading),
    sections: {
      actions: sections.actions !== false,
      search: sections.search !== false,
      tracker: sections.tracker !== false,
      channels: sections.channels !== false,
    },
    actions,
  };
}

function assertTenantMediaUrl(
  value: string | null,
  field: string,
  kind: PortalMediaKind,
  tenantId: string,
  cdnBaseUrl: string,
): void {
  if (!value) return;
  let assetUrl: URL;
  let cdnBase: URL;
  try {
    assetUrl = new URL(value);
    cdnBase = new URL(cdnBaseUrl.endsWith("/") ? cdnBaseUrl : `${cdnBaseUrl}/`);
  } catch {
    throw new PortalConfigError(`${field} must use the SupportV8 media CDN.`);
  }
  if (
    cdnBase.protocol !== "https:" ||
    cdnBase.username ||
    cdnBase.password ||
    assetUrl.origin !== cdnBase.origin ||
    assetUrl.search ||
    assetUrl.hash
  ) {
    throw new PortalConfigError(`${field} must use the SupportV8 media CDN.`);
  }
  const tenantSegment = portalMediaTenantSegment(tenantId);
  const expectedPrefix = new URL(`supportv8/portal/${tenantSegment}/${kind}/`, cdnBase).pathname;
  if (!assetUrl.pathname.startsWith(expectedPrefix) || assetUrl.pathname.length <= expectedPrefix.length) {
    throw new PortalConfigError(`${field} must belong to the current tenant.`);
  }
}

export function parsePortalConfigForTenant(
  value: unknown,
  tenantId: string,
  cdnBaseUrl = process.env.PORTAL_MEDIA_CDN_BASE_URL || "https://cdn.servicev8.com",
): PortalConfig {
  const config = parsePortalConfig(value);
  assertTenantMediaUrl(config.branding.logoUrl, "Logo URL", "logo", tenantId, cdnBaseUrl);
  assertTenantMediaUrl(config.branding.heroImageUrl, "Hero image URL", "hero", tenantId, cdnBaseUrl);
  return config;
}

export function actionHref(action: Pick<PortalAction, "slug">): string {
  return `/help/${encodeURIComponent(action.slug)}`;
}
