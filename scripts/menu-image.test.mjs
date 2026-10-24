import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://menu-test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-with-sufficient-length';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-with-sufficient-length';
const { readMenuRequest, MAX_MENU_IMAGE_BYTES } = await import('../src/lib/menu-image.ts');
const { POST, PATCH, DELETE } = await import('../src/app/api/owner/menus/route.ts');
const photo = await sharp({ create: { width: 1500, height: 800, channels: 3, background: 'orange' } }).png().toBuffer();
function request(menu, image, method = 'POST') {
  const body = new FormData();
  body.set('menu', JSON.stringify(menu));
  if (image) body.set('image', image);
  return new Request('https://okesih.com/api/owner/menus', { method, body, headers: { origin: 'https://okesih.com', authorization: 'Bearer test-token' } });
}
const file = () => new File([photo], 'menu.png', { type: 'image/png' });
test('valid photos are decoded, resized and converted to WebP', async () => {
  const parsed = await readMenuRequest(request({ name: 'Kopi' }, file()));
  assert.equal(parsed.body.name, 'Kopi');
  const metadata = await sharp(parsed.image).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 800);
  assert.ok(parsed.image.length <= MAX_MENU_IMAGE_BYTES);
  assert.equal(metadata.exif, undefined);
});
test('detailed photos stay within the 200 KB storage budget', async () => {
  const detailed = await sharp(randomBytes(1600 * 1200 * 3), { raw: { width: 1600, height: 1200, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
  const { image } = await readMenuRequest(request({}, new File([detailed], 'photo.jpg', { type: 'image/jpeg' })));
  assert.ok(image.length <= MAX_MENU_IMAGE_BYTES);
  const metadata = await sharp(image).metadata();
  assert.ok(metadata.width <= 800 && metadata.height <= 800);
});
test('corrupt, unsupported and oversized photos are rejected', async () => {
  for (const image of [new File(['bad'], 'bad.png', { type: 'image/png' }), new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(2097153)], 'big.png', { type: 'image/png' })]) {
    await assert.rejects(() => readMenuRequest(request({}, image)), { status: 400 });
  }
});
test('menus without photos remain supported', async () => {
  assert.equal((await readMenuRequest(request({ name: 'Kopi' }))).image, null);
  assert.equal((await readMenuRequest(new Request('https://okesih.com', { method: 'PATCH', body: JSON.stringify({ isAvailable: false }), headers: { 'content-type': 'application/json' } }))).body.isAvailable, false);
});
test('create/edit saves tenant photo, preserves existing photo, isolates tenants and cleans up failed uploads', async () => {
  const original = globalThis.fetch;
  let writes = [], uploads = 0, removals = 0, deny = false, failSave = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init?.method || 'GET';
    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: 'owner' });
    if (url.pathname.endsWith('/warkop_members')) return Response.json({ warkop_id: 'tenant', role: 'OWNER', is_active: true });
    if (url.pathname.endsWith('/warkops')) return Response.json({ is_active: true });
    if (url.pathname.endsWith('/owner_onboarding')) return Response.json({ password_changed_at: '2026-01-01' });
    if (url.pathname.endsWith('/menus')) {
      if (method === 'GET') {
        assert.equal(url.searchParams.get('warkop_id'), 'eq.tenant');
        return deny ? Response.json({ message: 'not found' }, { status: 406 }) : Response.json({ image_url: 'https://menu-test.supabase.co/storage/v1/object/public/menu-images/tenant/abc.webp' });
      }
      if (method === 'DELETE') {
        assert.equal(url.searchParams.get('warkop_id'), 'eq.tenant');
        return Response.json([{ image_url: 'https://menu-test.supabase.co/storage/v1/object/public/menu-images/tenant/abc.webp' }]);
      }
      if (method === 'PATCH') assert.equal(url.searchParams.get('warkop_id'), 'eq.tenant');
      writes.push(JSON.parse(init.body));
      return failSave ? Response.json({ message: 'save failed' }, { status: 400 }) : Response.json({ id: 'menu', ...writes.at(-1) });
    }
    if (url.pathname.includes('/storage/v1/object/menu-images')) {
      if (method === 'POST') { uploads++; assert.ok(url.pathname.includes('/tenant/')); }
      if (method === 'DELETE') removals++;
      return Response.json({ Key: 'uploaded' });
    }
    throw new Error('Unexpected test request: ' + url.pathname);
  };
  try {
    const menu = { id: 'menu', name: 'Kopi', price: 12000, category: 'Kopi' };
    assert.equal((await POST(request(menu, file()))).status, 200);
    assert.equal(writes.at(-1).warkop_id, 'tenant');
    assert.match(writes.at(-1).image_url, /menu-images\/tenant\/.+\.webp$/);
    assert.equal((await PATCH(request(menu, file(), 'PATCH'))).status, 200);
    assert.equal(removals, 1);
    assert.equal((await PATCH(request(menu, null, 'PATCH'))).status, 200);
    assert.equal('image_url' in writes.at(-1), false);
    deny = true;
    assert.notEqual((await PATCH(request(menu, file(), 'PATCH'))).status, 200);
    assert.equal(uploads, 2);
    deny = false; failSave = true;
    assert.notEqual((await POST(request(menu, file()))).status, 200);
    assert.equal(removals, 2);
    const deletion = new Request('https://okesih.com/api/owner/menus?id=menu', { method: 'DELETE', headers: { origin: 'https://okesih.com', authorization: 'Bearer test-token' } });
    assert.equal((await DELETE(deletion)).status, 200);
    assert.equal(removals, 3);
  } finally { globalThis.fetch = original; }
});
