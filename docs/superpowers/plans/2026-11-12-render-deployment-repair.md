# Render deployment repair implementation plan

> **For agentic workers:** Execute inline, one owner-approved task at a time. Use the applicable execution workflow, such as `superpowers:executing-plans` if available. Do not delegate, batch tasks, or advance automatically. The owner's stop-and-permission rule overrides any workflow that would continue to the next task.

**Goal:** Make the existing free Render deployment usable for browsing, signup, email verification, login and logout without buying a domain or changing the managed email provider.

**Architecture:** Browser requests use the website's `/api/v1/*` address. A small server-side forwarder sends them to the existing API, preserving cookies and responses. Server-rendered pages continue calling the API directly with the visitor's cookies. Better-Auth uses the website as its public authentication address and issues host-only, secure cookies on HTTPS.

**Tech stack:** Bun 1.4.2, existing TanStack Start server entry, React, Better-Auth 1.7.10, Hono, PostgreSQL 18, Vitest, Playwright, Render Free. No new dependency is planned.

**Spec:** Owner-approved approach in this conversation, with the subsequent requirement to write a plan first and stop after each task. Extends `api/plan/implementation.md` steps 11.3, 11.5 and 11.6. Repository authority remains `AGENTS.md`, `api/CONTRIBUTING.md` and the existing plans.

## How permission works

1. Writing this plan does not start Task 1.
2. The owner approves a task by number, for example, "Start Task 1."
3. Work only on that task. Its internal checkboxes are steps, not permission to start another task.
4. Report the result, exact checks, files changed and any remaining blocker. Update both progress trackers.
5. Stop. Wait for permission for the next task, including when all checks passed.
6. If evidence changes the proposed fix, stop and explain the change before editing outside the approved scope.
7. A blocked task stays blocked. Do not silently skip it or mark later acceptance checks complete.

## Beginner overview

| Task | What it achieves | Finished when | Live changes? |
| --- | --- | --- | --- |
| 1 | Safely access Render and identify the database-check failure | A redacted diagnosis and exact configuration inventory are recorded | No, diagnosis only |
| 2 | Prepare the smallest verified readiness repair | Its regression/check passes locally and the exact live remedy is reviewed | No |
| 3 | Connect browser API requests through the website | Forwarding and security tests pass locally | No |
| 4 | Make login cookies and deployment settings agree | HTTPS cookie/config tests pass, with exact env values documented | No |
| 5 | Prove the complete repair locally | Real-API browser tests and applicable gates pass | No |
| 6 | Apply the approved repair on Render | New deployment serves both homepages and API readiness passes | Yes, approved settings/deploy and only necessary DB work |
| 7 | Verify actual signup and login on the live site | Real email verification, persistent login and logout pass | Yes, only agreed test-account actions |

**Current status:** Tasks 1-4 locally complete with their scoped gates; Task 3 includes the separately approved client-IP extension and atomic mail-cap prerequisite. Task 4 includes the owner-approved Nitro startup hook and explicit deferral of the actual Google Console rollback inventory to Task 6 before any Console edit. No hosted setting/data/push/deploy change has occurred. Tasks 5-7 remain separately gated. See both progress trackers for commits/evidence; stop after Task 4 and await Task 5 permission.

## Known evidence, checked earlier on 2026-11-12

- Website: `https://sayaratak-web.onrender.com/en` returned HTTP 500.
- Browser requests for `/api/v1/site` and `/api/v1/me` went to the website and returned HTML 404 responses.
- API: `https://sayaratak-api-91a8.onrender.com` returned 200 for `/api/v1/site`, `/api/v1/me` and `/api/v1/taxonomy`. Signed-out `/me` returned JSON `null`.
- API `/api/health/ready` returned 503 with `database=ok`, `migrations=failed`, `smtp=ok`, `jobs=ok`.
- API CORS already accepted `https://sayaratak-web.onrender.com`.
- Website CSP allowed `connect-src 'self'`, which is compatible with the proposed same-origin browser requests. It is not necessary to weaken CSP.
- Render CLI is installed, but its saved authentication token expired.
- Owner confirms the deployed managed SMTP port is 2525. The earlier inference that SMTP must be blocked was withdrawn. SMTP connectivity passed; real message delivery is not yet verified.
- `databaseIsMigrated()` catches errors and returns false. Its failed check does not prove migrations are missing: query permission or journal-file failures can produce the same result.

## Global constraints

- Keep both services and the database on their existing free plans. No new domain, service or paid resource.
- Keep managed SMTP on 2525 and preserve its credentials, sender and provider. Do not copy the local `.env` over Render's env; local SMTP currently differs from the owner-reported deployed port.
- Do not reset, reseed, truncate, restore over or delete the live database. Never run `db:seed`, journey resets or `/api/_test/*` against the hosted database.
- Never expose OTP retrieval/test-reset routes on the deployed app. Never disable verification, CSRF, trusted-origin checks or authentication to make a test pass.
- No secrets in commits, chat, screenshots, process arguments or logs. Reauthentication happens through the owner's Render login flow, not pasted credentials.
- HTTPS must produce `HttpOnly; Secure; SameSite=Lax; Path=/` authentication cookies without a `Domain` attribute for these Render hostnames. Never set `COOKIE_DOMAIN=onrender.com`.
- Preserve the existing native/mobile API and bearer-auth contracts. The direct public API address remains available.
- Keep `APP_ENV=development` for this owner-approved free test deployment. A production build on a public URL is not the same as production-launch sign-off. Do not weaken `prodSchema` requirements to bypass them.
- Use Bun only. Run memory-heavy checks sequentially; Vitest uses `--maxWorkers=2`. Use Podman, never Docker, for local containers. Stop temporary servers/browser/postgres-test afterward.
- No new packages, UI redesign, unrelated cleanup or full release-gate claim. `11.6` and web `14.13` retain their other open gates.
- Each code task starts with a failing regression, then the smallest fix, then passing applicable gates. No failing commit. A local commit does not authorize a push or deployment.
- Record each task in `api/plan/progress.md` and `web/plan/progress.md`, including Resume here, evidence, gate state and decisions/deviations. Refresh graphify after source-code changes.

