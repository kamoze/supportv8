export const PORTAL_PAGE_SLUG = "home";

export type PortalActionMode = "answer" | "chat";
export type PortalActionIcon = "tools" | "book" | "billing" | "shield" | "message" | "status";
export type PortalSectionKey = "actions" | "search" | "tracker" | "channels";

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

export function actionHref(action: Pick<PortalAction, "slug">): string {
  return `/help/${encodeURIComponent(action.slug)}`;
}
