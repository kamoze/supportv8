import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";

describe("Work Desk empty queue", () => {
  it("renders a stable empty state while the initial issue fetch is pending", () => {
    let html = "";

    expect(() => {
      html = renderToStaticMarkup(
        <FocusedWorkspaceView
          issues={[]}
          onResolve={vi.fn()}
          onEscalate={vi.fn()}
          onNavigateToProblems={vi.fn()}
          onExecuteInsight={vi.fn()}
          onNotify={vi.fn()}
        />,
      );
    }).not.toThrow();

    expect(html).toContain("No active conversations yet");
    expect(html).toContain("New Ticket");
    expect(html).toContain("Import CSV");
  });
});