## File and responsibility map

These are planned paths, not files already created by this plan.

| Path | Responsibility / planned treatment |
| --- | --- |
| `api/src/shared/db/health.ts` | Existing readiness comparison; change only if Task 1 proves a code defect |
| `api/src/shared/http/health.test.ts` | Existing readiness regression tests |
| `api/src/shared/db/app-role.ts` | Existing restricted DB-role grants; change only if proved necessary |
| `api/scripts/migrate.ts`, `api/drizzle/meta/_journal.json`, `api/Dockerfile` | Inspect migration runner, expected journal and packaged files; no invented migration |
| `web/src/lib/server/api-proxy.ts` | New server-only fixed-upstream forwarding helper |
| `web/src/lib/server/deployment-config.ts` | New server-only validation of existing deployment-origin variables |
| `web/src/server.ts` | Dispatch supported `/api/v1/*` requests before TanStack HTML handling |
| `web/tests/api-proxy.test.ts` | New forwarding and security regressions |
| `web/tests/deployment-config.test.ts` | New deployed configuration regressions |
| `web/tests/lib-helpers.test.ts`, `web/tests/auth-client.test.ts` | Existing API URL, CSP and auth transport behavior |
| `api/src/modules/auth/auth.config.ts` | Secure cookie choice based on HTTPS as well as production mode |
| `api/src/modules/auth/auth.cookie-options.ts` | Small pure helper if needed to test cookie policy without starting the DB |
| `api/src/modules/auth/auth.cookie-options.test.ts` | New HTTP/HTTPS cookie-policy regressions |
| `api/src/modules/auth/auth.session.test.ts`, `auth.origin.test.ts` | Real session and origin behavior, not just configuration assertions |
| `api/src/modules/uploads/uploads.service.ts`, `uploads.read.test.ts` | Existing private URLs use `BETTER_AUTH_URL`; verify website-origin URLs remain owner/admin protected |
| `render.yaml`, `web/.env.example`, `api/.env.example` | Correct public/ upstream addresses, preserve free plans and secret handling |
| `web/docs/SWAP_TO_REAL_API.md`, `api/RUNBOOK.md` | Document same-origin free deployment and coordinated rollback |
| `web/playwright.same-origin.config.ts`, `web/e2e/same-origin/session.spec.ts` | New isolated local real-API integration coverage, no live DB target |
| `web/playwright.config.ts` | Exclude the dedicated same-origin suite from the default suite so it cannot use the wrong server/fixtures |
| `web/scripts/check-deployment.ts` | New read-only live smoke check with no test-fixture imports or mutations |
| `web/tests/deployment-smoke.test.ts` | New deterministic smoke-check regressions using injected fetch responses |

`web/src/lib/api/client.ts` and `web/src/lib/auth-client.ts` already support website-relative browser requests. Preserve them unless tests demonstrate a necessary change. No mock route will be restored and no generated route tree change is expected because dispatch belongs in the server entry.

## Task 1: Establish access and diagnose the live readiness failure

**Scope:** Read-only investigation. No deployed env update, DB write, restart or deploy.

**Files:** Read `api/src/shared/db/health.ts`, `api/src/shared/db/app-role.ts`, `api/scripts/migrate.ts`, `api/drizzle/meta/_journal.json`, `api/Dockerfile`, `render.yaml`. Update only the progress trackers with redacted findings.

**Interfaces:** Consumes the known public URLs and owner-authenticated Render access. Produces a recorded diagnosis: deployed commit/image, origin variables, SMTP port, migration state and the exact minimal remedy for Task 2.

- [ ] Ask the owner to complete `render login` locally. Verify non-interactively with `render services --output json`. If access still fails, stop and explain; do not ask for a token in chat.
- [ ] Record exact service IDs, current commit/image and deployment settings privately. Inspect logs around homepage failures and readiness. Do not dump all env values; record only non-secret origins and whether secret keys exist.
- [ ] Recheck public status codes and JSON bodies for web `/en`, `/ar`, API `/api/health/ready`, `/api/v1/site`, `/api/v1/me`, `/api/v1/taxonomy`.
- [ ] Inspect the journal shipped in the actual API image and the DB migration metadata under the actual runtime role. Use read-only SQL:

