/**
 * One message in SupportV8's chat surfaces, with ServiceV8 Runtime's anatomy:
 * a metadata row (portrait for AI employees, visible name, @handle and role,
 * then the time) before the body. User messages align right with the selected
 * fill and keep a visible "You"; assistant replies are bordered surfaces;
 * system notices use the warning treatment.
 */
import React, { type ReactNode } from "react";
import { EmployeeAvatar } from "./EmployeeAvatar";

/** Message times as the reader's local time; ISO timestamps (e.g. optimistic messages) become "09:41". */
export function formatChatTime(value?: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export type ChatMessageKind = "user" | "assistant" | "system";

export function ChatMessage({
  kind,
  author,
  handle,
  role,
  time,
  portrait,
  children,
  footer,
  className = "",
  testId,
}: {
  kind: ChatMessageKind;
  /** The visible sender name ("You" for the reader's own messages). */
  author: string;
  /** Only when the app really has one; never invented. */
  handle?: string;
  role?: string;
  time?: string;
  /** AI employees and assistants only: the name/role the portrait is resolved from. */
  portrait?: { name: string; role?: string; kind?: "employee" | "intern"; src?: string | null } | null;
  children: ReactNode;
  /** Citations, actions or delivery state, after the body. */
  footer?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <article className={`chat-bubble ${kind} ${className}`.trim()} data-testid={testId}>
      <div className="chat-meta">
        <strong className="chat-author">
          {portrait && <EmployeeAvatar name={portrait.name} role={portrait.role} kind={portrait.kind} src={portrait.src} size={28} />}
          <span className="chat-author-text">
            <span className="chat-author-name">{author}</span>
            {handle && <small className="employee-handle">@{handle}</small>}
            {role && <small className="chat-author-role">{role}</small>}
          </span>
        </strong>
        {time && <time className="chat-time" dateTime={/^\d{4}-/.test(time) ? time : undefined}>{formatChatTime(time)}</time>}
      </div>
      <div className="chat-body">{children}</div>
      {footer}
    </article>
  );
}

/** Text a person typed, kept as written (line breaks preserved, no formatting applied). */
export function PlainChatText({ content }: { content: string }) {
  return <p className="chat-plain">{content}</p>;
}
