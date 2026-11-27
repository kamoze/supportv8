"use client";
/**
 * SupportV8's chat transcript, following ServiceV8 Runtime's ChatTranscript and
 * DESIGN.md: a keyboard-focusable polite log that follows new messages only
 * while the reader is within 64px of the bottom. Scrolling up keeps the
 * reading position; returning near the bottom resumes following.
 */
import React, { useLayoutEffect, useRef, type ReactNode, type Ref } from "react";

export const FOLLOW_THRESHOLD_PX = 64;

export function isNearBottom(viewport: Pick<HTMLElement, "scrollTop" | "clientHeight" | "scrollHeight">, threshold = FOLLOW_THRESHOLD_PX): boolean {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
}

export function ChatTranscript({
  children,
  label = "Messages",
  className = "",
  viewportRef,
  onFollowChange,
  live = "polite",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  /** The scrolling element, for surfaces that already manage an unread marker. */
  viewportRef?: Ref<HTMLDivElement>;
  onFollowChange?: (following: boolean) => void;
  live?: "polite" | "off";
}) {
  const node = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const onFollow = useRef(onFollowChange);
  onFollow.current = onFollowChange;

  useLayoutEffect(() => {
    const viewport = node.current;
    const messages = content.current;
    if (!viewport || !messages) return;
    const follow = () => { if (following.current) viewport.scrollTop = viewport.scrollHeight; };
    const onScroll = () => {
      const next = isNearBottom(viewport);
      if (next !== following.current) { following.current = next; onFollow.current?.(next); }
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const mutation = new MutationObserver(follow);
    mutation.observe(messages, { childList: true, characterData: true, subtree: true });
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(follow) : null;
    resize?.observe(messages);
    viewport.scrollTop = viewport.scrollHeight;
    return () => { viewport.removeEventListener("scroll", onScroll); mutation.disconnect(); resize?.disconnect(); };
  }, []);

  const setRef = (element: HTMLDivElement | null) => {
    node.current = element;
    if (typeof viewportRef === "function") viewportRef(element);
    else if (viewportRef) (viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
  };

  return (
    <div ref={setRef} className={`chat-transcript ${className}`.trim()} role="log" aria-live={live} aria-label={label} tabIndex={0}>
      <div ref={content} className="chat-transcript-content">{children}</div>
    </div>
  );
}
