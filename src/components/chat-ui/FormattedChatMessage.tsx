// Ported from ServiceV8 Runtime (src/app/workspace/[slug]/chat/FormattedChatMessage.tsx).
// Safe formatting: every value is rendered as a React text node, never as HTML.
import React, { type ReactNode } from "react";

interface FormattedChatMessageProps {
  content: string;
}

/**
 * Parses inline formatting: **bold**, *italic*, and `code`
 */
function parseInline(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  // Tokenizer pattern for bold, italic, code
  const pattern = /(\*\*([^*]+)\*\*|_([^_]+)_|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (full.startsWith("**") && full.endsWith("**")) {
      elements.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (full.startsWith("`") && full.endsWith("`")) {
      elements.push(
        <code key={match.index} className="chat-inline-code">
          {match[5]}
        </code>
      );
    } else if (
      (full.startsWith("*") && full.endsWith("*")) ||
      (full.startsWith("_") && full.endsWith("_"))
    ) {
      elements.push(<em key={match.index}>{match[4] || match[3]}</em>);
    } else {
      elements.push(full);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

/**
 * Normalizes text to ensure headers and bullet items start on fresh lines
 * even if line breaks were collapsed during upstream transport.
 */
function normalizeMarkdownText(raw: string): string {
  let normalized = raw.replace(/\r\n/g, "\n");

  // If " ## " or " ### " appears without preceding newline, break into new paragraph
  normalized = normalized.replace(/([^\n])\s+(##{1,3}\s+)/g, "$1\n\n$2");

  // If a heading line has trailing bold text, break into separate paragraph
  normalized = normalized.replace(/(^|\n)(##{1,3}\s+[^\n*]+?)\s+(\*\*[^*\n]+\*\*)/g, "$1$2\n\n$3");

  // If " - " or " * " appears preceded by non-newline, break line
  normalized = normalized.replace(/([^\n])\s+([*-]\s+)/g, "$1\n$2");

  // If " 1. " appears preceded by non-newline, break line
  normalized = normalized.replace(/([^\n])\s+(\d+\.\s+)/g, "$1\n$2");

  return normalized;
}

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let currentUl: string[] | null = null;
  let currentOl: string[] | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(" ").trim();
      if (text) {
        blocks.push({ kind: "p", text });
      }
      currentParagraph = [];
    }
  };

  const flushLists = () => {
    if (currentUl) {
      blocks.push({ kind: "ul", items: currentUl });
      currentUl = null;
    }
    if (currentOl) {
      blocks.push({ kind: "ol", items: currentOl });
      currentOl = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushLists();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushLists();
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushLists();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }

    const ulMatch = line.match(/^[*-]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (currentOl) {
        blocks.push({ kind: "ol", items: currentOl });
        currentOl = null;
      }
      if (!currentUl) currentUl = [];
      currentUl.push(ulMatch[1].trim());
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (currentUl) {
        blocks.push({ kind: "ul", items: currentUl });
        currentUl = null;
      }
      if (!currentOl) currentOl = [];
      currentOl.push(olMatch[1].trim());
      continue;
    }

    // Standard paragraph line
    flushLists();
    currentParagraph.push(line);
  }

  flushParagraph();
  flushLists();

  return blocks;
}

export function FormattedChatMessage({ content }: FormattedChatMessageProps) {
  if (!content) return null;

  const normalized = normalizeMarkdownText(content);
  const blocks = parseBlocks(normalized);

  return (
    <div className="chat-formatted-content">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "h2":
            return (
              <h3 key={index} className="chat-heading-2">
                {parseInline(block.text)}
              </h3>
            );
          case "h3":
            return (
              <h4 key={index} className="chat-heading-3">
                {parseInline(block.text)}
              </h4>
            );
          case "ul":
            return (
              <ul key={index} className="chat-bullet-list">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{parseInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className="chat-ordered-list">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{parseInline(item)}</li>
                ))}
              </ol>
            );
          case "p":
          default:
            return (
              <p key={index} className="chat-paragraph">
                {parseInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
