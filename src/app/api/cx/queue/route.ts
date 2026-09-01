import { NextRequest, NextResponse } from "next/server";
import { queueLoadBalancer } from "@/lib/services/queue-load-balancer-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const metrics = queueLoadBalancer.getQueueMetrics(tenant);
  return NextResponse.json({
    success: true,
    data: metrics,
  });
}

export async function POST(req: NextRequest) {
  try {
    const result = queueLoadBalancer.rebalanceQueues();
    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.metrics,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Queue rebalance failed" },
      { status: 500 }
    );
  }
}
