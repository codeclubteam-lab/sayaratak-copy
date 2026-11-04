# Swap to the real API

The app talks to the API only through `apiFetch` (`src/lib/api/client.ts`) and validates every response with the schemas in `packages/shared/src/schemas`. The real API that implements `BACKEND_HANDOFF.md` with those schemas needs the steps below. Authentication is the exception: the backend uses Better-Auth's own endpoints (owner decision, 2026-10-27), so step 4 changes frontend code.

## 1. Point the app at the API

```bash
API_BASE_URL=https://api.example.sd        # server-side rendering calls
VITE_API_BASE_URL=https://api.example.sd   # browser calls, read at build time: rebuild after changing it
APP_ORIGIN=https://example.sd              # canonical links, sitemap, robots
```

`buildUrl` appends `/api` to the origin, so the API must serve its routes under `/api` (`https://api.example.sd/api/listings`). If it does not, change `buildUrl` in one place.

During server rendering `apiFetch` forwards the visitor's `cookie` header (`src/lib/api/forwarded-cookie.ts`), so the API sees the signed-in user. The API must accept that cookie from the app server as it would from a browser. The `x-mock-ssr: 1` header it also sends can be dropped from `apiFetch`; it only told the mock to skip its fake delay.

## 2. Cookies and CORS

Keep the app and the API on the same site (`example.sd` and `api.example.sd`) so the session cookie stays first-party and `SameSite=Lax` works.

- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.example.sd`, `Path=/`.
- CORS on the API: `Access-Control-Allow-Origin` set to the exact app origin (never `*`), `Access-Control-Allow-Credentials: true`, allowed methods `GET, POST, PATCH, PUT, DELETE`, allowed header `content-type`. Answer preflight `OPTIONS`.
- CSRF: with cookies and credentials, check the `Origin` header on every state-changing request (Better-Auth's `trustedOrigins` covers its own routes).
- The cookie name does not matter to the frontend: no client code reads `sy_session`. Better-Auth's default is `better-auth.session_token` (with the `__Secure-` prefix over HTTPS); keep it or set a prefix.

## 3. Uploads

- `POST /api/uploads` stays multipart (`file`, plus `poster` for a video) and returns a `Media` (`listing:mediaSchema`) whose `url` the browser loads directly. Store in MinIO (S3 compatible). Listing photos, business images and banners can be public-read behind a CDN; payment receipts and verification documents must stay private and be served through short-lived signed URLs to their owner and admins.
- `url` may contain `{w}`; the frontend fills 320, 640, 960 and 1280. Generate those widths on upload.
- Receipts (`POST /payments`) and verification documents (`POST /me/verification`) are multipart too; keep the field names.
- Mock and seed images in `public/mock/` (vehicle and business photos, banners) are demo content. Real data never points at them.

## 4. Authentication with Better-Auth

The mock's `/auth/*` contract is replaced. What changes:

1. Add `better-auth` to the frontend and create one client (`createAuthClient` from `better-auth/react`, `baseURL` = the API origin, with the `emailOTP` plugin). Record the new dependency in the Deviations table.
2. Rewrite the mutations in `src/features/auth/queries.ts` to call the client. Check method names against the installed version; in the current docs they are:

| Today (mock) | Better-Auth |
|---|---|
| `POST /auth/login` | `signIn.email` |
| `POST /auth/signup` then `/auth/signup/verify` | `signUp.email`, then the email OTP plugin's verify-email call |
| `POST /auth/forgot`, `/auth/forgot/verify`, `/auth/reset` | the email OTP plugin's forget-password and reset-password calls (one step fewer: the code and the new password go together) |
| `POST /auth/oauth/:provider` | `signIn.social({ provider, callbackURL })` (a redirect, not a dialog) |
| `POST /auth/logout` | `signOut` |
| `POST /me/password` | `changePassword` |

3. Keep `GET /api/me` on the backend as a small route that reads the Better-Auth session and returns `user:userSchema` (role, onboarding state, verified flags, `hasPassword`). `meQuery`, the route guards, the header and every dashboard read it, so keeping it avoids touching them.
4. Sign-up order changes: Better-Auth creates the user before the email code is verified, the mock after. Either block sign-in until the email is verified (`requireEmailVerification`) or accept unverified accounts and keep the verify step. The "Email verified" screen stays.
5. Better-Auth returns its own error codes. Map them to the existing keys in one place (`auth.invalid_credentials`, `auth.account_exists`, `auth.otp_invalid`, `auth.too_many_attempts`, `auth.account_suspended`) so the forms stay the same.
6. Remove the mock-only pieces: `mock-oauth-dialog.tsx` (replace with the social redirect), the `demoCode` display in `code-step.tsx`, and `demoCode` in `api:codeSentSchema`.
7. Bans: Better-Auth's `admin` plugin has ban with expiry. Whatever is used, a banned user's requests must return 403 `banned` so the app shows the suspended page.
8. Update the tests that drive the auth flow: `tests/auth-flow.test.tsx`, `tests/auth-gate.test.tsx`, `tests/session-edge.test.tsx`, `tests/mock-oauth-dialog.test.tsx`, and the journeys in `e2e/journeys` that sign in.

Phone OTP (`/auth/otp/*`, `VITE_FEATURE_OTP`) is future work; Better-Auth's phone number plugin is the candidate.

## 5. Remove the mock from the running app

1. Delete `src/routes/api/$.ts` so `/api/*` is no longer answered by the app server, and run `bun run generate-routes`.
2. `/sitemap.xml` reads `src/mocks/sitemap.ts`. Point it at the API instead (a backend endpoint that returns the same entries, or let the backend serve the sitemap), keeping `src/lib/sitemap.ts` for the XML.
3. Keep `src/mocks` for now: every unit and component test runs its API calls through it (`tests/mock-fetch.ts`), and `scripts/seo-lib.ts`, `scripts/audit-design.ts` and `e2e/routes.ts` read its seed. It is never in the client bundle. Moving it under `tests/` is a later clean-up; deleting it means rewriting those tests.
4. Move `@faker-js/faker` to `devDependencies`.
5. Drop the `MOCK_LATENCY_MS`, `MOCK_EMPTY` and `MOCK_REPLY_MS` variables from the deployment.

## 6. Turn off demo flags

- `VITE_DEMO=false` hides the demo accounts on the sign-in page, the on-screen email code, the "Reset demo data" button in admin settings (it calls `POST /mock/reset`), and stops the mock auto-reply. Rebuild after changing it.
- The dev panel (`Ctrl+Shift+D`) and its `mock_fail` cookie, `/mock/expire-session` and `/mock/ban-me` calls exist only in development builds (`import.meta.env.DEV`). Nothing to do for production; it will show errors in development against a real API, so remove those buttons or point them at a dev-only backend route.
- `VITE_FEATURE_OTP=false` until phone verification exists.

## 7. Check the swap

1. `bun run typecheck && bun run lint && bun run build && bun run size`.
2. Seed the backend with the demo accounts from `README.md` (same emails and password) and enough listings, then run `bun run test:e2e` and `bun run test:journeys` against it. The journeys assume the seed in `src/mocks/seed`; differences in data show up as failures there first.
3. `bun run seo:check https://example.sd` against the deployed app.
4. Walk sign up, sign in, forgot password, post a listing with photos, pay by receipt, and admin approval in both languages.
