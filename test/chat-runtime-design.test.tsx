// @vitest-environment jsdom
// SupportV8 chat surfaces follow ServiceV8 Runtime's chat design (messages and composer).
import React, { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMessage, PlainChatText } from "@/components/chat-ui/ChatMessage";
import { ChatTranscript, FOLLOW_THRESHOLD_PX, isNearBottom } from "@/components/chat-ui/ChatTranscript";
import { FormattedChatMessage } from "@/components/chat-ui/FormattedChatMessage";
import { handleChatComposerKeyDown } from "@/components/chat-ui/composer-keys";
import { AskWorkspaceView } from "@/components/views/AskWorkspaceView";
import { CopilotConsoleModal } from "@/components/views/dashboard/CopilotConsoleModal";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

function mount(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(ui));
  return container;
}
function type(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => { setter.call(textarea, value); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
}
function key(textarea: HTMLTextAreaElement, init: KeyboardEventInit & { isComposing?: boolean }) {
  act(() => { textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })); });
}
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

beforeEach(() => {
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });
});
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("message anatomy", () => {
  it("puts the metadata row (portrait, name, role, time) before the body of an assistant reply", () => {
    const c = mount(
      <ChatMessage kind="assistant" author="Alex" role="Senior Support Employee" time="09:41" portrait={{ name: "Alex", role: "Senior Support Employee" }}>
        <FormattedChatMessage content={"## Next steps\n- Check the **gateway**\n- Run `sync`"} />
      </ChatMessage>,
    );
    const bubble = c.querySelector("article.chat-bubble.assistant")!;
    expect([...bubble.children].map((el) => el.className)).toEqual(["chat-meta", "chat-body"]);
    const meta = bubble.querySelector(".chat-meta")!;
    expect(meta.querySelector(".chat-author-name")!.textContent).toBe("Alex");
    expect(meta.querySelector(".chat-author-role")!.textContent).toBe("Senior Support Employee");
    expect(meta.lastElementChild!.className).toBe("chat-time");
    expect(meta.lastElementChild!.tagName).toBe("TIME");
    const portrait = meta.querySelector("img.employee-avatar") as HTMLImageElement;
    expect(portrait.getAttribute("alt")).toBe("");
    expect(portrait.getAttribute("width")).toBe("28");
    expect(portrait.getAttribute("src")).toBe("/avatars/beaver-sophia-28.webp");
    expect(portrait.getAttribute("srcset")).toBe("/avatars/beaver-sophia-28.webp 1x, /avatars/beaver-sophia-56.webp 2x");
    // Formatting is rendered as elements and text, never raw HTML.
    expect(bubble.querySelector("h3.chat-heading-2")!.textContent).toBe("Next steps");
    expect(bubble.querySelectorAll(".chat-bullet-list li")).toHaveLength(2);
    expect(bubble.querySelector(".chat-body strong")!.textContent).toBe("gateway");
    expect(bubble.querySelector("code.chat-inline-code")!.textContent).toBe("sync");
  });

  it("keeps a visible You on the reader's own messages, with no portrait, and renders typed text as text", () => {
    const c = mount(<ChatMessage kind="user" author="You" time="09:42"><PlainChatText content={"<b>hi</b>\nsecond line"} /></ChatMessage>);
    const bubble = c.querySelector("article.chat-bubble.user")!;
    expect(bubble.querySelector(".chat-author-name")!.textContent).toBe("You");
    expect(bubble.querySelector("img")).toBeNull();
    expect(bubble.querySelector("b")).toBeNull();
    expect(bubble.querySelector(".chat-plain")!.textContent).toBe("<b>hi</b>\nsecond line");
  });

  it("gives system notices the warning treatment", () => {
    const c = mount(<ChatMessage kind="system" author="SupportV8" time="09:43"><FormattedChatMessage content="Switched to **Alex**" /></ChatMessage>);
    expect(c.querySelector("article.chat-bubble.system .chat-author-name")!.textContent).toBe("SupportV8");
    const css = source("src/app/support-chat.css");
    expect(css).toMatch(/\.chat-bubble\.system \{[^}]*var\(--sv8-warning-text\)[^}]*var\(--sv8-warning-bg\)/);
    expect(css).toMatch(/\.chat-bubble \{[^}]*max-width: min\(680px, 95%\);[^}]*padding: 16px 18px;[^}]*var\(--sv8-radius-md\)[^}]*overflow-wrap: anywhere;[^}]*box-shadow: none;/);
    expect(css).toMatch(/\.chat-bubble\.user \{[^}]*align-self: flex-end;[^}]*var\(--sv8-selected\)/);
  });
});