```sql
select current_user, current_database();
select max(created_at) as latest from drizzle.__drizzle_migrations;
select has_schema_privilege(current_user, 'drizzle', 'USAGE');
select has_table_privilege(current_user, 'drizzle.__drizzle_migrations', 'SELECT');
```

  The local journal currently ends at migration `0023_listings_created_index`, timestamp `1793780098983`. Compare against the deployed journal, not only this local value. If free-plan access cannot inspect the image, reproduce that exact deployed commit in a local Podman image and compare available logs/DB metadata. Do not upgrade hosting for shell access.
- [ ] Classify the failure as pending migration, role permission, packaged journal, probe bug or still unknown. Confirm the web SSR origin from hosted settings/logs rather than assuming localhost from the symptom alone.
- [ ] Record Render's actual proxy/header behavior for direct API requests and website-forwarded requests if observable. No guessed `TRUSTED_PROXIES` range.

**Done when:** An evidence-backed diagnosis names the failure and a proposed remedy. SMTP remains unchanged. Missing access or an unknown cause means blocked, not done; record the blocker and stop.

**Stop and report. Ask permission for Task 2.**

## Task 2: Prove the smallest readiness repair without touching live data

**Scope:** Reproduce the Task 1 cause locally and prepare only its remedy. Do not apply live migrations or role grants in this task.

**Files:** `api/src/shared/http/health.test.ts`; conditionally `api/src/shared/db/health.ts`, `api/src/shared/db/app-role.ts`, `api/Dockerfile`. Use existing `api/scripts/migrate.ts`. Document the selected remedy in `api/RUNBOOK.md` and the trackers.

**Interfaces:** Consumes Task 1's actual failing condition. Preserves `migrationsCurrent(applied: number | null, shipped: number): boolean` and the public readiness response shape. Produces a tested repair or a verified existing-command remedy to execute in Task 6.

- [ ] Start only the local test DB and check readiness:

```bash
podman-compose -f api/docker-compose.yml up -d postgres-test
podman-compose -f api/docker-compose.yml exec postgres-test pg_isready -U sayaratak -d sayaratak
```

- [ ] Reproduce the actual failure on the local test/scratch DB or the exact deployed image. Existing comparison expectations remain:

```ts
expect(migrationsCurrent(99, 100)).toBe(false)
expect(migrationsCurrent(null, 100)).toBe(false)
expect(migrationsCurrent(100, 100)).toBe(true)
expect(migrationsCurrent(200, 100)).toBe(true)
```

- [ ] Select only the proven branch. Pending SQL: verify the existing migration runner on a local copy and list exact unapplied migrations. Permission failure: verify the required grants already defined by `ensureAppRole`, without granting DDL or superuser. Missing journal: repair packaging, not the DB. Probe bug: add the failing regression and repair that bug. If none is proved, stop blocked.
- [ ] Keep readiness truthful: failures stay 503; a newer expand-only DB remains acceptable; error detail is not leaked publicly. Do not hardcode `migrations=ok`.
- [ ] Run API typecheck/lint/check and the focused regression:

```bash
bun run --cwd api typecheck
bun run --cwd api lint
bun run --cwd api check
bun test --cwd api --timeout 120000 src/shared/http/health.test.ts
```

- [ ] List any live command Task 6 will need, its exact effect, backup requirement and rollback compatibility. If no code change is needed, say so; do not create a dummy change or migration.
- [ ] Update trackers, stop postgres-test and refresh graphify if source changed. Commit only passing code, if any, as `step 11.6-r2: repair verified readiness failure`.

**Done when:** The diagnosed cause is reproduced and its smallest repair passes locally. The live readiness result is deliberately not claimed fixed yet.

**Stop and report. Ask permission for Task 3.**

## Task 3: Forward supported API requests through the website

**Scope:** Local code and tests only. No hosted configuration change.

**Files:** Create `web/src/lib/server/api-proxy.ts`, `web/tests/api-proxy.test.ts`. Modify `web/src/server.ts`.

### Owner-approved R3 client-IP amendment

Approved after the Task 3 stop gate and design-only spike. This extends R3 locally; it does not
authorize Task 4 cookie work, any hosted env update, new dependency, push or deployment.

**Provider evidence:** Render's current article
https://render.com/articles/host-pocketbase-on-render says public ingress overwrites caller
`CF-Connecting-IP`. https://render.com/docs/web-services.md says the application port is not
directly Internet-reachable. Render outbound ranges are shared, so do not trust them as website
identity or choose a guessed TRUSTED_PROXIES range. Actual two-network/spoofing acceptance stays live-gated.

**Additional file responsibilities:**

| Path | Responsibility |
| --- | --- |
| `packages/shared/src/lib/proxy-client-ip.ts` | Server-consumed native-crypto IP assertion protocol, no env/global secrets |
| `web/src/lib/server/proxy-client-ip.ts` | Explicit Render-mode config, validated ingress IP and proxy request signing |
| `web/src/lib/api/forwarded-headers.ts` | Server-only SSR cookie/IP forwarding, never a signing RPC |
| `web/src/lib/api/client.ts` | Use the server-only SSR headers helper, preserve browser URL/body behavior |
| `web/tests/proxy-client-ip.test.ts`, `web/tests/forwarded-headers.test.ts` | Protocol/config/SSR regressions |
| `api/src/shared/http/client-ip.ts` | Resolve verified assertion or direct Render IP before existing limits/auth |
| `api/src/shared/http/client-ip.test.ts`, `api/src/env.test.ts`, `api/src/env.ts` | Provider policy, spoofing and configuration regressions |
| `api/src/modules/auth/auth.proxy-ip.test.ts` | Isolated local-only real Better-Auth/session-IP/SSR/native regression |
| `api/src/app.ts` | Pass explicit IP mode/key/public API origin to the existing middleware |
| `api/.env.example`, `web/.env.example`, `api/RUNBOOK.md` | Default socket policy and opt-in shared-secret configuration/safety |

