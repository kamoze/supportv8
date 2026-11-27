"use client";

import { useEffect, useState } from "react";

let cached: Promise<boolean> | null = null;

/** Reads GET /api/demo/status once per page load. Fails closed: false until the server says otherwise. */
export function loadSupportDemoEnabled(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  cached ??= fetchImpl("/api/demo/status", { credentials: "same-origin", cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => payload?.success === true && payload.enabled === true)
    .catch(() => false);
  return cached;
}

/** Test seam: forget the cached answer. */
export function resetSupportDemoEnabledCache(): void {
  cached = null;
}

export function useSupportDemoEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    void loadSupportDemoEnabled().then((value) => { if (live) setEnabled(value); });
    return () => { live = false; };
  }, []);
  return enabled;
}
