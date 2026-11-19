"use client";

import React from "react";

/** Placeholder shown for the moment a code-split dashboard view is fetched. */
export function DashboardViewLoading() {
  return (
    <div role="status" aria-live="polite" className="card min-h-[160px] flex items-center justify-center text-xs text-[#B4C2D0]">
      Loading…
    </div>
  );
}

/** Placeholder for a code-split modal: keeps the dimmed backdrop so opening feels immediate. */
export function DashboardModalLoading() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4 text-xs text-[#B4C2D0]">
      Loading…
    </div>
  );
}