**Configuration, default inactive:** `CLIENT_IP_MODE=socket` retains existing socket/TRUSTED_PROXIES
handling. `CLIENT_IP_MODE=render` requires `PROXY_CLIENT_IP_SECRET`, a dedicated >=32-character
server-only secret, on both services; it must not reuse BETTER_AUTH_SECRET or an admin secret.
The API additionally requires `API_PUBLIC_ORIGIN` as an HTTP(S) origin without credentials/path/query/fragment.
It binds assertion verification to the fixed upstream origin even when TLS terminates at Render.
Web uses the fixed validated upstream origin from API_BASE_URL. No secret uses a VITE_ key.

**Assertion:** HMAC-SHA256 over a canonical JSON tuple containing version, single validated IP,
integer millisecond timestamp, uppercase method, expected upstream origin and path plus query.
Private headers carry IP/time/signature; reject claimed assertions with invalid fields/signatures,
wrong origin/method/path/query, age over 180 seconds or time more than 30 seconds ahead.
Native constant-time comparison, bounded header lengths, no credential/body signing or buffering.
This asserts IP only, never authenticates a user or replaces cookies, bearer tokens, CSRF or role checks.

**Flow:** Browser -> Render-overwritten CF IP -> web server-only signer -> public API verifies
assertion -> existing clientIp -> existing rate limits and Better-Auth's overwritten x-sy-client-ip.
Web removes visitor-supplied forwarding, Cloudflare and private assertion headers before signing.
SSR direct API fetches use the same server-only signer and incoming cookie, with no browser-callable
function returning signatures. Direct/native API calls require no assertion/key: in Render mode
they use the validated platform CF IP. An invalid claimed assertion fails closed, not socket fallback.
Missing/malformed CF IP fails closed for Render-mode visitor API requests; platform health probes
remain callable without visitor headers. Default non-Render behavior remains unchanged.

- [x] R3a: Add the prescribed failing proxy GET regression, plus failing local protocol/provider/config/SSR regressions before source implementation.
- [x] R3b: Implement the shared protocol, explicit config and API integration; preserve existing socket tests and verify two signed IPs resolve distinctly. Test IPv4/IPv6, forged raw/internal headers, malformed/expired/future/wrong-key/misbound signatures and health probes.
- [x] R3c: Implement the proxy and server-only SSR integration with the forwarding/security requirements below. Browser tests must not import Node crypto/server secrets. Verify server entry dispatch and unchanged HTML CSP behavior.
- [x] R3d: Run shared and API static gates, focused API client-IP/env/auth regressions against postgres-test, web focused regressions/static gates, then build and inspect client output for server-secret/protocol leakage. Run heavy checks sequentially.
- [x] R3e: Record local evidence, stop test services, refresh graphify when available and commit only passing scoped changes. Missing graph tool/data is recorded rather than fabricated. Stop for Task 4 permission.

**Historical R3 regression blocker, resolved locally:** shared/API/web static checks and focused web tests passed;
build/size/client-output leak checks passed. An API rerun was 75/76: the existing mail-cap
test expects five deliveries after six reset requests but intermittently receives six. The same
failure reproduced on unchanged baseline 80b038f, run 9 of a bounded sequential baseline check.
The count and outbox insert are separate operations in unchanged mail infrastructure. Do not
weaken the cap or retry away that failure. Owner separately approved the atomic prerequisite below.
After repair, final affected API regression is 170/170, web 100/100 and ten bounded cap/auth
stress runs are 70/70. Test DB/temporary servers are stopped; graph updated. Full release suites,
live provider overwrite, browser HTTPS cookies and Render cutover remain Tasks 4-7, not claimed here.

**Owner-approved R3-mail prerequisite:** owner selected "Atomic fix (Recommended)" after the
baseline reproduction. Local-only changes to `api/src/shared/mail/send.ts`,
`api/src/shared/mail/outbox.queries.ts` and new `api/src/shared/mail/send.limits.test.ts` are
authorized. Use the existing transaction wrapper and a transaction-scoped advisory lock keyed
by recipient to make count plus outbox insertion atomic across connections/processes. Count
pending and sent reservations as before, keep five/hour and quiet over-cap behavior, and perform
delivery after transaction commit off-request. Do not change SMTP provider/settings, templates,
auth rules, route responses or schemas; no new migration/package or live work.

- [x] R3-mail red: queue 20 concurrent codes for one recipient and one for another; flush the fake inbox and assert five/one deliveries and reservations. Current code must fail before repair.
- [x] R3-mail green: serialize only per-recipient reservation in one DB transaction, never hold its lock through SMTP; verify concurrency, independent recipients, failed-send reservations and hourly expiry.
- [x] R3-mail gate: run mail/auth regressions and bounded repeat runs of the unchanged auth.limits suite, then rerun final R3 checks. Do not waive timing/security assertions. Include this approved prerequisite in the passing R3 step commit; stop for Task 4 permission.

