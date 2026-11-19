/**
 * Canonical ServiceV8 beaver portraits for SupportV8.
 *
 * A port of the canonical resolver (portraits-canonical/resolver.mjs, update
 * 2026-11-19); it must pass that bundle's test-vectors.json (copied to
 * test/fixtures/portrait-test-vectors.json). Order:
 *   1. a custom avatar URL the data already carries wins (see isCustomAvatarUrl);
 *   2. intern;
 *   3. a known visible name, as a whole word (Dexter -> manager);
 *   4. StudioV8's specific role terms;
 *   5. Runtime's documented role order;
 *   6. default.
 * Names without artwork of their own (PENDING_ART) show the default beaver.
 * The portrait is illustration only: never identity, hiring, readiness or authority.
 */

/** Keys with their own artwork. The resolver only ever returns one of these. */
export const PORTRAIT_KEYS = Object.freeze([
  "arthur", "barnaby", "cornelius", "default", "eleanor", "intern", "manager",
  "maxwell", "oliver", "penelope", "sophia", "vivian",
] as const);
export type PortraitKey = (typeof PORTRAIT_KEYS)[number];

/** Persona names with no artwork yet (Ini, 2026-11-19): they show the default beaver. */
export const PENDING_ART = Object.freeze([
  "caleb", "chloe", "clara", "dominic", "gideon", "silas", "theodore", "valerie", "winston",
]);

const NAMES: Readonly<Record<string, string>> = {
  arthur: "arthur", barnaby: "barnaby", caleb: "caleb", chloe: "chloe", clara: "clara",
  cornelius: "cornelius", dominic: "dominic", eleanor: "eleanor", gideon: "gideon",
  maxwell: "maxwell", oliver: "oliver", penelope: "penelope", silas: "silas",
  sophia: "sophia", theodore: "theodore", valerie: "valerie", vivian: "vivian",
  winston: "winston", dexter: "manager",
};

type Term = string | RegExp;
const SPECIFIC_ROLES: ReadonlyArray<readonly [string, readonly Term[]]> = [
  ["manager", ["tasksv8-delivery-planner", "delivery planner"]],
  ["winston", ["solutions-architect", "solutions architect", "enterprise-ai", "enterprise ai", "chief-architect", "chief architect"]],
  ["silas", ["telecom", "simster", "campus"]],
  ["caleb", ["field-dispatcher", "field dispatcher", "dispatch"]],
  ["chloe", ["guest-experience", "guest experience", "hotel-concierge", "hotel concierge", "travel-concierge", "travel concierge", "travel"]],
  ["gideon", ["platform-engineer", "platform engineer", "integration-engineer", "integration engineer", "software-factory", "software factory", "forge"]],
  ["theodore", ["telemetry", "observab", "meridian", "state-graph", "state graph", "topology", /\bsre\b/]],
];

const RUNTIME_ROLES: ReadonlyArray<readonly [string, readonly Term[]]> = [
  ["sophia", ["support", "supplier", "purchasing", "procurement"]],
  ["vivian", ["reception", "voice", "intake", "nurse", "coordinator", "debt-resolution"]],
  ["cornelius", ["document lifecycle", "document-lifecycle", "lifecycle", "records"]],
  ["oliver", ["knowledge", "curator"]],
  ["penelope", ["answer quality", "answer-quality", "analyst", "quality"]],
  ["arthur", ["bookkeeper", "finance", "receivables", "accountant", "personal assistant", "personal-assistant", "executive assistant", "executive-assistant"]],
  ["barnaby", ["inventory", "maintenance", "facilities", "field-supervisor", "schedule"]],
  ["maxwell", ["lead", "growth", "revenue", "revops", "pipeline", "concierge", "property"]],
  ["eleanor", ["governance", "govern", "compliance", "complian", "hipaa", "privacy", "fdcpa", "sentinel"]],
];

function rawPortraitKey(...labels: Array<string | null | undefined>): string {
  const all = labels.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.toLowerCase().trim()).join(" ");
  if (/\bintern\b/.test(all)) return "intern";
  for (const word of all.split(/[^a-z]+/)) if (NAMES[word]) return NAMES[word];
  const hit = (t: Term) => (typeof t === "string" ? all.includes(t) : t.test(all));
  for (const [key, terms] of SPECIFIC_ROLES) if (terms.some(hit)) return key;
  for (const [key, terms] of RUNTIME_ROLES) if (terms.some(hit)) return key;
  return "default";
}

/** The portrait for an employee's visible labels (name, role, kind, in any order). */
export function portraitKey(...labels: Array<string | null | undefined>): PortraitKey {
  const key = rawPortraitKey(...labels);
  return (PENDING_ART.includes(key) || !(PORTRAIT_KEYS as readonly string[]).includes(key) ? "default" : key) as PortraitKey;
}

/** CSS sizes with WebP files in public/avatars (each also has its 2x file). */
export const PORTRAIT_SIZES = Object.freeze([28, 32, 40, 48, 112] as const);

/**
 * Small WebP for a CSS slot (1x) and its 2x, with explicit width and height.
 * Slots without an exact file (e.g. 20, 24, 36, 96) use the next size up.
 */
export function portraitSources(key: string, cssSize: number, base = "/avatars"): { src: string; srcSet: string; width: number; height: number } {
  const k = (PORTRAIT_KEYS as readonly string[]).includes(key) ? key : "default";
  const file = PORTRAIT_SIZES.find((s) => s >= cssSize) ?? PORTRAIT_SIZES[PORTRAIT_SIZES.length - 1];
  return { src: `${base}/beaver-${k}-${file}.webp`, srcSet: `${base}/beaver-${k}-${file}.webp 1x, ${base}/beaver-${k}-${file * 2}.webp 2x`, width: cssSize, height: cssSize };
}

/**
 * True for an avatar URL the data really customises (an uploaded image or an
 * external URL). The app's older stock beaver paths (/avatars/<name>.jpg,
 * including the missing /avatars/alex.jpg) are role-portrait choices, not
 * custom art, so they resolve through portraitKey instead.
 */
export function isCustomAvatarUrl(url?: string | null): url is string {
  if (!url || !url.trim()) return false;
  return !/^\/avatars\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(url.trim());
}

/** SupportV8 names AI employees "Alex — Support Intelligence Lead": the visible name is the part before the dash. */
export function employeeDisplayName(name = ""): string {
  return name.split("—")[0].trim() || name.trim();
}
