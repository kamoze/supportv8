/**
 * Parser and validator for Scenario YAML/JSON documents.
 */

import { validateDeclarativeScenario, type DeclarativeScenario } from "./schema";

/**
 * Lightweight zero-dependency YAML parser for declarative scenario manifests.
 * Handles nested objects, lists, scalar types, and comments.
 */
export function parseYamlSimple(text: string): unknown {
  const lines = text.split("\n");
  const root: Record<string, unknown> = {};
  const stack: { indent: number; obj: Record<string, unknown> | unknown[] }[] = [
    { indent: -1, obj: root },
  ];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i]!;
    i++;
    // Strip comments
    const lineWithoutComment = stripComment(rawLine);
    if (!lineWithoutComment.trim()) continue;

    const indent = countLeadingSpaces(rawLine);
    const trimmed = lineWithoutComment.trim();

    // Pop stack to match current indentation
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    const currentParent = stack[stack.length - 1]!.obj;

    // Array item: starts with "- "
    if (trimmed.startsWith("- ")) {
      const itemContent = trimmed.slice(2).trim();
      if (!Array.isArray(currentParent)) {
        // If current parent is not array, this is invalid or misplaced
        continue;
      }

      if (itemContent.includes(":") && !itemContent.startsWith("{") && !itemContent.startsWith("[")) {
        // Object inside array item, e.g. "- operation: ticket.create"
        const [k, ...vParts] = itemContent.split(":");
        const itemObj: Record<string, unknown> = {};
        const key = k!.trim();
        const valStr = vParts.join(":").trim();
        if (valStr) {
          itemObj[key] = parseScalar(valStr);
        }
        currentParent.push(itemObj);
        stack.push({ indent, obj: itemObj });
      } else {
        currentParent.push(parseScalar(itemContent));
      }
      continue;
    }

    // Key-Value pair: "key: value" or "key:"
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const valStr = trimmed.slice(colonIdx + 1).trim();

      if (valStr === "") {
        // Look ahead to see if next non-empty line starts with "- " (array) or key: (object)
        let nextIsArray = false;
        let j = i;
        while (j < lines.length) {
          const nextRaw = stripComment(lines[j]!).trim();
          if (nextRaw) {
            nextIsArray = nextRaw.startsWith("- ");
            break;
          }
          j++;
        }

        const newChild = nextIsArray ? [] : {};
        if (Array.isArray(currentParent)) {
          // Inside an array of objects
          const last = currentParent[currentParent.length - 1];
          if (isRecord(last)) {
            last[key] = newChild;
            stack.push({ indent, obj: newChild });
          }
        } else if (isRecord(currentParent)) {
          currentParent[key] = newChild;
          stack.push({ indent, obj: newChild });
        }
      } else {
        const parsedVal = parseScalar(valStr);
        if (Array.isArray(currentParent)) {
          const last = currentParent[currentParent.length - 1];
          if (isRecord(last)) {
            last[key] = parsedVal;
          }
        } else if (isRecord(currentParent)) {
          currentParent[key] = parsedVal;
        }
      }
    }
  }

  return root;
}

function parseScalar(val: string): unknown {
  const trimmed = val.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;

  // Quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Inline array e.g. ["a", "b"]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inside = trimmed.slice(1, -1).trim();
    if (!inside) return [];
    return inside.split(",").map((s) => parseScalar(s.trim()));
  }

  // Number check
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num;
  }

  return trimmed;
}

function countLeadingSpaces(str: string): number {
  let count = 0;
  for (const char of str) {
    if (char === " ") count++;
    else break;
  }
  return count;
}

function stripComment(str: string): string {
  const hashIdx = str.indexOf("#");
  if (hashIdx < 0) return str;
  return str.slice(0, hashIdx);
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

/**
 * Parses a YAML string into a validated DeclarativeScenario.
 * Throws InvalidScenarioError if parsing or schema validation fails.
 */
export function parseDeclarativeScenario(yamlOrJson: string): DeclarativeScenario {
  const trimmed = yamlOrJson.trim();
  let raw: unknown;
  if (trimmed.startsWith("{")) {
    try {
      raw = JSON.parse(trimmed);
    } catch (e) {
      throw new Error(`Invalid scenario JSON: ${(e as Error).message}`);
    }
  } else {
    raw = parseYamlSimple(trimmed);
  }

  return validateDeclarativeScenario(raw);
}
