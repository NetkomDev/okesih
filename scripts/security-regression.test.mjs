import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://security-test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-with-sufficient-length';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-with-sufficient-length';
const { createAuditAccess, validAuditAccess, AUDIT_TTL } = await import('../src/lib/audit-access.ts');
const { GET: cleanup } = await import('../src/app/api/cron/cleanup-billing-proofs/route.ts');
const { requireDevice, DEVICE_COOKIE } = await import('../src/lib/device-auth.ts');
test('audit authorization is bound to device, PIN revision, expiry and signature', () => {
  const now = Date.now();
  const token = createAuditAccess('device', 'revision', now);
  assert.equal(validAuditAccess(token, 'device', 'revision', now), true);
  assert.equal(validAuditAccess(token, 'other', 'revision', now), false);
  assert.equal(validAuditAccess(token, 'device', 'rotated', now), false);
  assert.equal(validAuditAccess(token, 'device', 'revision', now + AUDIT_TTL * 1000), false);
  assert.equal(validAuditAccess(token + '0', 'device', 'revision', now), false);
});
test('cron rejects missing secret, wrong secret, and spoofed Vercel User-Agent', async () => {
  process.env.CRON_SECRET = 'test-secret';
  for (const headers of [{}, {authorization:'Bearer wrong'}, {'user-agent':'vercel-cron/1.0'}]) {
    assert.equal((await cleanup(new Request('https://example.com/api/cron/cleanup-billing-proofs', {headers}))).status,401);
  }
  delete process.env.CRON_SECRET;
  assert.equal((await cleanup(new Request('https://example.com/api/cron/cleanup-billing-proofs', {headers:{authorization:'Bearer undefined'}}))).status,401);
});
test('device heartbeat executes network request and inactive tenant is denied', async () => {
  const original = globalThis.fetch;
  let active = true, updates = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    if (url.includes('/device_installations') && method === 'PATCH') { updates++; return new Response(null,{status:204}); }
    if (url.includes('/device_installations')) return Response.json({id:'device',warkop_id:'tenant',device_type:'POS',device_name:'Test',status:'ACTIVE',expires_at:new Date(Date.now()+3600000).toISOString(),last_seen_at:'2020-01-01T00:00:00Z'});
    if (url.includes('/warkops')) return Response.json({is_active:active});
    throw new Error('Unexpected request');
  };
  try {
    const req = new NextRequest('https://example.com/api/device/bootstrap',{headers:{cookie:`${DEVICE_COOKIE.POS}=test-token`}});
    await requireDevice(req,['POS']); assert.equal(updates,1);
    active=false; await assert.rejects(()=>requireDevice(req,['POS']), /nonaktif/); assert.equal(updates,1);
  } finally { globalThis.fetch=original; }
});
test('OCR validates decoded dimensions, terminates timeout and releases capacity', async () => {
  const { default: sharp } = await import('sharp');
  const { verifyBillingProof } = await import('../src/lib/billing-proof-ocr.ts');
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'white' } }).png().toBuffer();
  await assert.rejects(() => verifyBillingProof(Buffer.from('invalid'), 100));
  const first = await verifyBillingProof(image, 100, 1);
  assert.equal(first.verified, false);
  assert.match(first.reason, /Batas waktu/);
  const second = await verifyBillingProof(image, 100, 1);
  assert.match(second.reason, /Batas waktu/);
  assert.ok(second.durationMs < 5000);
});
