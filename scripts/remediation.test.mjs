import test from 'node:test';
import assert from 'node:assert/strict';
import { containsSecret, scanDirectory } from './check-secrets.mjs';
import { canOperateOffline, syncFailureKind } from '../src/lib/offline-policy.ts';
import { orderIntentKey, completeOrderIntent } from '../src/lib/order-intent.ts';
const jwt = role => `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ref: 'test', role })).toString('base64url')}.signature`;
test('scanner decodes server JWTs with variable payload offsets, permits anon', () => {
  assert.equal(containsSecret(jwt('service_role')), true);
  assert.equal(containsSecret(jwt('anon')), false);
  assert.equal(containsSecret('sb_secret_0123456789012345'), true);
  assert.equal(containsSecret('prefix private-value suffix', { CRON_SECRET: 'private-value' }), true);
  assert.throws(() => scanDirectory('/tmp/okesih-missing-build-directory'));
});
test('offline lease expires by server time and device expiry, never by last local action', () => {
  const now = Date.now();
  const snapshot = { serverTime: new Date(now).toISOString(), device: { id: 'one', expiresAt: new Date(now + 8 * 3600000).toISOString() }, profile: { is_active: true, offline_limit_hours: 4 } };
  assert.equal(canOperateOffline(snapshot, now + 3600000), true);
  assert.equal(canOperateOffline(snapshot, now + 5 * 3600000), false);
  assert.equal(canOperateOffline(snapshot, now - 120000), false);
  assert.equal(canOperateOffline({ ...snapshot, profile: { ...snapshot.profile, is_active: false } }, now), false);
  assert.equal(canOperateOffline({ ...snapshot, device: { ...snapshot.device, expiresAt: new Date(now).toISOString() } }, now), false);
});
test('sync failures retain operations for retry or explicit resolution', () => {
  for (const status of [408, 429, 500, 503]) assert.equal(syncFailureKind(status), 'retry');
  for (const status of [400, 401, 403, 409, 422]) assert.equal(syncFailureKind(status), 'blocked');
});
test('same order intent survives response loss; edited payload and successful completion get new keys', async () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const first = await orderIntentKey(storage, 'device-1', { qty: 2 });
  assert.equal(await orderIntentKey(storage, 'device-1', { qty: 2 }), first);
  assert.notEqual(await orderIntentKey(storage, 'device-2', { qty: 2 }), first);
  assert.notEqual(await orderIntentKey(storage, 'device-1', { qty: 3 }), first);
  completeOrderIntent(storage, 'device-1');
  assert.notEqual(await orderIntentKey(storage, 'device-1', { qty: 2 }), first);
});
test('pagination reads beyond 1000 rows even when database caps requested pages', async () => {
  const { readAllRows } = await import('../src/lib/database-pages.ts');
  const records = Array.from({length:1207}, (_,id) => ({id}));
  const result = await readAllRows(() => ({range: async (from,to) => ({ data: records.slice(from,Math.min(to+1,from+137)), error:null })}));
  assert.deepEqual(result.data,records);
  const failed = await readAllRows(() => ({range: async () => ({data:null,error:{code:'XX',message:'test'}})}));
  assert.equal(failed.error.code,'XX');
});
