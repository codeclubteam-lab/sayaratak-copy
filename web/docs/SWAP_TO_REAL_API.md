# Swap to the real API

The app talks to the API through `apiFetch` (`src/lib/api/client.ts`) and validates every response with the schemas in `packages/shared/src/schemas`. Authentication calls go through the Better-Auth client (`src/lib/auth-client.ts`) against `/api/v1/auth/*`, while account reads (`GET /api/v1/me`) and password changes (`POST /api/v1/me/password`) stay on the API router.

## 1. Point the app at the API

```bash
API_BASE_URL=https://api.example.sd        # server-side rendering calls (local default http://localhost:4000)
VITE_API_BASE_URL=https://api.example.sd   # browser calls, read at build time: rebuild after changing it
APP_ORIGIN=https://example.sd              # canonical links, sitemap, robots
IMAGE_ORIGINS=https://res.cloudinary.com   # extra Content-Security-Policy img-src origins
```

`buildUrl` appends `/api/v1` to the origin, so the API serves versioned endpoints under `/api/v1` (`https://api.example.sd/api/v1/listings`). Health checks stay under `/api/health/*`.

During server rendering `apiFetch` forwards the visitor's `cookie` header (`src/lib/api/forwarded-cookie.ts`), so the API sees the signed-in user. The mock `x-mock-ssr` header has been dropped from `apiFetch`.

## 2. Cookies and CORS

Keep the app and the API under one parent site (`example.sd` and `api.example.sd`) so the session cookie stays first-party across server rendering and browser calls with `SameSite=Lax`.

- Session cookies: prefix `sy` (`sy.session_token`, or `__Secure-sy.session_token` over HTTPS), `HttpOnly`, `SameSite=Lax`, `Path=/`, with `Secure` enabled when `APP_ENV=production` and `crossSubDomainCookies` (`Domain=.<COOKIE_DOMAIN>`) enabled whenever `COOKIE_DOMAIN` is set. Cookie caching is off so revocations and bans apply immediately.
- CORS on the API: `Access-Control-Allow-Origin` set to the exact `WEB_ORIGIN` (never `*`), `Access-Control-Allow-Credentials: true`, allowed methods `GET, POST, PATCH, PUT, DELETE`, allowed header `content-type` (plus `authorization`, `idempotency-key`, `x-platform`, `x-app-version` for mobile clients). Answer preflight `OPTIONS`.
- CSRF: the API `csrfOrigin` middleware checks `Origin` matches `WEB_ORIGIN` on non-GET/HEAD/OPTIONS requests carrying the session cookie (`Origin` may be absent only on cookieless bearer calls). Better-Auth checks `trustedOrigins` (plus Apple form POST origin when Sign in with Apple is enabled).

## 3. Uploads and media CSP