**Concrete local assertions:**

```ts
import { signClientIp, verifyClientIp } from "@sayaratak/shared/lib/proxy-client-ip"
const target = "https://api.example.test/api/v1/site?locale=en"
const secret = "local-proxy-test-key-0123456789abcdef"
const now = 1_800_000_000_000
const headers = signClientIp(new Request(target), { ip: "192.0.2.1", secret, now })
expect(verifyClientIp(new Request(target, { headers }), {
  secret, origin: "https://api.example.test", now,
})).toBe("192.0.2.1")
```

Shared interfaces are `signClientIp(request, { ip, secret, now }): Headers`,
`verifyClientIp(request, { secret, origin, now }): string | null` and
`readRenderIp(headers: Headers): string | null`. New tests construct in-process Hono requests
with explicitly injected provider policy/fake keys, never contact Render. Changed
method/path/query/origin must fail verification. Existing socket-policy assertions stay intact.

**Interfaces:** Export these types and helper from the new server-only module:

```ts
export type ApiProxyOptions = {
  apiBaseUrl: string
  fetchImpl?: typeof fetch
  clientIp?: { mode: "socket" } | { mode: "render"; secret: string }
}

export declare function forwardApiRequest(
  request: Request,
  options: ApiProxyOptions
): Promise<Response | null>
```

`null` means TanStack should handle the request. Only paths starting `/api/v1/` are forwarded. The upstream is the validated configured origin, never a URL provided by the visitor.

- [x] Write and run a failing GET regression before implementation:

```ts
import { expect, it, vi } from "vitest"
import { forwardApiRequest } from "@/lib/server/api-proxy"

it("forwards site requests to the fixed API origin", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({ locales: ["ar", "en"] })
  )
  const response = await forwardApiRequest(
    new Request("https://sayaratak-web.onrender.com/api/v1/site?locale=en"),
    { apiBaseUrl: "https://sayaratak-api-91a8.onrender.com", fetchImpl }
  )
  expect(response?.status).toBe(200)
  const [input, init] = fetchImpl.mock.calls[0]!
  const sent = new Request(input, init)
  expect(sent.url).toBe(
    "https://sayaratak-api-91a8.onrender.com/api/v1/site?locale=en"
  )
})
```

  Run with `bun run --cwd web test --maxWorkers=2 tests/api-proxy.test.ts`.
- [x] Implement fixed-origin forwarding and dispatch it before `handler.fetch()` in `web/src/server.ts`. Keep normal HTML nonce/CSP handling unchanged. `/api/_test/*`, `/mock/*`, `/en` and lookalike `/api/v10/*` must not reach the upstream through this helper.
- [x] Preserve method, query, body bytes, multipart boundaries, cookies, bearer authorization, Origin, idempotency and platform/version headers. Do not log credentials, private bodies or cookie values.
- [x] Strip hop-by-hop headers, including headers named by `Connection`, and the incoming `Host`. Do not blindly trust or manufacture visitor-controlled forwarding/IP headers. Keep the verified client-IP rule from Task 1; if a safe trusted chain cannot be proved, stop for a scoped decision instead of silently weakening throttling.
- [x] Use `redirect: "manual"`. Preserve external OAuth `Location` and each separate `Set-Cookie`, including cookie expiry on logout. Never combine cookies with comma splitting. Forward streamed private-file responses without turning them into JSON.
- [x] Abort the upstream fetch if the client disconnects. Use a bounded 120-second upstream timeout to allow a free-tier cold start, return no-store JSON `{ "code": "network", "message": "network" }` with 502 on connection failure or 504 on timeout, and never retry POST/PATCH/DELETE automatically. Ensure decompression does not leave stale content-encoding/content-length headers.
- [x] Add regressions for JSON POST, multipart bytes, multiple cookies, logout deletion, 302/manual redirect, 401/403/422/429 preservation, binary response, disallowed paths, forged forwarding metadata, timeout and unavailable upstream. The fetch stub makes failures deterministic without contacting Render.
- [x] Run focused tests, web typecheck/lint/check, update trackers, refresh graphify and commit passing changes as `step 11.6-r3: forward browser API requests`.

**Done when:** Supported requests are forwarded byte-correctly and safely, normal pages still use TanStack, and all focused tests/static gates pass. No mock handler is introduced.

**Stop and report. Ask permission for Task 4.**

## Task 4: Align secure sessions and deployment configuration

**Owner-approved startup amendment (2026-11-12):** The built Nitro server lazy-loads
`web/src/server.ts`, so its module-level validation alone cannot fail before listening.
Owner selected "Add startup hook (Recommended)". Add
`web/src/lib/server/deployment-startup.ts`, register the synchronous production-only Nitro
plugin in `web/vite.config.ts`, and cover it in `web/tests/deployment-startup.test.ts`.
Reuse `readDeploymentConfig`; bake only the public browser base into the server plugin,
validate runtime plus baked origins before serving, and prove missing/stale settings fail
with actual built startup. No new dependency, package start-command change or hosted action.

**Scope:** Local auth/configuration changes and exact deployment instructions. Do not apply them on Render yet.

