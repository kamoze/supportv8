export interface PortalAnalyticsSummary {
  totalRequests: number;
  successfulRequests: number;
  noResultRequests: number;
  unavailableRequests: number;
  rateLimitedRequests: number;
  averageDurationMs: number;
}

export interface PortalActionAnalytics {
  actionSlug: string;
  totalRequests: number;
  successfulRequests: number;
  noResultRequests: number;
  unavailableRequests: number;
  rateLimitedRequests: number;
  averageDurationMs: number;
  lastUsedAt: string | null;
}

export interface PortalAnalytics {
  windowDays: number;
  summary: PortalAnalyticsSummary;
  actions: PortalActionAnalytics[];
}

export function emptyPortalAnalytics(windowDays = 30): PortalAnalytics {
  return {
    windowDays,
    summary: {
      totalRequests: 0,
      successfulRequests: 0,
      noResultRequests: 0,
      unavailableRequests: 0,
      rateLimitedRequests: 0,
      averageDurationMs: 0,
    },
    actions: [],
  };
}
