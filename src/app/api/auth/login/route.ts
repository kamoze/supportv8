import { NextRequest, NextResponse } from "next/server";
import { credentialStore } from "@/lib/auth/credential-store";
import { AuthService } from "@/lib/auth-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, tenantSlug } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const authResult = await credentialStore.authenticate(email, password, tenantSlug);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Invalid credentials." },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const session = AuthService.createSession(
      tenantSlug || user.tenantSlug,
      user.email,
      user.role
    );

    return NextResponse.json({
      success: true,
      message: `Successfully authenticated as ${user.name}`,
      session,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantSlug: user.tenantSlug,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Authentication error" },
      { status: 500 }
    );
  }
}