**Files:** Create `web/src/lib/server/deployment-config.ts`, `web/tests/deployment-config.test.ts`; modify `web/src/server.ts`, `api/src/modules/auth/auth.config.ts`, relevant auth tests, `render.yaml`, env examples, `web/docs/SWAP_TO_REAL_API.md`, `api/RUNBOOK.md`. If a pure policy helper is needed, create `auth.cookie-options.ts` and `auth.cookie-options.test.ts` beside auth.config.

**Interfaces:** The web helper exports:

```ts
export type DeploymentConfig = { apiBaseUrl: string; appOrigin: string }
export declare function readDeploymentConfig(
  source: Record<string, string | undefined>
): DeploymentConfig
```

It validates HTTP(S) origins without credentials, query, fragment or API path. Production server mode requires explicit origins; local development can retain localhost defaults. `apiBaseUrl` and `appOrigin` must differ, preventing proxy recursion. The browser build's `VITE_API_BASE_URL` must be blank/relative or match `APP_ORIGIN` for this mode, never the separate upstream. Build-time values and runtime values must agree.

- [x] Add failing config tests for missing deployed upstream, origin containing `/api/v1`, same upstream/website origin, wrong browser origin and valid exact Render origins. Verify a production build/start fails with a useful variable name instead of quietly targeting localhost. Local Vitest isolation remains intact.
- [x] Add a failing HTTPS cookie-policy test with `APP_ENV=development`. Apply the minimal policy using `isProduction || new URL(env.BETTER_AUTH_URL).protocol === "https:"` for secure cookies. Keep local HTTP tests working; keep SameSite=Lax and HttpOnly. Blank COOKIE_DOMAIN must mean host-only, not an inferred shared Render domain.
- [x] Verify actual auth responses, not just the policy expression: secure prefix/attributes on HTTPS, no Domain attribute, all logout deletions use matching cookie names/path. Keep existing shared custom-domain behavior when explicitly configured.
- [x] Validate web incoming cookie forwarding during SSR. Confirm `GET /me` and a reload see the same user. Verify private upload URLs already derived from `BETTER_AUTH_URL` point to the website and retain owner/admin authorization. Do not rewrite arbitrary JSON payloads or Cloudinary delivery URLs.
- [x] Document these exact target values. No `/en` or `/api/v1` suffix belongs in an origin:

  R3 amendment also requires `CLIENT_IP_MODE=render` on both services, the same privately generated
  `PROXY_CLIENT_IP_SECRET` on both, and API `API_PUBLIC_ORIGIN=https://sayaratak-api-91a8.onrender.com`.
  Preserve default socket mode locally. Do not deploy these settings in Task 3/4 or log the key.

| Service | Variable | Target |
| --- | --- | --- |
| Web | `API_BASE_URL` | `https://sayaratak-api-91a8.onrender.com` |
| Web | `VITE_API_BASE_URL` | `https://sayaratak-web.onrender.com` |
| Web | `APP_ORIGIN` | `https://sayaratak-web.onrender.com` |
| Web | `IMAGE_ORIGINS` | `https://res.cloudinary.com` |
| Web | `VITE_DEMO` | `false` |
| Web | `VITE_FEATURE_OTP` | `false` |
| Web | `VITE_FEATURE_FACEBOOK` | `false` |
| API | `WEB_ORIGIN` | `https://sayaratak-web.onrender.com` |
| API | `BETTER_AUTH_URL` | `https://sayaratak-web.onrender.com` |
| API | `COOKIE_DOMAIN` | blank / absent |
| API | `APP_ENV` | `development`, preserving the existing free test-deployment decision |
| API | `SMTP_PORT` | `2525`, preserve current verified provider values |

  Keep `BETTER_AUTH_SECRET` unchanged. Preserve all SMTP/provider/DB/storage secrets. Do not invent SMTP_SECURE: inspect and retain the provider's working setting. Keep service plan values free. Health monitoring still targets the direct API `/api/health/ready`.
- [x] Document the Google callback change to `https://sayaratak-web.onrender.com/api/v1/auth/callback/google`, with website origin `https://sayaratak-web.onrender.com`. Record old callback entries for rollback; do not change Google Console yet. Native ID-token/bearer endpoints remain direct API calls. **Named deferral approved by owner:** actual old Console entries are not inspected in Task 4; Task 6 must record them privately before any edit.
- [x] Run API/web static gates and focused `auth-client`, `lib-helpers`, deployment-config, proxy, auth session/origin and private-upload tests. Use postgres-test for API tests. Update docs/trackers/graph and commit passing changes as `step 11.6-r4: align secure same-origin deployment`.

**Local evidence (2026-11-12):** Six API/web static gates pass. Affected API tests pass 149/149
across 22 files, plus OpenAPI/lint invariants 4/4 across two files; OpenAPI regeneration has zero
diff. Focused web tests pass 118/118 across eight files. Exact Render-origin production build,
size budgets and 462-client-JS server/config/key leak scan pass. Real built start rejects missing
upstream, missing website and stale baked browser origin before listening; build rejects either
missing server origin before bundling. Built web plus real loopback API proves same SSR `/me`
identity through reload/locale and revoked identity after proxied logout. Cookie responses and
private owner/admin/other access pass HTTPS-development, local HTTP and custom-domain cases.
These are response/manual-header proofs, not Task 5 browser/trusted-TLS acceptance. Test services
stopped; graph refreshed. Full local suites and actual Render/email/Google/IP proof remain gated.

