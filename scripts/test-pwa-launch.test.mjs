import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { detectActivePwaKind, installationKind, isDashboardLaunch, isRoleAllowedForPwa, pwaKindForHostname, PWA_ROLE_CONFIGS } from "../src/lib/pwa-routing.ts";
import { APP_HOSTS, isApiAllowedOnSurface, roleHomeUrl, surfaceForHostname, surfaceForPath } from "../src/lib/app-origins.ts";
import { createDevicePin, hashDevicePin, readDevicePin, devicePinKey } from "../src/lib/device-pin.ts";
import dashboardManifestModule from "../src/lib/pwa-manifest.ts";
import { getTrustedUserRole } from "../src/lib/auth-role.ts";
import { requestPwaInstallation } from "../src/lib/pwa-install.ts";
import {
  createWhatsAppUrl,
  formatWhatsAppDate,
  getSuperAdminWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "../src/lib/whatsapp.ts";

// tsx exposes a TypeScript default export through a CJS compatibility layer
// when the package does not declare `type: module`.
const dashboardManifest = dashboardManifestModule.default ?? dashboardManifestModule;

test("public manifest preserves the public origin identity", () => {
  const manifest = dashboardManifest();
  assert.equal(manifest.id, "/");
  assert.equal(manifest.name, "Okesih.com");
  assert.equal(manifest.short_name, "Okesih.com");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
});

test("production hostnames isolate every internal application", () => {
  const expected = {
    PUBLIC: [APP_HOSTS.PUBLIC, null],
    SUPERADMIN: [APP_HOSTS.SUPERADMIN, "superadmin"],
    OWNER: [APP_HOSTS.OWNER, "owner"],
    MARKETING: [APP_HOSTS.MARKETING, "marketing"],
    POS: [APP_HOSTS.POS, "pos"],
    KDS: [APP_HOSTS.KDS, "kds"],
  };
  for (const [surface, [hostname, pwaKind]] of Object.entries(expected)) {
    assert.equal(surfaceForHostname(hostname), surface);
    assert.equal(pwaKindForHostname(hostname), pwaKind);
  }
  assert.equal(surfaceForHostname("localhost"), null);
  assert.equal(surfaceForPath("/superadmin"), "SUPERADMIN");
  assert.equal(surfaceForPath("/owner/devices"), "OWNER");
  assert.equal(surfaceForPath("/marketing/dashboard/komisi"), "MARKETING");
  assert.equal(surfaceForPath("/pos"), "POS");
  assert.equal(surfaceForPath("/kds"), "KDS");
  assert.equal(surfaceForPath("/menu/demo"), "PUBLIC");
  assert.equal(roleHomeUrl("OWNER"), "https://owner.okesih.com/owner");
  assert.equal(roleHomeUrl("KASIR"), "https://pos.okesih.com/pos");
});

test("API endpoints are limited to the matching production surface", () => {
  assert.equal(isApiAllowedOnSurface("/api/owner/dashboard", "OWNER"), true);
  assert.equal(isApiAllowedOnSurface("/api/owner/dashboard", "POS"), false);
  assert.equal(isApiAllowedOnSurface("/api/superadmin/tenants", "SUPERADMIN"), true);
  assert.equal(isApiAllowedOnSurface("/api/marketing/dashboard", "MARKETING"), true);
  assert.equal(isApiAllowedOnSurface("/api/device/bootstrap", "POS"), true);
  assert.equal(isApiAllowedOnSurface("/api/device/bootstrap", "KDS"), true);
  assert.equal(isApiAllowedOnSurface("/api/device/bootstrap", "OWNER"), false);
  assert.equal(isApiAllowedOnSurface("/api/platform-settings", "PUBLIC"), true);
  assert.equal(isApiAllowedOnSurface("/api/auth/handoff/start", "PUBLIC"), true);
  assert.equal(isApiAllowedOnSurface("/api/auth/handoff/start", "OWNER"), false);
  assert.equal(isApiAllowedOnSurface("/api/auth/handoff/consume", "OWNER"), true);
  assert.equal(isApiAllowedOnSurface("/api/auth/handoff/consume", "POS"), true);
  assert.equal(isApiAllowedOnSurface("/api/auth/handoff/consume", "PUBLIC"), false);
});

test("public origin cannot be turned into an internal login portal by query string", () => {
  globalThis.window = {
    location: { hostname: "www.okesih.com", search: "?from_pwa=owner", pathname: "/login" },
  };
  assert.equal(detectActivePwaKind(), null);
  delete globalThis.window;
});

test("dedicated dashboards keep independent install identities", () => {
  for (const path of ["/", "/owner", "/owner/menu", "/superadmin", "/marketing", "/admin"]) assert.equal(isDashboardLaunch(path), true, path);
  assert.equal(installationKind("/"), "DASHBOARD");
  assert.equal(installationKind("/owner"), "OWNER");
  assert.equal(installationKind("/owner/menu"), "OWNER");
  assert.equal(installationKind("/marketing/dashboard"), "MARKETING");
  assert.equal(installationKind("/marketing/dashboard/komisi"), "MARKETING");
  assert.equal(installationKind("/superadmin"), "SUPERADMIN");
  assert.equal(installationKind("/admin"), "SUPERADMIN");
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

test("install prompt cannot be consumed by a different application kind", async () => {
  let prompted = 0;
  globalThis.window = {
    __okesihInstallKind: "OWNER",
    __okesihInstallPrompt: {
      prompt: async () => { prompted += 1; },
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    },
  };
  assert.equal(await requestPwaInstallation("KDS"), "unavailable");
  assert.equal(prompted, 0);
  delete globalThis.window;
});

test("operational and dashboard manifests keep native launch targets", async () => {
  const expectedManifests = [
    ["pos", "OKESIH Kasir", "Kasir OKESIH", "/pos?pwa=pos", "/", "/"],
    ["kds", "OKESIH Dapur KDS", "Dapur OKESIH", "/kds?pwa=kds", "/", "/"],
    ["owner", "OKESIH Owner", "Owner OKESIH", "/owner?pwa=owner", "/", "/"],
    ["marketing", "OKESIH Sales", "Sales OKESIH", "/marketing/dashboard?pwa=marketing", "/", "/"],
    ["superadmin", "OKESIH Super Admin", "Admin OKESIH", "/superadmin?pwa=superadmin", "/", "/"],
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

test("WhatsApp links normalize Indonesian numbers and preserve generated messages", () => {
  assert.equal(normalizeIndonesianWhatsAppNumber("+62 856-9448-8510"), "6285694488510");
  assert.equal(normalizeIndonesianWhatsAppNumber("0856 9448 8510"), "6285694488510");
  assert.equal(getSuperAdminWhatsAppNumber("0856-9448-8510"), "6285694488510");
  const message = "Tenant: Risolinan\nJumlah: Rp 25.123";
  const url = new URL(createWhatsAppUrl("085694488510", message));
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/6285694488510");
  assert.equal(url.searchParams.get("text"), message);
  assert.equal(formatWhatsAppDate("2026-10-18"), "18 Oktober 2026");
  assert.throws(() => createWhatsAppUrl("123", message));
});

test("credential and billing flows use manual WhatsApp links, not the legacy outbox", async () => {
  const routeFiles = [
    "../src/app/api/superadmin/marketing/route.ts",
    "../src/app/api/superadmin/tenants/route.ts",
    "../src/app/api/superadmin/tenant-applications/route.ts",
    "../src/app/api/owner/billing/route.ts",
  ];
  for (const relativePath of routeFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.equal(source.includes('.from("whatsapp_outbox")'), false, relativePath);
    assert.equal(source.includes("createWhatsAppUrl"), true, relativePath);
  }
});
