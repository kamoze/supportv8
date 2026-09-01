import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  for (const [name, path] of [
    ["sv8_access_token", "/"],
    ["sv8_refresh_token", "/api/auth"],
  ] as const) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path,
      maxAge: 0,
    });
  }
  return response;
}