**Done when:** Tests prove HTTPS host-only cookies, SSR identity, strict origins and valid deployment configuration. Exact Render values and the Google callback are documented. No hosted setting or email provider is changed.

**Stop and report. Ask permission for Task 5.**

## Task 5: Prove the complete repair locally

**Scope:** Production-build web plus real local API/test DB. Never point reset-capable tests at Render.

**Files:** Create `web/playwright.same-origin.config.ts` and `web/e2e/same-origin/session.spec.ts`; exclude this directory from the default `web/playwright.config.ts` suite. Create `web/scripts/check-deployment.ts` and `web/tests/deployment-smoke.test.ts` for read-only GET smoke checks. Reuse existing auth fixtures only when the config enforces localhost/test DB, and never for the deployed smoke script.

**Interfaces:** The smoke script accepts the website and API origins as two positional arguments, performs GETs only, validates site/taxonomy/me JSON, checks both homepages and direct API readiness, prints only route/status/check names and exits nonzero on failure. It must not import mocks, seed/reset helpers or OTP retrieval. Export a testable `checkDeployment(webOrigin: string, apiOrigin: string, fetchImpl?: typeof fetch): Promise<boolean>`; the CLI calls it and exits 0 only for true. Importing the module does not run the CLI.

- [ ] Add failing smoke regressions using the injected fetch function: an HTML 404 from `/api/v1/site` fails; 200 JSON signed-out `/me` passes; 503 readiness fails. Assert every issued request is GET. No live mutation is needed to prove these checks.
- [ ] Run browser integration with the built website on `http://localhost:3103` and a different-site upstream on `http://127.0.0.1:4000`. API `WEB_ORIGIN` and public `BETTER_AUTH_URL` point to the website, COOKIE_DOMAIN is blank, browser API URL is the website, server API URL is the upstream, and the DB is the local postgres-test on 5434. Disable third-party cookies in the browser proof. Do not rely only on two localhost ports to prove the cross-site issue is gone.
  Include isolated provider-mode requests with injected CF headers/test keys proving SSR/proxy
  signing, two distinct visitor-IP buckets and direct-native behavior; do not mistake injected
  local provider headers for live Render overwrite proof.
- [ ] Cover `/ar` and `/en`, signup, test-inbox verification on local test mode only, login, reload, locale switch, gated action, logout and expired-session behavior. Assert browser API traffic stays on the website origin. Cover multipart upload and one private-file owner-versus-other-user check locally.
- [ ] Repeat the cookie acceptance proof under local HTTPS with a trusted local test certificate: HttpOnly, Secure, Lax, host-only, matching logout expiry. If a trusted HTTPS setup is unavailable, record that gate as blocked rather than claiming HTTP proved Secure-cookie behavior.
- [ ] Check redirects use the public website auth path. Use a controlled local OAuth response for deterministic state/cookie/redirect tests; real Google approval remains Task 6/7.
- [ ] Run checks sequentially: frozen install/audit with the repository's current ignore list, shared lint/check, API typecheck/lint/check, full API suite with 120000 ms timeout, web typecheck/lint/check/i18n checks, full web Vitest with two workers, build/size, then the dedicated same-origin Playwright config. Regenerate OpenAPI only if API v1 route contracts changed; expect no contract change from transparent forwarding.

```bash
bun run --cwd web test --maxWorkers=2
bun run --cwd web build
bun run --cwd web size
bun run --cwd web test:e2e --config playwright.same-origin.config.ts --workers=1
```

  The dedicated config must reject any non-local DB URL before importing reset helpers. Existing full journey/state suites are local-only; run affected journeys, and do not waive a failing required gate without owner agreement.
- [ ] Update trackers, stop temporary services/browser/postgres-test, refresh graphify and commit passing changes as `step 11.6-r5: verify same-origin deployment locally`.

**Done when:** The local production-build repair passes its test matrix and applicable regression gates. Report exact results, not "should work." The smoke script is ready for Task 6.

**Stop and report. Ask permission for Task 6.**

## Task 6: Apply the verified repair on Render

**Scope:** This is the first task that may change hosted settings or deploy code. Its approval must cover the exact staged env diff, deployment commits, Google redirect update and any diagnosed migration/grant command. If any of those remain unclear, ask before applying them.

**Files:** Approved code/config from Tasks 2 through 5; deployment and rollback notes in `api/RUNBOOK.md`; both progress trackers. No new unrelated feature.

**Interfaces:** Consumes passing local gates and Task 1's service IDs/current configuration. Produces recorded deployed commit IDs, a redacted env diff, backup reference if DB work was needed and successful public smoke results.

- [ ] Show the owner the exact non-secret env changes, affected services, expected brief disruption, migration/grant effects and rollback sequence. Reauthenticate Render if needed. Do not replace entire env sets or rotate the auth secret.
- [ ] Record previous build commits/configuration privately. Check auto-deploy behavior before pushing; a push is not harmless if it immediately deploys both services. Use explicit deployment control for the coordinated cutover.
- [ ] If DB writes are necessary, first take and verify an encrypted off-service PostgreSQL 18 backup using the existing runbook. Free Render has no built-in backup guarantee. Test the backup on a scratch DB before an approved schema-changing command. Do not use application backup machinery blindly if its tables are part of the diagnosed failure.
- [ ] Run only the reviewed readiness remedy: existing `db:migrate` for confirmed pending migrations, existing role-grant setup for confirmed missing grants, or a code/image deployment for a probe/packaging defect. Use a local terminal and the external DB URL kept privately; do not assume free Render supports shell/pre-deploy commands. No migration on normal API startup.
- [ ] Preserve provider/SMTP values and free plans. Apply the Task 4 origin table and approved Google Console callback entry. Deploy the coordinated API and website builds, rebuilding web after VITE settings. Check each service reaches its intended commit, not a cached earlier artifact.
- [ ] Run the read-only smoke script:

