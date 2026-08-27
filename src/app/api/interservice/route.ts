import { NextResponse } from "next/server";
import {
  KnowledgeV8Client,
  GrowthV8Client,
  DominionClient,
  ForgeSymphonyClient,
} from "@/lib/services/interservice-client";
import { enqueueInterServiceDispatch } from "@/lib/temporal/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service") || "all";

  return NextResponse.json({
    status: "mesh_online",
    services: {
      knowledgev8: { endpoint: process.env.KNOWLEDGEV8_URL || "http://knowledgev8.default.svc.cluster.local:3000", health: "connected" },
      growthv8: { endpoint: process.env.GROWTHV8_URL || "http://growthv8.default.svc.cluster.local:3000", health: "connected" },
      dominion: { endpoint: process.env.DOMINION_URL || "http://dominion.default.svc.cluster.local:3000", health: "connected" },
      forge_symphony: { endpoint: process.env.FORGE_URL || "http://forgev8.default.svc.cluster.local:8080", health: "connected" },
    },
    temporal: {
      enabled: Boolean(process.env.TEMPORAL_ADDRESS),
      address: process.env.TEMPORAL_ADDRESS || "inline-fallback",
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || "supportv8-spine",
    },
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetService, operation, payload, tenantId = "tenant_default" } = body;

    if (!targetService) {
      return NextResponse.json({ error: "targetService is required" }, { status: 400 });
    }

    let result;
    if (targetService === "knowledgev8") {
      result = await KnowledgeV8Client.searchEmbeddings({
        tenantId,
        query: payload?.query || "Support policy and guidelines",
        stream: payload?.stream,
      });
    } else if (targetService === "growthv8") {
      result = await GrowthV8Client.attributeSupportInteraction({
        tenantId,
        customerEmail: payload?.email || "customer@example.com",
        sentimentScore: payload?.sentimentScore || 0.8,
        issueUrgency: payload?.urgency || "normal",
      });
    } else if (targetService === "dominion") {
      result = await DominionClient.emitAlert({
        tenantId,
        severity: payload?.severity || "medium",
        title: payload?.title || "Support Ticket Incident Event",
        description: payload?.description || "Automated telemetry signal",
      });
    } else if (targetService === "forge_symphony") {
      result = await ForgeSymphonyClient.dispatchAction({
        tenantId,
        operation: operation || "orderv8.refund",
        payload: payload || {},
      });
    } else if (targetService === "temporal_orchestrate") {
      result = await enqueueInterServiceDispatch({
        tenantId,
        triggerApp: "supportv8",
        operation: operation || "forge.refund",
        payload: payload || {},
      });
    } else {
      return NextResponse.json({ error: `Unknown target service: ${targetService}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Inter-service dispatch failed" }, { status: 500 });
  }
}
