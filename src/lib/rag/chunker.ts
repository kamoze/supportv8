/**
 * supportV8 Heading-Based Hierarchical Chunker
 * Directly matching KnowledgeV8 RAG architecture (§4 Chunker).
 *
 * Sections stay whole so the embedding sees coherent semantic units.
 * Section paths (e.g. "Architecture > Ingestion") are captured and
 * the full body is preserved for long-context progressive expansion.
 */

export interface Chunk {
  /** Heading path, e.g. "Architecture" or "Architecture > Ingestion"; null for the preamble. */
  section: string | null;
  content: string;
}

export const MAX_CHUNK_CHARS = 6000; // ~1.5K tokens; oversized sections split on paragraphs

export function chunkBody(body: string): Chunk[] {
  const lines = body.split("\n");
  const chunks: Chunk[] = [];
  const headingStack: { level: number; text: string }[] = [];
  let current: string[] = [];
  let currentSection: string | null = null;
  let inFence = false;

  const flush = () => {
    const content = current.join("\n").trim();
    if (content) {
      for (const piece of splitOversized(content)) {
        chunks.push({ section: currentSection, content: piece });
      }
    }
    current = [];
  };

  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) inFence = !inFence;
    const heading = !inFence && line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1]!.length;
      while (headingStack.length && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text: heading[2]!.trim() });
      currentSection = headingStack.map((h) => h.text).join(" > ");
      current.push(line);
    } else {
      current.push(line);
    }
  }
  flush();
  return chunks;
}

function splitOversized(content: string): string[] {
  if (content.length <= MAX_CHUNK_CHARS) return [content];
  const out: string[] = [];
  let buf = "";
  for (const para of content.split(/\n\n+/)) {
    for (const piece of hardSplit(para)) {
      if (buf && buf.length + piece.length + 2 > MAX_CHUNK_CHARS) {
        out.push(buf);
        buf = piece;
      } else {
        buf = buf ? `${buf}\n\n${piece}` : piece;
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

function hardSplit(para: string): string[] {
  if (para.length <= MAX_CHUNK_CHARS) return [para];
  const out: string[] = [];
  let buf = "";
  for (const line of para.split("\n")) {
    if (line.length > MAX_CHUNK_CHARS) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      for (let i = 0; i < line.length; i += MAX_CHUNK_CHARS) {
        out.push(line.slice(i, i + MAX_CHUNK_CHARS));
      }
    } else if (buf && buf.length + line.length + 1 > MAX_CHUNK_CHARS) {
      out.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf) out.push(buf);
  return out;
}