```bash
bun run --cwd web scripts/check-deployment.ts https://sayaratak-web.onrender.com https://sayaratak-api-91a8.onrender.com
```

- [ ] Confirm web `/ar` and `/en` 200, web `/api/v1/site` and `/api/v1/taxonomy` valid 200 JSON, signed-out web `/api/v1/me` 200/null, direct API readiness 200 with all configured checks ok. Never change Render health to `/live` just to conceal readiness failure.
  Before cutover acceptance, correlate ordinary and forged-header GETs from two owner-approved
  networks: direct API and website-proxied requests must resolve to each network's observed
  platform IP, not ::1, the website egress or visitor-supplied values. Verify invalid assertion
  rejection and no secrets in responses/logs. No public diagnostic/echo route may be introduced.
- [ ] If cutover fails, stop and report. Roll back code and coupled origin/env values together to the recorded state; do not restore/drop data automatically. Schema rollback is allowed only through the separately reviewed runbook process, not this task's normal rollback.
- [ ] Record redacted deployment evidence, affected commits and remaining live-auth tests. Do not declare signup fixed before Task 7.

**Done when:** The actual deployed website and API pass non-mutating smoke checks with the new configuration. Any necessary DB change has its approved safety evidence. Local passing tests alone do not satisfy this task.

**Stop and report. Ask permission for Task 7.**

## Task 7: Verify the real signup/login journey with the owner

**Scope:** One owner-approved ordinary test account and mailbox. No bulk account creation, test reset endpoint or seeded demo credentials on Render. Additional mail tests must stay within existing rate limits.

**Files:** Evidence and final status in the progress trackers and `api/RUNBOOK.md` repair notes. Change code only after reporting any newly found defect and obtaining scoped permission.

**Interfaces:** Consumes the new live deployment and a mailbox/account selected by the owner. Produces the acceptance table below with pass/fail/blocked, time, locale and browser evidence. The owner can type passwords and OTPs directly; neither needs to appear in chat or screenshots.

- [ ] Ask which mailbox/test account may be used. Confirm the test-account creation and whether any onboarding/profile write is permitted. Do not assume credentials in a local fixture are authorized for the live site.
- [ ] Walk the actual browser flow, not only HTTP fetches:

| Check | Required result |
| --- | --- |
| Open `/en` and `/ar` | No crash screen, correct direction, no unexpected API 404/500 |
| Sign up | Real account created through website `/api/v1/auth/*` |
| Email verification | Managed service delivers the real message; owner enters working code |
| Sign in | Normal account session established; no admin/role bypass |
| Reload and switch language | Same signed-in account remains present |
| API traffic/cookies | Browser uses website origin; secure host-only HttpOnly cookie |
| Sign out then reload | Session is gone; protected page asks for login |
| Wrong password/code | Useful error, no false sign-in and no unexpected crash |
| Google, if enabled | Returns through website callback and establishes the same session |
| Private access | Local owner/admin authorization regression already passed; do not access a real user's documents |
| Visit after at least 15 minutes of genuine inactivity | Free-tier wake-up recovers; record actual delay or failure |

- [ ] Test at phone and desktop widths in Arabic and English. Observe console/Network; redact cookies, OTPs, private data and emails from saved evidence.
- [ ] If owner-approved account cleanup is requested, use the normal confirmed removal flow. Never delete the account automatically as test teardown.
- [ ] Record limitations: free services still sleep, share the free-hour allowance, and free Postgres expires after 30 days. A provider/cloud gate not exercised remains blocked or explicitly deferred, never silently passed.
- [ ] Mark this repair complete only when its required checks passed or the owner explicitly accepted a named deferral. Keep unrelated `11.6` launch/security/cloud tasks and web `14.13` gates open.

**Done when:** Actual email delivery, verification, persistent login and logout work on the hosted app, with evidence and any owner-approved deferrals listed.

**Stop and provide the final repair summary. Do not start another feature or release task.**

## Task completion report template

```text
Task N: complete / blocked
Outcome: what now works, in plain language
Changed: exact files or hosted settings, no secrets
Verified: exact commands/browser checks and results
Live impact: none, or the approved deployment/DB/account actions
Still open: named checks or blockers
Next: Task N+1, waiting for your permission
```

## Plan review

- Routing, cookies, SSR, private uploads, OAuth, config, migration diagnosis, real email delivery and rollback each have an owning task.
- No implementation or deployment was performed while writing the plan.
- All future tasks require separate permission and stop points.
- The email-provider replacement is excluded. Paid hosting, buying a domain, DB resets and public test hooks are excluded.
- Any diagnosis-dependent action must be narrowed with evidence before editing or running it; this plan does not authorize guessing a DB repair.
