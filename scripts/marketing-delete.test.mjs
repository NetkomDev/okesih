process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key-test";
import test from 'node:test';
import { createAccount } from '../src/lib/create-account.ts';
import { randomDigits } from '../src/lib/generated-credentials.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { NextResponse, NextRequest } from 'next/server';

const source = ts.transpileModule(
  fs.readFileSync(new URL('../src/app/api/superadmin/marketing/route.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function createFixture({ userRole = 'SUPERADMIN', partnerExists = true, hasTenants = true } = {}) {
  const calls = [];
  const partner = {
    id: 'partner-uuid-1',
    full_name: 'Mitra Sukses',
    phone: '6281234567890',
    referral_code: 'MKT-SUKSES',
    user_id: 'auth-user-uuid-1',
    username: 'mitrasukses',
  };

  const warkops = hasTenants
    ? [{ id: 'warkop-1', nama: 'Warkop Berkah' }, { id: 'warkop-2', nama: 'Warkop Jaya' }]
    : [];

  const adminClient = {
    from(table) {
      const q = {
        _table: table,
        _op: 'select',
        _filters: {},
        select(cols) {
          calls.push({ table, op: 'select', cols });
          return q;
        },
        eq(col, val) {
          q._filters[col] = val;
          return q;
        },
        update(val) {
          calls.push({ table, op: 'update', values: val, filters: { ...q._filters } });
          return q;
        },
        delete() {
          calls.push({ table, op: 'delete', filters: { ...q._filters } });
          return q;
        },
        insert(val) {
          calls.push({ table, op: 'insert', values: val });
          return q;
        },
        or(str) { calls.push({ table, op: "or", str }); return q; },
        order() {
          return q;
        },
        maybeSingle() {
          if (table === 'marketing_partners') {
            return Promise.resolve({
              data: partnerExists ? { ...partner } : null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve, reject) {
          if (table === 'warkops' && q._op === 'select') {
            return Promise.resolve({ data: warkops, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
    auth: {
      admin: {
        async deleteUser(userId) {
          calls.push({ op: 'deleteUser', userId });
          return { error: null };
        },
      },
    },
  };

  class DeviceApiError extends Error {
    constructor(message, status = 400) {
      super(message);
      this.status = status;
    }
  }

  const modules = {
    'next/server': { NextResponse, NextRequest },
    '@supabase/supabase-js': {
      createClient: () => adminClient,
    },
    '@/lib/supabase/server': {
      createServerSupabaseClient: async () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: userRole
                ? { id: 'admin-user-uuid', app_metadata: { role: userRole } }
                : null,
            },
          }),
        },
      }),
    },
    '@/lib/device-auth': {
      DeviceApiError,
      assertSameOrigin(req) {
        const origin = req.headers.get('origin');
        if (origin && origin !== new URL(req.url).origin) {
          throw new DeviceApiError('Permintaan lintas situs ditolak.', 403);
        }
      },
    },
    '@/lib/create-account': { createAccount },
    '@/lib/generated-credentials': { randomDigits },
    '@/lib/app-origins': {
      APP_ORIGINS: { PUBLIC: 'https://www.okesih.com' },
    },
    '@/lib/whatsapp': {
      cleanWhatsAppMessageField: (s) => s,
      createWhatsAppUrl: () => '',
      isValidIndonesianWhatsAppNumber: () => true,
      normalizeIndonesianWhatsAppNumber: (s) => s,
    },
  };

  const exports = {};
  new Function('require', 'exports', source)(name => {
    if (modules[name]) return modules[name];
    throw new Error(`Module ${name} not found in test fixture`);
  }, exports);

  return { calls, route: exports, partner, warkops };
}

test('DELETE marketing rejects cross-origin request', async () => {
  const { route } = createFixture();
  const req = new NextRequest('https://www.okesih.com/api/superadmin/marketing?id=partner-1', {
    method: 'DELETE',
    headers: { origin: 'https://malicious-site.com' },
  });
  const res = await route.DELETE(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /lintas situs/);
});

test('DELETE marketing requires superadmin session', async () => {
  const { route } = createFixture({ userRole: 'OWNER' });
  const req = new NextRequest('https://www.okesih.com/api/superadmin/marketing?id=partner-1', {
    method: 'DELETE',
    headers: { origin: 'https://www.okesih.com' },
  });
  const res = await route.DELETE(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Akses Super Admin diperlukan/);
});

test('DELETE marketing requires id query parameter', async () => {
  const { route } = createFixture();
  const req = new NextRequest('https://www.okesih.com/api/superadmin/marketing', {
    method: 'DELETE',
    headers: { origin: 'https://www.okesih.com' },
  });
  const res = await route.DELETE(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /ID mitra marketing diperlukan/);
});

test('DELETE marketing returns 404 when partner not found', async () => {
  const { route } = createFixture({ partnerExists: false });
  const req = new NextRequest('https://www.okesih.com/api/superadmin/marketing?id=non-existent', {
    method: 'DELETE',
    headers: { origin: 'https://www.okesih.com' },
  });
  const res = await route.DELETE(req);
  assert.equal(res.status, 404);
});

test('DELETE marketing successfully cleans up downlines, tenants, applications, withdrawals, mutations, partner, and auth user', async () => {
  const { route, calls } = createFixture({ partnerExists: true, hasTenants: true });
  const req = new NextRequest('https://www.okesih.com/api/superadmin/marketing?id=partner-uuid-1', {
    method: 'DELETE',
    headers: { origin: 'https://www.okesih.com' },
  });
  const res = await route.DELETE(req);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.match(data.message, /Mitra Sukses/);

  // Verify upline disconnect for downlines
  const downlineUpdate = calls.find(c => c.table === 'marketing_partners' && c.op === 'update' && c.values?.upline_id === null);
  assert.ok(downlineUpdate, 'Harus memutuskan upline_id bagi mitra binaan');

  // Verify warkop detachment and commission reset
  const warkopUpdate = calls.find(c => c.table === 'warkops' && c.op === 'update' && c.values?.marketing_agent_id === null && c.values?.marketing_commission_per_receipt === 0);
  assert.ok(warkopUpdate, 'Harus mendetach tenant warkop dan mereset komisi');

  // Verify cleanup of applications, withdrawals, commissions
  assert.ok(calls.find(c => c.table === 'tenant_applications' && c.op === 'delete'), 'Harus menghapus permohonan tenant');
  assert.ok(calls.find(c => c.table === 'marketing_commission_withdrawals' && c.op === 'delete'), 'Harus menghapus data withdrawal');
  assert.ok(calls.find(c => c.table === 'marketing_commission_mutations' && c.op === 'delete'), 'Harus menghapus riwayat mutasi komisi');

  // Verify deletion of marketing_partners record
  assert.ok(calls.find(c => c.table === 'marketing_partners' && c.op === 'delete'), 'Harus menghapus data marketing partner');

  // Verify deletion of Supabase auth user
  assert.ok(calls.find(c => c.op === 'deleteUser' && c.userId === 'auth-user-uuid-1'), 'Harus menghapus user auth supabase');
});
