import { NextResponse } from 'next/server';
import { authorizeRuntimeSupportRequest } from '@/lib/service-app/runtime-session';
import { marketplaceService } from '@/lib/services/marketplace-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const present = (request.headers.get('cookie') ?? '')
    .split(';')
    .some((p) => p.trim().startsWith('__Host-sv8_runtime_support='));
  if (!present) return NextResponse.json({ success: true, session: null }, { headers });

  try {
    const auth = await authorizeRuntimeSupportRequest(request);
    if (!auth) return NextResponse.json({ success: false }, { status: 401, headers });
    const { session, role, access } = auth;
    const poolAccountId = access.poolAccountId || session.accountId;
    const effectivePlanId = access.planId || marketplaceService.getAccountPlan(poolAccountId);

    if (effectivePlanId) {
      marketplaceService.setAccountPlan(poolAccountId, effectivePlanId);
    }
    if (access.credits !== undefined) {
      marketplaceService.setCredits(access.credits, session.tenantDomain, { accountId: poolAccountId });
    } else if (effectivePlanId && !marketplaceService.hasAccountPool(poolAccountId)) {
      marketplaceService.enablePlanForAccount(poolAccountId, effectivePlanId);
    }

    const credits = marketplaceService.getCredits(session.tenantDomain, {
      accountId: poolAccountId,
      runtimeLinked: true,
    });

    return NextResponse.json(
      {
        success: true,
        session: {
          // A UI correlation marker, never an access token. Authority stays HttpOnly.
          token: `workspace:${session.iat}`,
          tenantSlug: session.tenantDomain,
          email: access.email,
          name: role === 'support:manage' ? 'Workspace administrator' : 'Workspace member',
          role: role === 'support:manage' ? 'cx_lead' : 'observer',
          issuedAt: session.iat * 1000,
          expiresAt: session.exp * 1000,
          accountId: poolAccountId,
          credits,
          plan: effectivePlanId,
        },
      },
      { headers }
    );
  } catch {
    return NextResponse.json({ success: false }, { status: 503, headers });
  }
}