- Media storage uses **Cloudinary** (not MinIO/S3). Public images receive Cloudinary delivery URLs (`https://res.cloudinary.com/...`) using eager strict transformation `c_limit,f_webp,q_auto,w_{w}` for `{w}` in `320`, `640`, `960`, and `1280`; incoming transforms re-encode and strip EXIF/GPS (2560 px max for images, 1280 px and 2 Mbit/s for videos).
- `POST /api/v1/uploads` requires a signed-in session (plus idempotency key) and returns a `Media` (`listing:mediaSchema`).
- Private files (Bankak payment receipts and verification documents) are stored private on Cloudinary and **streamed through the API at `GET /api/v1/uploads/:id`** after an owner-or-admin session check (`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, sandboxed CSP; `404` for anyone else). Seeded demo assets stay under `api/demo` (`dev`/`test` only).
- Web CSP (`src/lib/csp.ts`, used by `src/server.ts`) allows `https://res.cloudinary.com` in both `img-src` and `media-src` alongside `IMAGE_ORIGINS`, and includes the browser API origin (`VITE_API_BASE_URL`) in `connect-src`, `img-src`, and `media-src` so streamed private files and redirects load cleanly.

## 4. Authentication with Better-Auth

The mock's `/auth/*` contract is replaced by Better-Auth (`1.7.10`) mounted at `/api/v1/auth/*` (already integrated in Step 11.1/11.2):

1. `better-auth` `1.7.10` is installed and configured in `src/lib/auth-client.ts` (`basePath: "/api/v1/auth"`, `emailOTPClient()` and `twoFactorClient()` plugins).
2. Mutations in `src/features/auth/auth-queries.ts` / `queries.ts`:

| Today (mock) | Real API / Better-Auth |
|---|---|
| `POST /auth/login` | `authClient.signIn.email` (or `twoFactorRedirect` -> `AdminCodeStep`) |
| `POST /auth/signup` then `/auth/signup/verify` | `authClient.signUp.email` then `authClient.emailOtp.verifyEmail` |
| `POST /auth/forgot`, `/auth/forgot/verify`, `/auth/reset` | `authClient.emailOtp.requestPasswordReset` + `checkVerificationOtp` + `resetPassword` |
| `POST /auth/oauth/:provider` | `authClient.signIn.social({ provider, callbackURL })` (redirect for Google, Facebook, Apple; returns via `/$locale/auth/callback`) |
| `POST /auth/logout` | `authClient.signOut` |
| `POST /me/password` | `POST /api/v1/me/password` (kept on API per decision O2; wraps `changePassword` or server `setPassword` for social-only accounts) |

3. `GET /api/v1/me` stays on the backend returning `user:userSchema` (role, onboarding state, verified flags, `hasPassword`, leaving `email` blank for Facebook placeholder `fb-<id>@facebook.invalid`).
4. Sign-up sets `requireEmailVerification: true` (unfinished unverified credential accounts are deleted on retry and pruned after 24 hours by a background job).
5. Admin accounts have `twoFactor` enabled via emailed OTP (`trustDevice: false`; `/api/v1/admin/*` refuses bearer tokens and admin sessions before second-step verification).
6. Better-Auth error codes are mapped in `src/lib/api/auth-error.ts` to the shared i18n keys; bans return 403 `banned`.
7. Mock-only UI (`mock-oauth-dialog.tsx`, on-screen `demoCode`, `DemoTools`, `/mock/*` dev-panel buttons, backup restore UI) was removed in Step 11.2; backup restores show a copyable backup ID and CLI note (`bun run db:restore <id>`). `codeSentSchema.demoCode` was retired in Step 11.5 (offline unit tests continue using `tests/mock-fetch.ts`).

Phone OTP (`VITE_FEATURE_OTP`) stays off until SMS delivery exists.

## 5. Remove the mock from the running app

Done in Step 11.3:

1. `src/routes/api/$.ts` deleted and `src/routeTree.gen.ts` regenerated (`bun run generate-routes`).
2. `src/routes/sitemap[.]xml.ts` reads `GET /api/v1/sitemap` via `apiFetch` and renders XML with `src/lib/sitemap.ts`.
3. `src/mocks` remains dev/test-only for Vitest (`tests/mock-fetch.ts`), API parity tests, and static audit scripts; it is no longer imported by any web runtime route.
4. `@faker-js/faker` moved to `devDependencies`.
5. `MOCK_LATENCY_MS` and `MOCK_EMPTY` removed from `.env.example` and deployment config (`render.yaml`).

## 6. Turn off demo flags

- Set `VITE_DEMO=false` before building for production to hide `DemoAccounts` on the login form, and keep `VITE_FEATURE_OTP=false`. Rebuild after changing `VITE_*` variables.
- The dev panel (`Ctrl+Shift+D`, `Failure`, `Latency`, `Switch account`) mounts only when `import.meta.env.DEV` is true.

## 7. Check the swap

1. `bun run --cwd web typecheck && bun run --cwd web lint && bun run --cwd web build && bun run --cwd web size`.
2. Step 11.5 runs the Playwright suites (`test:e2e`, `test:states`, `test:journeys`) and `seo:check` against the seeded test-mode API (plus an `app.localtest.me` / `api.localtest.me` reverse-proxy check confirming shared-domain cookie forwarding during SSR).
3. Verify sign up, login, admin 2FA code, forgot password, social OAuth redirect, post wizard upload after sign-in, Bankak receipt review, and backups CLI copy in both Arabic and English.
