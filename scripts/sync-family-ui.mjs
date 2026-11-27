// Vendors the shared ServiceV8 family shell (@kamoze/servicev8-family-ui) into
// public/vendor/family-ui. SupportV8 serves it from its own origin, so the app
// never depends on a CDN or another ServiceV8 service at runtime.
//
// Usage: node scripts/sync-family-ui.mjs [path-to-family-ui-dist]
// Default source: ../servicev8-agentic-kit/packages/family-ui/dist (run its `npm run build` first).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? join(root, "..", "servicev8-agentic-kit", "packages", "family-ui", "dist"));
const target = join(root, "public", "vendor", "family-ui");
for (const file of ["family.css", "family.min.js"]) {
  if (!existsSync(join(source, file))) throw new Error(`Missing ${file} in ${source}. Build the family-ui package first.`);
}
mkdirSync(target, { recursive: true });
copyFileSync(join(source, "family.css"), join(target, "family.css"));
copyFileSync(join(source, "family.min.js"), join(target, "family.js"));
// React JSX typings for the elements (referenced from src/components/shell/family-elements.d.ts).
if (existsSync(join(source, "jsx.d.ts"))) copyFileSync(join(source, "jsx.d.ts"), join(target, "jsx.d.ts"));
const banner = readFileSync(join(source, "family.css"), "utf8").split("\n", 1)[0];
writeFileSync(join(target, "VERSION"), `${banner.replace(/^\/\*\s*|\s*\*\/$/g, "")}\n`);
console.log(`Vendored ${banner} into ${target}`);
