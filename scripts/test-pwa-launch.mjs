// Run: node --experimental-strip-types --test scripts/test-pwa-launch.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { installationKind, isDashboardLaunch } from "../src/lib/pwa-routing.ts";
import { createDevicePin, hashDevicePin, readDevicePin, devicePinKey } from "../src/lib/device-pin.ts";
import dashboardManifest from "../src/lib/pwa-manifest.ts";

test("shared dashboard manifest preserves identity and opens login", () => {
  const manifest = dashboardManifest();
  assert.equal(manifest.id, "/");
  assert.equal(manifest.name, "OKESIH POS");
  assert.equal(manifest.start_url, "/login");
  assert.equal(manifest.scope, "/");
});

test("dashboard launches require login; operational and customer screens stay independent", () => {
  for (const path of ["/", "/owner", "/owner/menu", "/superadmin", "/marketing", "/admin"]) {
    assert.equal(isDashboardLaunch(path), true, path);
    assert.equal(installationKind(path), "DASHBOARD", path);
  }
  for (const path of ["/login", "/pos", "/kds", "/menu/risolinan", "/tv", "/ownership"]) {
    assert.equal(isDashboardLaunch(path), false, path);
  }
  assert.equal(installationKind("/pos"), "POS");
  assert.equal(installationKind("/kds"), "KDS");
});

test("operational manifests keep separate identities and launch targets", async () => {
  for (const [kind, name, path] of [["pos", "OKESIH KASIR", "/pos"], ["kds", "OKESIH KDS", "/kds"], ["owner", "OKESIH POS", "/login"]]) {
    const manifest = JSON.parse(await readFile(new URL(`../public/manifest-${kind}.webmanifest`, import.meta.url), "utf8"));
    assert.equal(manifest.name, name);
    assert.equal(manifest.short_name, name);
    assert.equal(manifest.start_url, path);
    assert.ok(path.startsWith(manifest.scope));
    assert.equal(manifest.id, `/pwa/${kind}`);
  }
});

test("PIN uses unique salts, verifies correct input, and rejects wrong input", async () => {
  const first = await createDevicePin("123456");
  const second = await createDevicePin("123456");
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await hashDevicePin("123456", first.salt), first.hash);
  assert.notEqual(await hashDevicePin("654321", first.salt), first.hash);
  await assert.rejects(createDevicePin("1234"));
  await assert.rejects(createDevicePin("abcdef"));
});

test("PIN storage is isolated by paired device and fails closed on corruption", async () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null };
  assert.equal(readDevicePin("one"), null);
  const record = await createDevicePin("246810");
  values.set(devicePinKey("one"), JSON.stringify(record));
  assert.deepEqual(readDevicePin("one"), record);
  assert.equal(readDevicePin("two"), null);
  values.set(devicePinKey("one"), "{}");
  assert.throws(() => readDevicePin("one"));
  delete globalThis.localStorage;
});
