import { NextRequest, NextResponse } from "next/server";
import { verticalClients, type VerticalTarget } from "@/lib/verticals/vertical-clients";

export async function GET() {
  const verticals = await verticalClients.getVerticalsStatus();
  return NextResponse.json({
    success: true,
    count: verticals.length,
    data: verticals,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vertical, operation, payload } = body;

    if (!vertical || !operation) {
      return NextResponse.json(
        { success: false, error: "'vertical' and 'operation' are required" },
        { status: 400 }
      );
    }

    const result = await verticalClients.dispatch({
      vertical: vertical as VerticalTarget,
      operation,
      payload: payload || {},
    });

    return NextResponse.json({
      success: true,
      message: `Operation '${operation}' successfully dispatched to ${vertical.toUpperCase()} (${result.latencyMs}ms)`,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Vertical dispatch failed" },
      { status: 500 }
    );
  }
}
