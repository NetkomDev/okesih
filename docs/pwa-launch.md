# Installed application launch behavior

- Dashboard routes (Owner, Super Admin, Marketing, Admin) share `/manifest.webmanifest`: **OKESIH POS**, start `/login`, identity `/` retained from the original root-start application.
- Cashier uses `/manifest-pos.webmanifest`: **OKESIH KASIR**, start `/pos`, existing identity `/pwa/pos` retained.
- Kitchen uses `/manifest-kds.webmanifest`: **OKESIH KDS**, start `/kds`, existing identity `/pwa/kds` retained.
- `/manifest-owner.webmanifest` remains available for previously installed Owner apps, with its original identity and updated name/login start. New installations use the shared dashboard manifest.
- The shared manifest is an ordinary `/manifest.webmanifest` route handler, not the special `app/manifest.ts` convention: file-based metadata otherwise overrides the nested POS/KDS manifest links in this Next.js version.
- Normal browser visits retain the public website. Installed dashboard windows redirect to login on document launch, history restoration, and return from the background. Client navigation after successful login remains available. Customer menu and operational routes are excluded.

## Cashier screen PIN

The first use of a paired cashier device sets a six-digit **local screen-lock PIN**. A salted PBKDF2-SHA256 verifier (600,000 iterations) is stored per device ID, never the plaintext PIN. Unlock state is memory-only and is cleared on reload, backgrounding, or manual locking. Five failures trigger a one-minute local cooldown. Offline verification works on a previously paired device.

This PIN is not server authentication or a staff account: existing server-side device pairing, expiry, revocation, and tenant checks remain the authorization boundary. Someone with browser developer tools/storage access can bypass a local lock; storage deletion also removes the verifier. For a centrally enforced staff PIN, add server-side credential storage and verification as a separate feature. To recover a forgotten PIN, the Owner revokes the old device and approves a new pairing (new device ID).

KDS still requires initial tenant pairing but no login/PIN afterward. Bootstrap and order requests explicitly identify POS vs KDS so that both cookies can coexist without choosing the wrong device.

## Verification and rollout

Run `node --experimental-strip-types --test scripts/test-pwa-launch.mjs`, targeted ESLint, and `npm run build`.

Browsers control installed-app name/start-url updates. An existing installation may need to be closed/reopened or reinstalled from the correct route. Do not clear site data unnecessarily; this would remove device pairing/offline data and local PINs. An app window that is already foregrounded does not reliably receive an event when its launcher icon is clicked again.

The existing Marketing route is a public recruitment page, not an authenticated marketing dashboard. This change gives installations from that route the shared login entry point; it does not create new Marketing accounts or permissions.
