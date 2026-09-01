const MESSAGE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export interface ChatMessageCursor {
  createdAt: string;
  messageId: string;
}

export class InvalidChatMessageCursorError extends Error {
  constructor() {
    super("Invalid chat message cursor");
    this.name = "InvalidChatMessageCursorError";
  }
}

export function encodeChatMessageCursor(createdAt: Date | string, messageId: string): string {
  const timestamp = createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
  if (!MESSAGE_ID_PATTERN.test(messageId)) throw new InvalidChatMessageCursorError();
  return `${timestamp}|${messageId}`;
}

export function decodeChatMessageCursor(value: string | null | undefined): ChatMessageCursor | null {
  if (!value) return null;
  const separator = value.lastIndexOf("|");
  if (separator <= 0) throw new InvalidChatMessageCursorError();
  const createdAt = value.slice(0, separator);
  const messageId = value.slice(separator + 1);
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime()) || !MESSAGE_ID_PATTERN.test(messageId)) {
    throw new InvalidChatMessageCursorError();
  }
  return { createdAt: parsed.toISOString(), messageId };
}
