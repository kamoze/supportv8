import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: "ready",
      tasksv8: {
        enabled: true,
        migration: "011_tasksv8_links",
        database: "ready",
      },
    },
    { status: 200 }
  );
}
