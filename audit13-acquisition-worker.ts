import { handleAppLaunch } from './src/lib/platform/acquisition';

console.log(
  JSON.stringify(
    handleAppLaunch(
      {
        tenantSlug: 'tenant-a',
        tenantId: 'tenant_rt_' + 'a'.repeat(48),
        accountId: 'acct-a',
        roleCap: 'support:manage',
      } as any,
      { installationId: process.env.REVIEW_INSTALLATION_ID }
    )
  )
);
