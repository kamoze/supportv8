import type { KeyboardEvent } from "react";

/** Enter sends, Shift+Enter adds a newline, IME composition is respected (Runtime's ChatComposer rule). */
export function handleChatComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, send: () => void, pending = false): void {
  if (event.nativeEvent.isComposing || (event.nativeEvent as { keyCode?: number }).keyCode === 229) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!pending) send();
  }
}
