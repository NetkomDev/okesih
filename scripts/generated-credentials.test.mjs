import test from 'node:test';
import assert from 'node:assert/strict';
import { randomDigits } from '../src/lib/generated-credentials.ts';
import { createAccount } from '../src/lib/create-account.ts';

test('generated credentials have exactly three / six digits', () => {
  for (let i = 0; i < 1000; i++) {
    assert.match(randomDigits(3), /^[1-9][0-9]{2}$/);
    assert.match(randomDigits(6), /^[1-9][0-9]{5}$/);
  }
});

test('occupied username retries, wraps, and returns the actual login with metadata intact', async () => {
  const calls = [];
  const attributes = { password: '483921', app_metadata: { role: 'OWNER', warkop_id: 'tenant' } };
  const admin = { auth: { admin: { createUser: async input => {
    calls.push(input);
    return calls.length === 1 ? { data: { user: null }, error: { code: 'email_exists' } } : { data: { user: { id: 'new' } }, error: null };
  } } } };
  const result = await createAccount(admin, 'owner_999', attributes);
  assert.equal(result.username, 'owner_100');
  assert.deepEqual(calls.map(c => c.email), ['owner_999@okesih.local', 'owner_100@okesih.local']);
  assert.deepEqual(calls[1], { ...attributes, email: 'owner_100@okesih.local' });
});

test('authentication errors and custom usernames are not retried', async () => {
  for (const [username, code] of [['marketing_123', 'weak_password'], ['custom_name', 'email_exists']]) {
    let count = 0;
    const admin = { auth: { admin: { createUser: async () => { count++; return { data: { user: null }, error: { code } }; } } } };
    const result = await createAccount(admin, username, { password: '483921' });
    assert.equal(count, 1);
    assert.equal(result.error.code, code);
    assert.equal(result.username, username);
  }
});

test('exhausted three-digit namespace stops without overwriting an account', async () => {
  const emails = new Set();
  const admin = { auth: { admin: { createUser: async ({ email }) => { emails.add(email); return { data: { user: null }, error: { code: 'email_exists' } }; } } } };
  const result = await createAccount(admin, 'marketing_123', { password: '483921' });
  assert.equal(emails.size, 900);
  assert.equal(result.data.user, null);
  assert.equal(result.error.code, 'email_exists');
});

test('WhatsApp credentials preserve exact characters without code formatting or added spaces', async () => {
  const { formatWhatsAppCredentials, createWhatsAppUrl } = await import('../src/lib/whatsapp.ts');
  for (const label of ['Password', 'Password sementara', 'Password baru']) {
    const message = formatWhatsAppCredentials('owner_785', '510119', label);
    const decoded = new URL(createWhatsAppUrl('081234567890', message)).searchParams.get('text');
    assert.equal(decoded.split('\n')[0], 'Username: owner_785');
    assert.equal(decoded.split('\n')[1], `${label}: 510119`);
    assert.ok(!decoded.includes('`'));
    assert.equal(decoded.match(/Username:\s*[*`]*([^\s*`]+)/)[1], 'owner_785');
    assert.equal(decoded.match(/Password(?: sementara| baru)?:\s*[*`]*([^\s*`]+)/)[1], '510119');
  }
});
