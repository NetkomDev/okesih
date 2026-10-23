import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createRegistrationToken, readRegistrationToken, MARKETING_REGISTRATION_COOKIE, MARKETING_REGISTRATION_TTL } from '../src/lib/marketing-registration.ts';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://registration-test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-with-sufficient-length';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-with-sufficient-length';
const { GET, POST } = await import('../src/app/api/marketing/register/route.ts');
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registrationId = 'bc83b590-b9c3-4acd-919b-5bd3e9c93e64';
const row = {
  id: registrationId, full_name: 'Calon Marketing', phone: '6281234567890',
  email: 'calon@example.com', city_area: 'Makassar', bank_name: 'BCA',
  bank_account_number: '1234567890', bank_account_name: 'Calon Marketing',
  experience_notes: 'Relasi 5 warkop', referral_code: 'MKT-MAK-123',
  status: 'PENDING', created_at: '2026-10-19T08:00:00Z', user_id: null,
  notes_admin: 'Internal only',
};

function request(cookie, method = 'GET', body) {
  return new NextRequest('https://www.okesih.com/api/marketing/register', {
    method,
    headers: { ...(cookie ? { cookie: `${MARKETING_REGISTRATION_COOKIE}=${cookie}` } : {}), origin: 'https://www.okesih.com', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('registration tokens reject tampering, wrong keys, expiry and malformed inputs', () => {
  const now = Date.now();
  const token = createRegistrationToken(registrationId, secret, now);
  assert.equal(readRegistrationToken(token, secret, now), registrationId);
  for (const candidate of [undefined, '', 'invalid', `${token}.extra`, token.replace(registrationId, 'ac83b590-b9c3-4acd-919b-5bd3e9c93e64')]) {
    assert.equal(readRegistrationToken(candidate, secret, now), null);
  }
  assert.equal(readRegistrationToken(token, 'another-key', now), null);
  assert.equal(readRegistrationToken(token, secret, now + MARKETING_REGISTRATION_TTL * 1000), null);
});

test('status cannot be read without a valid registration cookie', async () => {
  assert.deepEqual(await (await GET(request())).json(), { data: null });
  assert.equal((await GET(request('invalid'))).status, 401);
});

test('status reload uses the signed identity and exposes only applicant fields', async context => {
  const token = createRegistrationToken(registrationId, secret);
  for (const [status, userId, ready] of [['PENDING', null, false], ['ACTIVE', null, false], ['ACTIVE', 'auth-user', true], ['INACTIVE', 'auth-user', false]]) {
    context.mock.method(globalThis, 'fetch', async input => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('id'), `eq.${registrationId}`);
      return Response.json({ ...row, status, user_id: userId });
    });
    const response = await GET(request(token));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const { data } = await response.json();
    assert.equal(data.status, status);
    assert.equal(data.applicationReady, ready);
    assert.equal(data.bankAccountNumber, row.bank_account_number);
    assert.equal(data.notes_admin, undefined);
    assert.equal(data.user_id, undefined);
    context.mock.restoreAll();
  }
});

test('successful submission sets a persistent HttpOnly cookie before WhatsApp redirect', async context => {
  let inserts = 0;
  context.mock.method(globalThis, 'fetch', async (input, options) => {
    if (String(input).includes('platform_settings')) return Response.json({ default_marketing_commission: 15 });
    assert.equal(options.method, 'POST');
    inserts += 1;
    return Response.json(row);
  });
  const response = await POST(request(undefined, 'POST', {
    fullName: row.full_name, phone: '081234567890', email: row.email,
    cityArea: row.city_area, bankName: row.bank_name,
    bankAccountNumber: row.bank_account_number, bankAccountName: row.bank_account_name,
    experienceNotes: row.experience_notes,
  }));
  assert.equal(response.status, 200);
  assert.equal(inserts, 1);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Path=\/api\/marketing\/register/);
  assert.match(cookie, /Max-Age=31536000/);
  const { data } = await response.json();
  assert.equal(data.status, 'PENDING');
  assert.match(data.whatsappUrl, /^https:\/\/wa.me\//);
});

test('repeat submission with a cookie returns the existing record without inserting again', async context => {
  context.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.equal(options.method, 'GET');
    return Response.json(row);
  });
  const response = await POST(request(createRegistrationToken(registrationId, secret), 'POST', {}));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.id, registrationId);
});

test('missing records and database failures do not masquerade as a fresh registration', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json(null));
  assert.equal((await GET(request(createRegistrationToken(registrationId, secret)))).status, 404);
  context.mock.restoreAll();
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Unavailable' }, { status: 503 }));
  assert.equal((await GET(request(createRegistrationToken(registrationId, secret)))).status, 503);
});

test('referral registration under a coordinator with an upline stays pending under that coordinator only', async context => {
  let inserted;
  context.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/platform_settings')) return Response.json({ default_marketing_commission: 20 });
    if (options.method === 'GET') return Response.json({ id: 'coordinator-b', status: 'ACTIVE', user_id: 'auth-b', membership_level: 'COORDINATOR', upline_id: 'coordinator-a' });
    inserted = JSON.parse(options.body)[0];
    return Response.json({ ...row, ...inserted });
  });
  const response = await POST(request(undefined, 'POST', {
    fullName: row.full_name, phone: '081234567890', cityArea: row.city_area,
    bankName: row.bank_name, bankAccountNumber: row.bank_account_number, bankAccountName: row.bank_account_name,
    coordinatorReferralCode: 'MKT-B', uplineId: 'coordinator-a', status: 'ACTIVE',
  }));
  assert.equal(response.status, 200);
  assert.equal(inserted.upline_id, 'coordinator-b');
  assert.equal(inserted.status, 'PENDING');
  assert.equal(inserted.membership_level, 'MITRA');
});
