// Explicit local browser-test preload. Never imported by application source.
// Start the local Next process with NODE_OPTIONS="--require=<absolute path to this file>".
if (process.env.SUPPORT_AUTH_QA_FIXTURE !== 'local-only') throw Error('Explicit local fixture opt-in required');
Object.assign(process.env, {
 REGISTRY_URL:'https://registry.example.test', SERVICEV8_OIDC_ISSUER:'https://identity.example.test/realms/servicev8',
 SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID:'fixture-registered-reader', SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET:'synthetic-not-a-credential'
});
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
 const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
 if(url.hostname === 'identity.example.test') return Response.json({access_token:'synthetic-token',token_type:'Bearer',expires_in:120});
 if(url.hostname === 'registry.example.test') return url.pathname === '/v1/workspace-hosts/resolve' && url.searchParams.get('slug') === 'acme'
  ? Response.json({schemaVersion:1,productAppKey:'support',tenantId:'canonical-acme',accountId:'canonical-account',slug:'acme',companyName:'Acme Research Group',origin:'https://acme.support.servicev8.com'})
  : new Response(null,{status:404});
 return original(input,init);
};
