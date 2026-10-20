// Run from the repository root. All network and cleanup dependencies are mocked.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const root = process.cwd();
const nativeRequire = createRequire(path.join(root, 'package.json'));
const ts = nativeRequire('typescript');

function load(file, mocks) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const requireMock = (id) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id);
  new Function('require', 'module', 'exports', js)(requireMock, module, module.exports);
  return module.exports;
}

let cleanupCalls = 0;
const cron = load('src/app/api/cron/cleanup-billing-proofs/route.ts', {
  '@/lib/supabase/admin': { createAdminClient: () => ({}) },
  '@/lib/billing-proof-retention': {
    deleteExpiredBillingProofs: async () => {
      cleanupCalls++;
      return { deleted: 0 };
    },
  },
});
const previousSecret = process.env.CRON_SECRET;
try {
  process.env.CRON_SECRET = 'audit-fixture-secret';
  const endpoint = 'https://example.test/api/cron/cleanup-billing-proofs';
  assert.equal((await cron.GET(new Request(endpoint))).status, 401);
  const forgedRequest = new Request(endpoint, { headers: { 'user-agent': 'vercel-cron/1.0' } });
  assert.equal((await cron.GET(forgedRequest)).status, 200);
  assert.equal(cleanupCalls, 1);
  console.log('CONFIRMED: forged cron User-Agent passes authorization with CRON_SECRET set (mock cleanup).');
} finally {
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
}

const { createClient } = nativeRequire('@supabase/supabase-js');
let fetches = 0;
const client = createClient('https://audit.invalid', 'fixture-key', {
  global: { fetch: async () => { fetches++; return Response.json([]); } },
  auth: { persistSession: false, autoRefreshToken: false },
});
void client.from('device_installations').update({ last_seen_at: '2026-10-20T00:00:00Z' }).eq('id', 'fixture');
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(fetches, 0);
await client.from('device_installations').update({ last_seen_at: '2026-10-20T00:00:00Z' }).eq('id', 'fixture');
assert.equal(fetches, 1);
console.log('CONFIRMED: void PostgREST update sends no request; awaiting it does (mock fetch).');
console.log('Two behavioral probes passed. No production writes or account data used.');
