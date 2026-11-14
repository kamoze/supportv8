// Test-process transport only: retain HTTPS application configuration while
// routing the two synthetic owners to the disposable loopback HTTP fixture.
const target = new URL(process.env.SUPPORT_STANDALONE_REGISTRY_FIXTURE ?? '');
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port || target.pathname !== '/' || target.username || target.password || target.search || target.hash) throw Error('Expected explicit loopback Registry fixture');
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  if (url.protocol === 'https:' && ['registry.example.test', 'identity.example.test'].includes(url.hostname)) {
    return original(new URL(url.pathname + url.search, target), init);
  }
  return original(input, init);
};