describe("transcript", () => {
  it("is a focusable polite log named Messages", () => {
    const c = mount(<ChatTranscript><p>one</p></ChatTranscript>);
    const log = c.querySelector(".chat-transcript")!;
    expect(log.getAttribute("role")).toBe("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
    expect(log.getAttribute("aria-label")).toBe("Messages");
    expect(log.getAttribute("tabindex")).toBe("0");
  });

  it("follows only within 64px of the bottom", () => {
    expect(FOLLOW_THRESHOLD_PX).toBe(64);
    expect(isNearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 536 })).toBe(true);
    expect(isNearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 535 })).toBe(false);
  });
});

describe("composer keys", () => {
  const event = (init: { key: string; shiftKey?: boolean; isComposing?: boolean }) => {
    const preventDefault = vi.fn();
    return { key: init.key, shiftKey: !!init.shiftKey, preventDefault, nativeEvent: { isComposing: !!init.isComposing } } as any;
  };
  it("sends on Enter, keeps Shift+Enter and IME composition for the text, and never sends while pending", () => {
    const send = vi.fn();
    handleChatComposerKeyDown(event({ key: "Enter" }), send);
    expect(send).toHaveBeenCalledTimes(1);
    handleChatComposerKeyDown(event({ key: "Enter", shiftKey: true }), send);
    handleChatComposerKeyDown(event({ key: "Enter", isComposing: true }), send);
    expect(send).toHaveBeenCalledTimes(1);
    const pending = event({ key: "Enter" });
    handleChatComposerKeyDown(pending, send, true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(pending.preventDefault).toHaveBeenCalled();
  });
});

// Portrait resolution and files: test/portraits-canonical.test.tsx.

describe("AgenticOS chat (AskWorkspaceView)", () => {
  const employee = { id: "emp_support_lead", name: "Alex — Support Intelligence Lead", role: "Senior Support Employee", level: "ai_employee", autonomyLevel: "high" };
  const view = (props: Partial<React.ComponentProps<typeof AskWorkspaceView>>) => (
    <AskWorkspaceView workforce={[employee]} selectedEmployeeId="emp_support_lead" onSelectEmployee={vi.fn()} messages={[]} onSendMessage={vi.fn()} onClearChat={vi.fn()} onChatAction={vi.fn()} loading={false} {...props} />
  );

  it("names the recipient in the header and the To: summary, and attributes You and the employee", () => {
    const c = mount(view({ messages: [
      { id: "u1", role: "user", content: "Status?", timestamp: "09:00" },
      { id: "a1", role: "assistant", content: "**All clear**", employeeId: "emp_support_lead", employeeName: "Alex — Support Intelligence Lead", employeeRole: "Senior Support Employee", timestamp: "09:01" },
      { id: "s1", role: "system", content: "Switched persona", timestamp: "09:02" },
    ] }));
    expect(c.querySelector('[data-testid="chat-room-heading"]')!.textContent).toBe("Speak with Alex");
    expect(c.querySelector(".chat-recipient-summary")!.textContent).toBe("To: Alex");
    expect(c.querySelector("label[for='ask-chat-message']")!.textContent).toBe("Message your AI team");
    const log = c.querySelector('[role="log"]')!;
    expect(log.querySelector(".chat-bubble.user .chat-author-name")!.textContent).toBe("You");
    expect(log.querySelector(".chat-bubble.assistant .chat-author-name")!.textContent).toBe("Alex");
    expect(log.querySelector(".chat-bubble.assistant img")!.getAttribute("alt")).toBe("");
    expect(log.querySelector(".chat-bubble.system")).not.toBeNull();
    // Roster rows: 40px portrait, name and muted role.
    const row = c.querySelector(".chat-person[aria-pressed='true']")!;
    expect(row.querySelector("img")!.getAttribute("width")).toBe("40");
    expect(row.textContent).toContain("Senior Support Employee");
  });

  it("sends on Enter, keeps the draft read-only while pending, clears it on success", async () => {
    let resolve!: (v: boolean) => void;
    const onSendMessage = vi.fn(() => new Promise<boolean>((r) => { resolve = r; }));
    const c = mount(view({ onSendMessage }));
    const textarea = c.querySelector("textarea")!;
    type(textarea, "Line one");
    key(textarea, { key: "Enter", shiftKey: true });
    expect(onSendMessage).not.toHaveBeenCalled();
    key(textarea, { key: "Enter" });
    expect(onSendMessage).toHaveBeenCalledWith("Line one");
    await flush();
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toBe("Line one");
    expect(c.querySelector(".chat-recipient-summary")!.textContent).toBe("Sending to Alex…");
    expect(c.querySelector(".chat-pending")!.getAttribute("role")).toBe("status");
    await act(async () => { resolve(true); });
    await flush();
    expect(textarea.readOnly).toBe(false);
    expect(textarea.value).toBe("");
  });

  it("keeps the draft and shows the error beside it when no reply arrives", async () => {
    const c = mount(view({ onSendMessage: vi.fn(async () => false) }));
    const textarea = c.querySelector("textarea")!;
    type(textarea, "Will this fail?");
    key(textarea, { key: "Enter" });
    await flush();
    expect(textarea.value).toBe("Will this fail?");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(c.querySelector(".chat-compose-error[role='alert']")!.textContent).toContain("Your draft is still here");
  });
});

describe("Workforce Chat console (CopilotConsoleModal)", () => {
  it("is read-only while a reply is pending and keeps the draft on failure", async () => {
    const handleAskChat = vi.fn(async () => false);
    const props = { chatMessages: [], handleChatAction: vi.fn(), handleClearChat: vi.fn(), handleSelectEmployee: vi.fn(), selectedEmployeeId: "", setChatQuery: vi.fn(), setIsChatOpen: vi.fn(), setShowModalPrompts: vi.fn(), showModalPrompts: false, workforce: [] };
    const pending = mount(<CopilotConsoleModal {...props} chatLoading chatQuery="draft" handleAskChat={handleAskChat} />);
    expect(pending.querySelector("textarea")!.readOnly).toBe(true);
    expect(pending.querySelector('[data-testid="chat-room-heading"]')!.textContent).toBe("Speak with SupportV8 RAG Intelligence");
    document.body.innerHTML = "";
    const c = mount(<CopilotConsoleModal {...props} chatLoading={false} chatQuery="draft" handleAskChat={handleAskChat} />);
    key(c.querySelector("textarea")!, { key: "Enter" });
    await flush();
    expect(handleAskChat).toHaveBeenCalled();
    expect(props.setChatQuery).not.toHaveBeenCalledWith("");
    expect(c.querySelector(".chat-compose-error")!.textContent).toContain("Your draft is still here");
  });
});

describe("customer chat widget", () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k), clear: () => storage.clear() });
    vi.stubGlobal("EventSource", class { addEventListener() {} removeEventListener() {} close() {} });
    storage.set("supportv8_client_session_acme", JSON.stringify({ email: "sam@example.com", name: "Sam", tenantSlug: "acme" }));
  });
  async function openWidget() {
    const c = mount(<SupportChatWidget tenantSlug="acme" />);
    await flush();
    await act(async () => { window.dispatchEvent(new CustomEvent("supportv8:open-chat", { detail: { stream: "customers" } })); });
    await flush();
    return c;
  }

  it("renders the conversation as a polite log with a labelled composer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session: null }) }));
    const c = await openWidget();
    const log = document.body.querySelector('[role="log"][aria-label="Messages"]');
    expect(log).not.toBeNull();
    expect(document.body.querySelector("label[for='support-widget-message']")).not.toBeNull();
    expect(c).toBeTruthy();
  });

  it("keeps the customer's draft, read-only while sending, and after a failed send with the error beside it", async () => {
    let fail!: () => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("/api/chat/session")) return new Promise((_, reject) => { fail = () => reject(new Error("Unable to start a durable chat session")); });
      return Promise.resolve({ ok: true, json: async () => ({ session: null }) });
    }));
    await openWidget();
    const textarea = document.body.querySelector("#support-widget-message") as HTMLTextAreaElement;
    type(textarea, "My order is late");
    key(textarea, { key: "Enter" });
    await flush();
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toBe("My order is late");
    expect(document.body.querySelector(".chat-bubble.user .chat-author-name")!.textContent).toBe("You");
    await act(async () => { fail(); });
    await flush();
    expect(textarea.readOnly).toBe(false);
    expect(textarea.value).toBe("My order is late");
    expect(document.body.querySelector("#support-widget-error")!.textContent).toContain("Unable to start");
  });
});

describe("operator workdesk conversation", () => {
  const view = source("src/components/views/FocusedWorkspaceView.tsx");
  it("renders the live chat as a polite log with Runtime's message anatomy and 64px follow rule", () => {
    expect(view).toMatch(/className="chat-transcript compact[^"]*"\s+role="log"\s+aria-live="polite"\s+aria-label="Messages"\s+tabIndex=\{0\}/);
    expect(view).toContain("isNearLiveChatEdge(event.currentTarget, FOLLOW_THRESHOLD_PX)");
    expect(view).toMatch(/kind="user"\s+author=\{!msg.senderName \|\| msg.senderName === operatorName \? "You" : msg.senderName\}/);
    expect(view).toContain('portrait={isAi ? { name: msg.senderName || "", src: (msg as { senderAvatar?: string }).senderAvatar } : null}');
  });
  it("keeps the live reply draft on failure and sends on Enter only on the chat channel", () => {
    expect(view).toContain('setLiveReplyError("Your reply was not sent. Your draft is still here; try again.")');
    expect(view).toContain('if (commChannel === "chat") handleChatComposerKeyDown(e, () => void sendLiveReply(), isSendingOperatorReply);');
    expect(view).toContain("readOnly={isSendingOperatorReply}");
  });
});
