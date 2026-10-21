import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverAccountAccess } from '../src/lib/account-access-recovery.ts';

const targetId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';

function fixture(kind, overrides = {}) {
  const calls = [];
  const record = { id: targetId, full_name: 'Mitra', owner_name: 'Owner', phone: '6281111111111', owner_phone: '6281111111111', status: kind === 'APPLICATION' ? 'PENDING' : 'ACTIVE', user_id: 'auth-user', username: 'marketing_123', is_active: true, ...overrides.record };
  const admin = {
    from(table) {
      const operation = { table, method: 'select', filters: [], payload: null };
      const resolve = () => {
        calls.push(operation);
        if (overrides.fail?.(operation)) return { data: null, error: { message: 'simulated failure' } };
        if (table === 'warkop_members') return { data: { user_id: 'auth-user', username: 'owner_123' }, error: null };
        return { data: operation.method === 'select' ? record : { id: targetId }, error: null };
      };
      const query = {
        select() { return query; },
        update(payload) { operation.method = 'update'; operation.payload = payload; return query; },
        insert(payload) { operation.method = 'insert'; operation.payload = payload; return query; },
        eq(field, value) { operation.filters.push([field, value]); return query; },
        maybeSingle() { return Promise.resolve(resolve()); },
        then(onResolved, onRejected) { return Promise.resolve(resolve()).then(onResolved, onRejected); },
      };
      return query;
    },
    auth: { admin: {
      async getUserById(id) {
        calls.push({ method: 'getUser', id });
        return { data: { user: { app_metadata: overrides.metadata || (kind === 'MARKETING' ? { role: 'MARKETING', marketing_partner_id: targetId } : { role: 'OWNER', warkop_id: targetId }) } }, error: null };
      },
      async updateUserById(id, payload) {
        calls.push({ method: 'resetPassword', id, payload });
        return { error: overrides.resetError ? { message: 'reset failed' } : null };
      },
    } },
  };
  return { admin, calls };
}

function input(kind, resetPassword = true) { return { kind, id: targetId, phone: '081234567890', resetPassword }; }

for (const kind of ['MARKETING', 'TENANT']) {
  test(`${kind}: correct contact, reset the same auth account, and prepare WhatsApp without logging secrets`, async () => {
    const { admin, calls } = fixture(kind);
    const result = await recoverAccountAccess(admin, actorId, input(kind));
    const resets = calls.filter(call => call.method === 'resetPassword');
    assert.equal(resets.length, 1);
    assert.equal(resets[0].id, 'auth-user');
    assert.ok(resets[0].payload.password.length >= 24);
    assert.equal(new URL(result.whatsappUrl).pathname, '/6281234567890');
    assert.ok(new URL(result.whatsappUrl).searchParams.get('text').includes(resets[0].payload.password));
    assert.equal(result.username, kind === 'MARKETING' ? 'marketing_123' : 'owner_123');
    const audits = calls.filter(call => call.table === 'audit_logs');
    assert.equal(audits.length, 2);
    assert.equal(audits[0].payload.actor_user_id, actorId);
    assert.ok(!JSON.stringify(audits).includes(resets[0].payload.password));
    assert.ok(calls.some(call => call.table === (kind === 'MARKETING' ? 'marketing_agents' : 'tenant_applications') && call.method === 'update'));
    assert.ok(!calls.some(call => call.method === 'insert' && call.table !== 'audit_logs'));
  });
}

test('phone-only correction never touches passwords and pending applications retain status', async () => {
  const { admin, calls } = fixture('APPLICATION');
  const result = await recoverAccountAccess(admin, actorId, input('APPLICATION', false));
  assert.equal(result.whatsappUrl, null);
  assert.ok(!calls.some(call => call.method === 'resetPassword'));
  const update = calls.find(call => call.table === 'tenant_applications' && call.method === 'update');
  assert.deepEqual(update.payload, { owner_phone: '6281234567890' });
  assert.ok(update.filters.some(([field, value]) => field === 'status' && value === 'PENDING'));
});

test('invalid numbers fail before reading or changing any account', async () => {
  const { admin, calls } = fixture('MARKETING');
  await assert.rejects(recoverAccountAccess(admin, actorId, { ...input('MARKETING'), phone: '123' }), /tidak valid/);
  assert.equal(calls.length, 0);
});

test('pending/inactive accounts, processed applications and mismatched auth identity cannot be reset', async () => {
  for (const [kind, options] of [
    ['MARKETING', { record: { status: 'PENDING' } }],
    ['TENANT', { record: { is_active: false } }],
    ['MARKETING', { metadata: { role: 'SUPERADMIN' } }],
    ['TENANT', { metadata: { role: 'OWNER', warkop_id: 'another-tenant' } }],
    ['APPLICATION', { record: { status: 'APPROVED' } }],
  ]) {
    const { admin, calls } = fixture(kind, options);
    await assert.rejects(recoverAccountAccess(admin, actorId, input(kind)));
    assert.ok(!calls.some(call => call.method === 'resetPassword' || call.method === 'update'));
  }
});

test('audit and contact-sync errors prevent password reset', async () => {
  for (const table of ['audit_logs', 'marketing_agents', 'marketing_partners']) {
    const { admin, calls } = fixture('MARKETING', { fail: operation => operation.table === table && operation.method !== 'select' });
    await assert.rejects(recoverAccountAccess(admin, actorId, input('MARKETING')));
    assert.ok(!calls.some(call => call.method === 'resetPassword'));
  }
});

test('reset failure reports that the corrected contact has already been saved', async () => {
  const { admin } = fixture('MARKETING', { resetError: true });
  await assert.rejects(recoverAccountAccess(admin, actorId, input('MARKETING')), /Nomor sudah diperbarui.*reset password gagal/);
});

test('completion-audit failure does not discard the only copy of new access', async () => {
  const { admin } = fixture('MARKETING', { fail: operation => operation.payload?.action === 'ACCOUNT_ACCESS_RESET_COMPLETED' });
  const result = await recoverAccountAccess(admin, actorId, input('MARKETING'));
  assert.ok(result.whatsappUrl);
  assert.ok(result.warning);
});

test('retry creates a fresh password on the same account', async () => {
  const { admin, calls } = fixture('MARKETING');
  await recoverAccountAccess(admin, actorId, input('MARKETING'));
  await recoverAccountAccess(admin, actorId, input('MARKETING'));
  const resets = calls.filter(call => call.method === 'resetPassword');
  assert.equal(resets[0].id, resets[1].id);
  assert.notEqual(resets[0].payload.password, resets[1].payload.password);
});
