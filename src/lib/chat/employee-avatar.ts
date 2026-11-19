// Standard ServiceV8 workforce portraits, resolved in Runtime's order
// (servicev8-agentic-runtime src/lib/employee-avatar.ts). Presentation only:
// never identity, hiring, readiness or authority.
const personas = ["arthur", "barnaby", "cornelius", "eleanor", "maxwell", "oliver", "penelope", "sophia", "vivian"] as const;

export function employeeAvatar(name = "", role = "", kind?: "employee" | "intern"): string {
  const label = `${name} ${role}`.toLowerCase();
  if (kind === "intern" || /\bintern(?:s|ship)?\b/.test(label)) return "/avatars/beaver-intern.jpg";
  const persona = personas.find((p) => new RegExp(`\\b${p}\\b`).test(name.toLowerCase()));
  if (persona) return `/avatars/beaver-${persona}.jpg`;
  if (/support|supplier|purchasing/.test(label)) return "/avatars/beaver-sophia.jpg";
  if (/reception|voice|intake|nurse|coordinator/.test(label)) return "/avatars/beaver-vivian.jpg";
  if (/document-lifecycle|lifecycle/.test(label)) return "/avatars/beaver-cornelius.jpg";
  if (/knowledge|curator/.test(label)) return "/avatars/beaver-oliver.jpg";
  if (/answer-quality|analyst|quality/.test(label)) return "/avatars/beaver-penelope.jpg";
  if (/bookkeeper|finance/.test(label)) return "/avatars/beaver-arthur.jpg";
  if (/inventory|maintenance|schedule/.test(label)) return "/avatars/beaver-barnaby.jpg";
  if (/lead|growth|concierge|property/.test(label)) return "/avatars/beaver-maxwell.jpg";
  if (/govern|complian|hipaa|privacy/.test(label)) return "/avatars/beaver-eleanor.jpg";
  return "/avatars/beaver-default.jpg";
}

/** SupportV8 names AI employees "Alex — Support Intelligence Lead": the visible name is the part before the dash. */
export function employeeDisplayName(name = ""): string {
  return name.split("—")[0].trim() || name.trim();
}

/** Portrait sizes with generated WebP copies (scripts/resize-avatars.py makes 1x and 2x of each). */
export const AVATAR_SIZES = [28, 40] as const;

/**
 * Small WebP copies of the resolved portrait for a 28px or 40px slot, as src
 * and srcset (1x, 2x), so chat never downloads the full-size JPEG.
 */
export function employeeAvatarSources(name = "", role = "", kind?: "employee" | "intern", size = 40): { src: string; srcSet: string } {
  const base = employeeAvatar(name, role, kind).replace(/\.jpg$/, "");
  const slot = AVATAR_SIZES.find((s) => s >= size) ?? AVATAR_SIZES[AVATAR_SIZES.length - 1];
  return { src: `${base}-${slot}.webp`, srcSet: `${base}-${slot}.webp 1x, ${base}-${slot * 2}.webp 2x` };
}
