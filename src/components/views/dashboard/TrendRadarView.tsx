"use client";

import React from "react";
import { AlertTriangle, BarChart3, CheckCircle2, RefreshCw, TrendingUp, Zap } from "@/components/ui/FlatIcon";
import type { Insight } from "@/lib/types";

export interface TrendRadarViewProps {
  fetchData: (overrideTenant?: string) => Promise<void>;
  handleExecuteInsight: (insightId: string) => Promise<void>;
  insights: Insight[];
  trends: { series: any[]; anomalies: any[]; };
}

export function TrendRadarView({
  fetchData,
  handleExecuteInsight,
  insights,
  trends,
}: TrendRadarViewProps) {
          const displaySeries = trends.series || [];
          const displayAnomalies = trends.anomalies || [];
          const displayInsights = insights || [];

          if (displaySeries.length === 0) {
            return (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                        <TrendingUp className="w-5 h-5" />
                      </span>
                      <h2 className="text-xl font-bold text-[#EAF1F8]">Trends Analysis</h2>
                      <span className="pill ok text-[10px] font-mono">EP13 / EP14 TELEMETRY</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => fetchData()}
                      className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Radar</span>
                    </button>
                  </div>
                </div>

                <div className="card p-12 text-center border-[var(--line)] bg-[#121A24] flex flex-col items-center justify-center space-y-3">
                  <span className="p-3 rounded-2xl bg-[#2ED8B6]/10 text-[#2ED8B6] border border-[#2ED8B6]/20">
                    <TrendingUp className="w-8 h-8 opacity-75" />
                  </span>
                  <h3 className="text-base font-bold text-[#EAF1F8]">No Trends</h3>
                  <p className="text-xs text-[#6B7C8D] max-w-md">
                    No ticket velocity or anomaly telemetry recorded for this workspace. Telemetry rolls up automatically as customer inquiries arrive.
                  </p>
                </div>
              </div>
            );
          }

          const maxVolume = Math.max(...displaySeries.map((s) => s.totalVolume), 1);
          const latestPoint = displaySeries[displaySeries.length - 1];
          const firstPoint = displaySeries[0];
          const priorPoints = displaySeries.slice(0, -1);
          const priorVolumeSum = priorPoints.reduce((sum, p) => sum + p.totalVolume, 0);
          const baselineAvg = priorPoints.length > 0 ? Math.round(priorVolumeSum / priorPoints.length) : firstPoint.totalVolume;
          const volumeGrowth = baselineAvg > 0
            ? Math.round(((latestPoint.totalVolume - baselineAvg) / baselineAvg) * 100)
            : (latestPoint.totalVolume > 0 ? 100 : 0);

          const priorCheckoutSum = priorPoints.reduce((sum, p) => sum + p.checkoutFailures, 0);
          const priorCheckoutAvg = priorPoints.length > 0 ? priorCheckoutSum / priorPoints.length : 0;
          const checkoutSurgePct = priorCheckoutAvg > 0
            ? Math.round(((latestPoint.checkoutFailures - priorCheckoutAvg) / priorCheckoutAvg) * 100)
            : (latestPoint.checkoutFailures > 0 ? 100 : 0);

          const peakCsat = Math.max(...displaySeries.map((s) => s.csat));
          const csatDiff = Math.round((latestPoint.csat - firstPoint.csat) * 10) / 10;
          const csatDeltaText = csatDiff > 0 ? `+${csatDiff} pts` : `${csatDiff} pts`;
          const csatSubtext = peakCsat > latestPoint.csat
            ? `Down from ${peakCsat}% 7-day peak`
            : "At 7-day peak";

          const sentimentDiff = latestPoint.sentimentNegativePct - firstPoint.sentimentNegativePct;
          const sentimentDeltaText = sentimentDiff > 0 ? `+${sentimentDiff}%` : `${sentimentDiff}%`;

          return (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                      <TrendingUp className="w-5 h-5" />
                    </span>
                    <h2 className="text-xl font-bold text-[#EAF1F8]">Trends Analysis</h2>
                    <span className="pill ok text-[10px] font-mono">EP13 / EP14 TELEMETRY</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => fetchData()}
                    className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Radar</span>
                  </button>
                </div>
              </div>

              {/* 4 Trend Scorecard KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">7-Day Velocity Surge</span>
                    <span className={`text-[10px] font-mono font-bold ${volumeGrowth > 0 ? "text-[#E5484D]" : "text-[#4CC38A]"}`}>
                      {volumeGrowth >= 0 ? `+${volumeGrowth}%` : `${volumeGrowth}%`}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-[#EAF1F8]">{latestPoint.totalVolume} / day</div>
                  <p className="text-[11px] text-[#6B7C8D]">Rolling baseline: {baselineAvg} tickets/day</p>
                </div>

                <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Checkout Failures</span>
                    <span className={`pill ${latestPoint.checkoutFailures > 0 ? "err" : "ok"} text-[10px] font-mono`}>
                      {latestPoint.checkoutFailures > 0 ? "CRITICAL" : "NORMAL"}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-[#E5484D]">{latestPoint.checkoutFailures} today</div>
                  <p className="text-[11px] text-[#E5484D]/90">
                    {checkoutSurgePct > 0 ? `+${checkoutSurgePct}% surge vs 7-day average` : "Within normal baseline"}
                  </p>
                </div>

                <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Negative Sentiment</span>
                    <span className="text-[10px] font-mono font-bold text-[#F5A623]">{sentimentDeltaText}</span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-[#F5A623]">{latestPoint.sentimentNegativePct}%</div>
                  <p className="text-[11px] text-[#6B7C8D]">
                    {latestPoint.sentimentNegativePct > 30 ? "Elevated ticket frustration ratio" : "Sentiment within healthy range"}
                  </p>
                </div>

                <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">CSAT Trend</span>
                    <span className={`text-[10px] font-mono font-bold ${csatDiff >= 0 ? "text-[#4CC38A]" : "text-[#E5484D]"}`}>
                      {csatDeltaText}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold font-mono text-[#2ED8B6]">{latestPoint.csat}%</div>
                  <p className="text-[11px] text-[#6B7C8D]">{csatSubtext}</p>
                </div>
              </div>

              {/* 7-Day Velocity & Category Drift Series */}
              <div className="card p-5 space-y-4 rounded-2xl border-[var(--line)] bg-[#121A24]">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
                      Velocity Matrix
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B7C8D]">Daily Telemetry Rollup</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-[var(--line)] text-[10px] font-mono text-[#6B7C8D] uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Total Volume</th>
                        <th className="py-2.5 px-3">Volume Curve</th>
                        <th className="py-2.5 px-3">Checkout 504</th>
                        <th className="py-2.5 px-3">SSO / Auth</th>
                        <th className="py-2.5 px-3">Billing</th>
                        <th className="py-2.5 px-3">MFA SMS</th>
                        <th className="py-2.5 px-3 text-right">CSAT</th>
                        <th className="py-2.5 px-3 text-right">Neg Sentiment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line-2)] font-mono text-xs">
                      {displaySeries.map((row, idx) => {
                        const pctWidth = Math.round((row.totalVolume / maxVolume) * 100);
                        const isLatest = idx === displaySeries.length - 1;
                        return (
                          <tr
                            key={row.date}
                            className={`hover:bg-[#18222E]/60 transition-colors ${
                              isLatest ? "bg-[#18222E]/40 font-semibold" : ""
                            }`}
                          >
                            <td className="py-3 px-3 text-[#EAF1F8]">
                              <span className="flex items-center gap-1.5">
                                {row.date}
                                {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6]" />}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[#EAF1F8] font-bold">{row.totalVolume}</td>
                            <td className="py-3 px-3 min-w-[140px]">
                              <div className="w-full bg-[#0E1520] h-2.5 rounded-full overflow-hidden border border-[var(--line-2)]">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isLatest ? "bg-gradient-to-r from-[#2ED8B6] to-[#E5484D]" : "bg-[#2ED8B6]"
                                  }`}
                                  style={{ width: `${pctWidth}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  row.checkoutFailures > 50
                                    ? "bg-[#E5484D]/20 text-[#E5484D] border border-[#E5484D]/40 font-bold"
                                    : "text-[#B4C2D0]"
                                }`}
                              >
                                {row.checkoutFailures}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[#B4C2D0]">{row.ssoAuth}</td>
                            <td className="py-3 px-3 text-[#B4C2D0]">{row.billing}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  row.mfaSms > 50 ? "text-[#F5A623] font-bold" : "text-[#B4C2D0]"
                                }`}
                              >
                                {row.mfaSms}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span
                                className={`font-bold ${
                                  row.csat >= 90 ? "text-[#4CC38A]" : row.csat >= 85 ? "text-[#F5A623]" : "text-[#E5484D]"
                                }`}
                              >
                                {row.csat}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span
                                className={`font-bold ${
                                  row.sentimentNegativePct > 30 ? "text-[#E5484D]" : "text-[#6B7C8D]"
                                }`}
                              >
                                {row.sentimentNegativePct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Anomaly Alerts (EP13 / SV8-120) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#E5484D]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
                      Active Anomalies
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B7C8D]">Auto-flagged against 7-day rolling window</span>
                </div>

                {displayAnomalies.length === 0 ? (
                  <div className="card p-6 text-center border-[var(--line)] bg-[#121A24]">
                    <div className="flex items-center justify-center gap-2 text-xs text-[#2ED8B6]">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-semibold">No Anomalies</span>
                    </div>
                    <p className="text-[11px] text-[#6B7C8D] mt-1">All monitored ticket categories and volume curves are within normal variance thresholds.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayAnomalies.map((anom) => (
                      <div
                        key={anom.id}
                        className={`card p-5 space-y-3 rounded-2xl border transition-all ${
                          anom.severity === "high"
                            ? "border-[#E5484D]/40 bg-gradient-to-b from-[#E5484D]/10 to-[#121A24]"
                            : "border-[var(--line)] bg-[#121A24]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                anom.severity === "high" ? "bg-[#E5484D] animate-ping" : "bg-[#F5A623]"
                              }`}
                            />
                            <span className="font-semibold text-xs text-[#EAF1F8]">{anom.category}</span>
                          </div>
                          <span
                            className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-full ${
                              anom.severity === "high"
                                ? "bg-[#E5484D]/20 text-[#E5484D] border border-[#E5484D]/40"
                                : "bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40"
                            }`}
                          >
                            +{anom.changePct}%
                          </span>
                        </div>
                        <p className="text-xs text-[#B4C2D0] leading-relaxed">{anom.description}</p>
                        <div className="pt-2 border-t border-[var(--line-2)] flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                          <span>Severity: {anom.severity.toUpperCase()}</span>
                          <span>{new Date(anom.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Proactive Action Insights Feed (EP14 / Action Gateway) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
                      Action Insights
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#2ED8B6]">One-Click Action Gateway</span>
                </div>

                {displayInsights.length === 0 ? (
                  <div className="card p-6 text-center border-[var(--line)] bg-[#121A24]">
                    <div className="flex items-center justify-center gap-2 text-xs text-[#6B7C8D]">
                      <Zap className="w-4 h-4 opacity-50" />
                      <span className="font-semibold">No Insights</span>
                    </div>
                    <p className="text-[11px] text-[#6B7C8D] mt-1">No proactive operational interventions recommended at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayInsights.map((ins) => (
                      <div
                        key={ins.id}
                        className="card p-5 space-y-3.5 rounded-2xl border border-[var(--line)] bg-[#121A24] hover:border-[#2ED8B6]/40 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-[#EAF1F8]">{ins.title}</h4>
                          <span className="pill ok text-[10px] font-mono shrink-0 self-start sm:self-auto">
                            <i className="dot" />
                            {typeof ins.confidence === "number" ? `${(ins.confidence * 100).toFixed(0)}% Confidence Match` : "Verified Insight"}
                          </span>
                        </div>
                        <p className="text-xs text-[#B4C2D0] leading-relaxed">{ins.finding}</p>
                        <div className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase text-[#2ED8B6] font-bold">Recommended:</span>
                            <span className="text-[#EAF1F8] font-medium">{ins.recommendation}</span>
                          </div>
                          <button
                            onClick={() => handleExecuteInsight(ins.id)}
                            className="btn btn-primary text-xs whitespace-nowrap cursor-pointer shrink-0"
                          >
                            Execute via Action Gateway
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }
