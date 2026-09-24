// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskWorkspaceView } from "@/components/views/AskWorkspaceView";
import { DEFAULT_RAG_ASSISTANT } from "@/app/page";

const roots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots.length = 0;
  document.body.innerHTML = "";
});

describe("AskWorkspaceView RAG Integration", () => {
  it("provides DEFAULT_RAG_ASSISTANT and enables the ask interface when workforce is empty", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    const onSendMessage = vi.fn();

    act(() => {
      root.render(
        <AskWorkspaceView
          workforce={[]}
          selectedEmployeeId=""
          onSelectEmployee={vi.fn()}
          messages={[]}
          onSendMessage={onSendMessage}
          onClearChat={vi.fn()}
          onChatAction={vi.fn()}
          loading={false}
        />
      );
    });

    // Verify textarea is NOT disabled
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.disabled).toBe(false);
    expect(textarea.placeholder).toContain("Ask SupportV8 RAG Intelligence");

    // Verify prompt suggestions include RAG query
    expect(container.textContent).toContain("Want to check on your inventory");
  });

  it("exports DEFAULT_RAG_ASSISTANT with active role and level", () => {
    expect(DEFAULT_RAG_ASSISTANT.id).toBe("emp_rag_intelligence");
    expect(DEFAULT_RAG_ASSISTANT.name).toBe("SupportV8 RAG Intelligence");
    expect(DEFAULT_RAG_ASSISTANT.role).toContain("Knowledge Retrieval");
    expect(DEFAULT_RAG_ASSISTANT.isHired).toBe(true);
  });
});
