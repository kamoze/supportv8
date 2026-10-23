/**
 * @deprecated Deprecated for UAT. Use real service persistence and UAT CLI scripts
 * (scripts/uat/seed-tasksv8-link.ts and scripts/uat/query-tasksv8-receipt.ts)
 * instead of mock sink processes.
 */
import http from 'node:http';
import { POST } from '../src/app/api/internal/tasksv8/outcomes/route.js';
import { getTasksv8Store } from '../src/lib/tasksv8/store.js';

process.env.SUPPORTV8_TASKSV8_ENABLED = 'true';
process.env.TASKSV8_JWT_SECRET = process.env.TASKSV8_JWT_SECRET || 'test-workload-secret';

const store = getTasksv8Store();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (url.pathname === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'supportv8-outcome-sink' }));
    return;
  }

  if (url.pathname === '/internal/test/setup' && req.method === 'POST') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw);
        const { tenantId, ticketId, summary } = body;
        await store.recordEscalation(
          { tenantId: tenantId || 'tenant_support_1', accountId: `${tenantId}-account` },
          { id: ticketId || 'ticket_1', summary: summary || 'Test escalation' }
        );
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/internal/test/receipts') {
    const memoryStore = store as any;
    const receipts = memoryStore.receipts ? Array.from(memoryStore.receipts.values()) : [];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ receipts }));
    return;
  }

  if (url.pathname === '/api/internal/tasksv8/outcomes' && req.method === 'POST') {
    let chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', async () => {
      try {
        const bodyBuf = Buffer.concat(chunks);
        const headers = new Headers();
        for (const [key, val] of Object.entries(req.headers)) {
          if (Array.isArray(val)) {
            for (const v of val) headers.append(key, v);
          } else if (val !== undefined) {
            headers.set(key, val);
          }
        }

        const webReq = new Request(url.toString(), {
          method: 'POST',
          headers,
          body: bodyBuf,
          // @ts-ignore
          duplex: 'half',
        });

        const webRes = await POST(webReq);
        res.statusCode = webRes.status;
        webRes.headers.forEach((v, k) => res.setHeader(k, v));
        const resBuf = Buffer.from(await webRes.arrayBuffer());
        res.end(resBuf);
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

const port = Number(process.env.PORT) || 0;
server.listen(port, '127.0.0.1', () => {
  const addr = server.address() as { port: number };
  console.log(`SUPPORTV8_SINK_READY:port=${addr.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
