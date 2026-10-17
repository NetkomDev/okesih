import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { installationKind, isDashboardLaunch, isRoleAllowedForPwa, PWA_ROLE_CONFIGS } from "../src/lib/pwa-routing.ts";
import { createDevicePin, hashDevicePin, readDevicePin, devicePinKey } from "../src/lib/device-pin.ts";
import dashboardManifestModule from "../src/lib/pwa-manifest.ts";
import { getTrustedUserRole } from "../src/lib/auth-role.ts";
import { requestPwaInstallation } from "../src/lib/pwa-install.ts";

// tsx exposes a TypeScript default export through a CJS compatibility layer
// when the package does not declare `type: module`.
const dashboardManifest = dashboardManifestModule.default ?? dashboardManifestModule;

test("shared dashboard manifest preserves identity and opens login", () => {
  const manifest = dashboardManifest();
  assert.equal(manifest.id, "/");
  assert.equal(manifest.name, "Okesih.com");
  assert.equal(manifest.short_name, "Okesih.com");
  assert.equal(manifest.start_url, "/login");
  assert.equal(manifest.scope, "/");
});

test("dedicated dashboards keep independent install identities", () => {
  for (const path of ["/", "/owner", "/owner/menu", "/superadmin", "/marketing", "/admin"]) assert.equal(isDashboardLaunch(path), true, path);
  assert.equal(installationKind("/"), "DASHBOARD");
  assert.equal(installationKind("/owner"), "OWNER");
  assert.equal(installationKind("/owner/menu"), "OWNER");
  assert.equal(installationKind("/marketing/dashboard"), "MARKETING");
  assert.equal(installationKind("/marketing/dashboard/komisi"), "MARKETING");
  assert.equal(installationKind("/superadmin"), "SUPERADMIN");
  for (const path of ["/login", "/pos", "/kds", "/menu/risolinan", "/tv", "/ownership"]) {
    assert.equal(isDashboardLaunch(path), false, path);
  }
  assert.equal(installationKind("/pos"), "POS");
  assert.equal(installationKind("/kds"), "KDS");
});

test("each installed PWA accepts only its matching account role", () => {
  const expected = {
    superadmin: "SUPERADMIN",
    owner: "OWNER",
    marketing: "MARKETING",
    pos: "KASIR",
    kds: "DAPUR",
  };
  const allRoles = Object.values(expected);

  for (const [kind, allowedRole] of Object.entries(expected)) {
    assert.deepEqual(PWA_ROLE_CONFIGS[kind].allowedRoles, [allowedRole]);
    for (const role of allRoles) {
      assert.equal(isRoleAllowedForPwa(role, kind), role === allowedRole, `${kind} / ${role}`);
    }
  }
});

test("authorization trusts server-managed app metadata only", () => {
  assert.equal(getTrustedUserRole({ app_metadata: { role: "SUPERADMIN" } }), "SUPERADMIN");
  assert.equal(getTrustedUserRole({ app_metadata: { role: "OWNER" } }), "OWNER");
  assert.equal(getTrustedUserRole({ user_metadata: { role: "SUPERADMIN" }, email: "superadmin@okesih.local" }), null);
  assert.equal(getTrustedUserRole({ app_metadata: { role: "OWNER" }, user_metadata: { role: "SUPERADMIN" } }), "OWNER");
});

test("install prompt is consumed once and reads browser userChoice", async () => {
  let prompted = 0;
  globalThis.window = {
    __okesihInstallKind: "OWNER",
    __okesihInstallPrompt: {
      prompt: async () => { prompted += 1; },
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    },
  };
  assert.equal(await requestPwaInstallation("OWNER"), "accepted");
  assert.equal(prompted, 1);
  assert.equal(await requestPwaInstallation("OWNER"), "unavailable");
  delete globalThis.window;
});

test("operational and dashboard manifests keep native launch targets", async () => {
  const expectedManifests = [
    ["pos", "OKESIH Kasir", "Kasir OKESIH", "/pos?pwa=pos", "/pos", "/pos"],
    ["kds", "OKESIH Dapur KDS", "Dapur OKESIH", "/kds?pwa=kds", "/kds", "/kds"],
    ["owner", "Okesih.com", "Okesih.com", "/login", "/", "/"],
    ["marketing", "Okesih.com", "Okesih.com", "/login", "/", "/"],
    ["superadmin", "Okesih.com", "Okesih.com", "/login", "/", "/"],
  ];

  for (const [kind, name, shortName, path, id, scope] of expectedManifests) {
    const manifest = JSON.parse(await readFile(new URL(`../public/manifest-${kind}.webmanifest`, import.meta.url), "utf8"));
    assert.equal(manifest.name, name);
    assert.equal(manifest.short_name, shortName);
    assert.equal(manifest.start_url, path);
    assert.equal(manifest.scope, scope);
    assert.equal(manifest.id, id);
    assert.deepEqual(manifest.icons.map((icon) => [icon.src, icon.sizes, icon.type]), [
      ["/icons/pwa-192.png", "192x192", "image/png"],
      ["/icons/pwa-192.png", "192x192", "image/png"],
      ["/icons/pwa-512.png", "512x512", "image/png"],
      ["/icons/pwa-512.png", "512x512", "image/png"],
    ]);
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
