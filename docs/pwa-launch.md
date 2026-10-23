# Installed application launch behavior

Each internal role has its own manifest and start route, defined in `src/lib/pwa-routing.ts`:

| Role | Manifest | Start route |
|---|---|---|
| Super Admin | `/manifest-superadmin.webmanifest` | `/superadmin?pwa=superadmin` |
| Owner | `/manifest-owner.webmanifest` | `/owner?pwa=owner` |
| Mitra | `/manifest-marketing.webmanifest` | `/marketing/dashboard?pwa=marketing` |
| Kasir | `/pos/manifest.webmanifest` | `/pos?pwa=pos` |
| Dapur | `/kds/manifest.webmanifest` | `/kds?pwa=kds` |

The static POS/KDS manifests remain available for compatibility. Current manifests use `pwa-192.png` and `pwa-512.png`. File-based icons under `src/app/` are Next.js metadata entry points, even without an explicit import.

`StandaloneLauncher` handles installed mobile apps visiting the public home page. Authentication and subdomain handoff enforce access to protected routes. Returning from the background does not unconditionally redirect an authenticated dashboard to login.

## Cashier access

The active POS uses `CashierShiftGate`, server-backed cashier sessions, device pairing, and shift ownership. The unused local screen-lock PIN component and its dedicated helper/styles/tests were removed. Owner security PIN and cashier audit PIN are separate active features and remain in place. KDS retains its own device authorization.

## Android Back

`PwaBackExitGuard` preserves previous-page navigation and warns at the exit boundary for installed Android Super Admin, Owner, Mitra, and Kasir apps. The warning has no buttons. Tap outside to cancel or press Back again to continue native exit/minimize. Session credentials are not cleared. See `blueprint.md` for platform limitations and validation.

## Verification

Run `npm run test:pwa`, `node --import tsx --test scripts/pwa-exit.test.mjs`, and `npm run check`. Browsers control installed-app metadata updates. Do not clear site storage to refresh an installation: it contains pairing and offline data.
