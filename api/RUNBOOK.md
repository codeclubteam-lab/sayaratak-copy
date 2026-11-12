# Sayaratak API runbook

Operations for the person who runs the API. Setup for development is in `README.md`. Every
command runs in `api/`. In production run them from a Render Shell, or from a laptop with the
database's external URL in the environment.

Two database users exist in production (see `README.md`, "Production image"):
`MIGRATE_DATABASE_URL` is the owner and is used by `db:migrate` and `db:restore` only;
`DATABASE_URL` is the limited `sayaratak_app` user the API runs as.

## 1. First deploy

Do these once, in order. The owner tasks (accounts, DNS) come from the 11.6 checklist.

1. **Render services.** Create them from the root `render.yaml`, then apply its "Production"
   comment block: paid plans on the API, web and database, `preDeployCommand: bun run db:migrate`,
   `MIGRATE_DATABASE_URL` from the database, `DATABASE_URL` by hand as
   `postgres://sayaratak_app:<password>@<internal host>/sayaratak`, and `APP_ENV=production` with
   the required service keys (`COOKIE_DOMAIN`, `GOOGLE_*`, `CLOUDINARY_URL`, `SMTP_*`, `MAIL_FROM`,
   `R2_*`, `FCM_SERVICE_ACCOUNT`) filled in the dashboard (`sync: false`; production refuses to
   start if one is blank). `FACEBOOK_*` (2 keys) and `APPLE_*` (5 keys) remain optional as
   all-or-none groups until configured.
2. **Migrate.** The pre-deploy command does it on each deploy. For the very first run you can do it
   by hand: `bun run db:migrate`. It creates `sayaratak_app` with the password in `DATABASE_URL`.
3. **Reference data.** `bun run db:bootstrap` writes taxonomy, plans, promotion prices, ad pages,
   site pages and settings. Safe to run again: it never overwrites what an admin edited. Never run
   `db:seed` in production (it refuses when `APP_ENV=production`).
4. **The admin.** `bun run create-admin <email>` asks for the name and the password (typed twice,
   not echoed) and turns on two-factor (an email code after the password). The platform has one
   admin; the command refuses a second. To change or remove that account later use the platform
   endpoint (`ADMIN_SECRET_KEY` and `ADMIN_RECOVERY_EMAIL` must both be set, otherwise it is off).
5. **Cloudinary.** In the console turn **Strict transformations** on. The only derivatives are the
   four eager widths (320, 640, 960, 1280). Check: each width loads, and `w_500` answers 404.
6. **R2.** The backup bucket is private, with a lifecycle rule that deletes objects after 30 days.
   Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Take one backup
   (section 3) and check the object appears.
7. **DNS and mail.** Hostnames for api and web, `COOKIE_DOMAIN` set to their shared parent so the
   session cookie reaches server rendering, `BETTER_AUTH_URL` and `WEB_ORIGIN` set to the public
   addresses. On the mail domain publish SPF, DKIM and DMARC. Set `TRUSTED_PROXIES` after the
   two-network check (`README.md`, 10.5 notes).
8. **Check.** `GET /api/health/ready` answers 200 with `database`, `migrations`, `smtp` and `jobs`
   all `ok`.

## 2. Each release

1. **Back up.** `bun run db:backup` (prints the id). Do this before any release that has a
   migration.
2. **Migrate and start.** Render runs `bun run db:migrate` as the pre-deploy command, then starts
   the new image. Migrations take an advisory lock, so two deploys never migrate at once.
3. **Check.** Open `/api/health/ready`; it must be 200. Then call one normal route, for example
   `GET /api/v1/listings`.
4. **Roll back.** Redeploy the previous image from Render. This is safe only when the migration was
   expand-only (added a column, table or index; removed or renamed nothing). `/ready` accepts a
   database that is newer than the image, so the old image goes ready on the new schema. If the
   migration removed or changed something the old code reads, restore (section 3) instead.

Write migrations as expand then contract: release one adds the new shape, a later release removes
the old one. A migration that locks a big table (an index, a column rewrite) is tried first on a
copy of production data. `scripts/scale-seed.ts` builds a 50,000-listing database for that.

### Free Render readiness repair, 2026-11-12

This is the Task 2 remedy from `docs/superpowers/plans/2026-11-12-render-deployment-repair.md`.
It is locally verified, not applied live. Only separately approved Task 6 may run it against Render.
The paid-production setup above does not describe the current free test deployment.

**Diagnosis.** The deployed API commit `0b65e0a` ships 24 migrations through
`0023_listings_created_index` at `1793780098983`. Task 1 found 23 applied migrations through
`0022_prune_support` at `1793672535855`, with schema USAGE and migration-table SELECT granted.
The `listings_created` index was absent. The pending migration contains only:

```sql
CREATE INDEX "listings_created" ON "listings" USING btree ("created_at" desc,"id");
```

Use the existing runner, not a new migration, manual journal insert, readiness bypass or role grant.
It takes the existing advisory lock, applies the pending SQL and records its hash/timestamp in
`drizzle.__drizzle_migrations`. With `MIGRATE_DATABASE_URL` absent, it does not run `ensureAppRole`.
This deployment currently uses the Render owner as its API role; the restricted-role launch gate
remains open and is not part of this repair.

**Before any live command.** Recheck the deployed commit, full shipped journal and live metadata.
This remedy is scoped to exactly one pending migration, 0023. Stop for review if another migration
is pending, the index already exists, the configured roles changed or metadata cannot be read.
Inspect identity, migration count/latest timestamp, privileges and `to_regclass('public.listings_created')`
with read-only SQL. Do not assume the observations from Task 1 are still current.

Take and verify a PostgreSQL 18 backup, encrypted and stored off-service, before the schema change.
Restore that backup into an isolated local scratch database and verify schema, row counts and journal
metadata before rehearsing this migration on it. Task 2's schema-only reproduction is not a live-data
backup or a production-sized locking test. The exact encryption/storage workflow and backup reference
must be reviewed in Task 6; an unverified application/R2 backup alone does not satisfy this gate.

This is ordinary `CREATE INDEX`, not `CREATE INDEX CONCURRENTLY`: it blocks writes to `listings`
while building. Review the restored-copy rehearsal and approve a maintenance window before running
it live. The migration transaction and advisory lock do not eliminate that write-blocking risk.

**Reviewed migration command, Task 6 only.** From `api/`, load the reviewed external owner
`DATABASE_URL` with TLS required and the existing auth secret into a protected terminal environment.
Never paste secrets into commands, chat or logs, and never source/copy the local `.env` over hosted
configuration. Confirm the target host/database privately against the recorded service inventory.
Run the same CLI file registered as `bun run db:migrate`, explicitly disabling dotenv loading:

```bash
(
  set +x
  : "${DATABASE_URL:?Load the reviewed external owner URL privately}"
  : "${BETTER_AUTH_SECRET:?Load the existing auth secret privately}"
  : "${WEB_ORIGIN:?Load the reviewed website origin}"
  : "${BETTER_AUTH_URL:?Load the reviewed public auth origin}"
  export DATABASE_URL BETTER_AUTH_SECRET WEB_ORIGIN BETTER_AUTH_URL
  export NODE_ENV=production APP_ENV=development
  unset MIGRATE_DATABASE_URL
  bun --no-env-file scripts/migrate.ts
)
```

These exports affect only the migration subprocess, not Render settings or the deployed auth secret.
The explicit development mode preserves the approved free-test-deployment decision without weakening
`prodSchema`. If using a laptop, run this from the reviewed repair checkout; free Render has no shell
or pre-deploy command. Do not seed/bootstrap/reset the live DB or migrate on application startup.

**Verify and roll back.** Require 24 migration rows/latest `1793780098983`, a valid `listings_created`
index on `(created_at DESC, id)`, and direct API `/api/health/ready` 200 with all configured checks ok.
If anything differs, stop and report; do not force a success response or run a destructive retry.
The change is expand-only: older compatible images can keep the added index, and readiness accepts
a database newer than the image. Roll back coordinated code/config if needed, leaving this index and
journal intact. Do not drop the index, delete journal rows or restore over live data as routine rollback.

**Local Task 2 proof.** A fresh local Postgres 18 scratch schema at 0022 returned real readiness 503.
The existing migration CLI applied 0023 and readiness became 200; a second run left count/latest
timestamp/index/readiness unchanged. SMTP was off locally. This does not prove live email delivery,
live load/lock duration, browser sessions or a successful Render cutover.

## 3. Backups and restore

**What exists.** `auto-backup` runs daily at 02:00 Khartoum (or Fridays only, if the admin chose
weekly) and keeps the newest 14 automatic backups. Manual backups (admin button, `db:backup`, and
the safety copy a restore takes) are never deleted by the job; the R2 lifecycle rule removes any
object after 30 days, so a row older than that has no file and cannot be restored. Each backup is a `pg_dump --format=custom` file in the private bucket under
`backups/<id>.dump`, and a row in the `backups` table.

**Take one.** `bun run db:backup`, or the admin screen.

**Restore** replaces the whole database. The API refuses to do it over HTTP (403), so it is a
terminal command only.

1. Stop the API service (suspend it in Render). The command refuses while an API process is up;
   `--force` skips that check, and you should not need it.
2. `bun run db:restore <backup id>`. It asks you to type `RESTORE`. It downloads the file, takes a
   safety backup of the present state, runs `pg_restore --clean --if-exists --single-transaction`,
   puts the `backups` history back (every row survives, the safety copy included) and re-grants
   `sayaratak_app`. It prints the safety backup id.
3. Run `bun run db:migrate`. The backup may be older than the code; migrations bring it forward.
4. Resume the API and check `/api/health/ready`.
5. To undo the restore, restore the safety backup it printed.

The target is the database `MIGRATE_DATABASE_URL` points to (or `DATABASE_URL` in development).
The command reads the backup row from that same database, so it restores a database into itself;
it is not the tool for a scratch copy.

### Restore drill (monthly)

A backup nobody has restored is a hope. Once a month restore the newest backup into a scratch
database and look at it. This does not touch production.

1. Pick the newest `ready` backup id (admin screen, or `select id, created_at from backups where
   status = 'ready' and object_key like 'backups/%' order by created_at desc limit 1`).
2. Download it with the app's own R2 client, from `api/`:
   `bun -e 'import { backupFiles } from "~/shared/storage/r2"; await backupFiles.download("backups/<id>.dump", "/tmp/<id>.dump")'`
3. Make a scratch database, for example `createdb sayaratak_drill` (on Render: a second database
   or a local Postgres 18; never the production database).
4. `pg_restore --clean --if-exists --single-transaction --no-owner --no-privileges --dbname
   <scratch url> /tmp/<id>.dump`. It must exit 0. The client must be Postgres 18.
5. Compare with production: table count (`information_schema.tables`, schema `public`), row counts
   of `listings` and `user`, `max(created_at)` in `drizzle.__drizzle_migrations`. The scratch
   numbers should be what production had when the backup ran.
6. Point a throwaway API at it (`DATABASE_URL=<scratch url> PORT=4010 bun src/index.ts`), run
   `bun run db:migrate` against it first if the backup is behind, and check `/api/health/ready`
   and `GET /api/v1/listings`. Stop it, drop the scratch database, delete the dump file.
7. Write the date and result below.

| Date | Backup | Where | Result |
| --- | --- | --- | --- |
| 2026-11-04 | `bk-gy4bhm7s` (auto, 2026-11-03, 443,922 bytes, from the owner's R2 bucket) | scratch database on the development Postgres 18 | `pg_restore` exit 0; 59 tables, 320 listings, 107 users, 7 backup rows, 23 migrations, all equal to the source. After `db:migrate` (24 migrations, the backup predates 0023) a throwaway API answered `/ready` 200 and `GET /api/v1/listings` 200. |

The first drill ran on a laptop against the development database, not a production one. Repeat it
against a real production backup before launch (11.6).

## 4. Secrets

| Secret | Rotate how | Effect |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Set a new value (`openssl rand -base64 32`), redeploy | Signs every user out (sessions and signed cookies stop verifying). Do it off-peak. |
| `ADMIN_SECRET_KEY` | New value, redeploy | Old key stops working on the platform endpoint. |
| `DATABASE_URL` password | Change it in the dashboard, redeploy | The pre-deploy `db:migrate` sets `sayaratak_app`'s password to match. |
| Owner database password | Rotate in Render, update `MIGRATE_DATABASE_URL` | Only `db:migrate` and `db:restore` use it. |
| `SMTP_*`, `CLOUDINARY_URL`, `R2_*`, `GOOGLE_*`, `FACEBOOK_*`, `FCM_SERVICE_ACCOUNT`, `APPLE_*` | Create the new key at the provider, set it, redeploy, revoke the old one | None for users. Mail queued meanwhile waits in the outbox and retries. |

Secrets live only in the Render dashboard (`sync: false`). Never paste them in chat, a ticket or git.

## 5. Scheduled jobs

Jobs run inside the API process (`Bun.cron`, Africa/Khartoum time). Each pass takes an advisory
lock, so several instances never do the same work twice, and every job is safe to run again.

| Job | When | What it does |
| --- | --- | --- |
| `outbox` | every minute | Sends queued emails and pushes with retries; clears expired codes; removes device tokens FCM reports dead. |
| `broadcast-fanout` | every minute | Turns an admin broadcast into one notification per recipient. |
| `listing-expiry` | every 15 min | Sends the "listing expired" notice once. |
| `promotion-end` | every 5 min | Ends promotions whose end time passed. |
| `subscription-end` | hourly | Expires ended subscriptions; a free plan renews itself. |
| `subscription-expiring` | daily 09:00 | Notifies 3 days before a subscription ends, once. |
| `ban-lift` | every 5 min | Lifts bans that have expired. |
| `unverified-cleanup` | hourly (minute 10) | Deletes sign-ups never verified within 24 h. |
| `orphan-uploads` | hourly (minute 20) | Deletes unattached uploads older than 24 h from Cloudinary and the table. |
| `auto-backup` | daily 02:00 | Nightly backup per the admin's schedule, then keeps the newest 14 automatic ones. |
| `prune` | daily 03:00 | Deletes expired sessions and codes, old rate-limit, outbox and idempotency rows, stale devices. |

**Run one by hand:** `bun run job <name>` (for example `bun run job outbox`). It exits 0 when the
pass finished, 1 when it failed or another process holds that job's lock. With no name or an
unknown name it prints the known jobs and exits 1.

**When one fails.** `/api/health/ready` shows `jobs` failing after three failed passes in a row,
with the job names in `failingJobs`. Find the `job_failed` log line for the job, fix the cause and
run it once by hand. A clean pass clears the flag.

## 6. Logs and health

- **Logs** go to stdout as one JSON line each: Render dashboard, Logs tab. Fields: `time`, `level`,
  `msg`, then context. Passwords, codes, cookies and tokens are redacted and emails are masked
  (`a***@mail.sd`). `LOG_LEVEL` is `debug`, `info` (default), `warn` or `error`.
- **Lines to know:** `request` (method, route, status, ms, user id, ip; set `LOG_REQUESTS=false` to
  silence), `job_done` and `job_failed` (with `job`), `jobs_started` (at boot), `shutdown_started`
  and `shutdown_done` (a deploy or a stop).
- **Health checks** are debug lines. To see them set `LOG_LEVEL=debug`, or call a normal route.
- **`/api/health/live`:** the process is up. Render's health check uses it.
- **`/api/health/ready`:** database, migrations, SMTP, jobs. 200 or 503. Point the uptime monitor
  here. A 503 names the failing check. `migrations` fails when the database is behind the image
  (run `db:migrate`); a database ahead of the image is fine.
- **Slow search:** the scale numbers and the cases that cost the most are in `plan/progress.md`,
  step 10.6. `scripts/scale-explain.ts` reruns them against a `_scale` database.

### Client IP behind the website proxy

The default `CLIENT_IP_MODE=socket` preserves the existing socket/`TRUSTED_PROXIES` policy.
Do not trust a browser's forwarding headers or allowlist Render's regional outbound ranges:
those ranges are shared with unrelated services.

For the approved same-origin Render repair, opt in with `CLIENT_IP_MODE=render` on both services.
Set the same dedicated `PROXY_CLIENT_IP_SECRET` on both, at least 32 characters, stored only in
server environments. Never reuse the auth/admin secret or put it in a `VITE_` variable. On the API
also set `API_PUBLIC_ORIGIN=https://sayaratak-api-91a8.onrender.com`, without an API path.
These are future Task 4/6 configuration steps, not changes already made to hosted settings.

[Render documents](https://render.com/articles/host-pocketbase-on-render) that its public ingress
overwrites `CF-Connecting-IP`. Only explicit Render mode reads that validated single-IP header.
The website strips caller-supplied forwarding/internal headers and signs IP, timestamp, method,
upstream origin and path/query. The API verifies the HMAC before setting the existing `clientIp`
used by rate limits, audit records and Better-Auth. SSR uses the same signer directly on the server,
not an RPC exposing signatures/cookies. Assertions expire after 180 seconds with 30 seconds of
future clock skew allowed; keep both hosts' clocks synchronized. No body buffering is needed.

Direct/native API callers need no proxy key: the API uses Render's ingress IP for those requests.
Invalid claimed assertions or missing/malformed provider IP fail with 403 rather than silently
changing quota identity. Platform health routes remain available without visitor-IP headers.
The assertion never authenticates a user or relaxes cookies, bearer tokens, CSRF or role checks.

Before live cutover acceptance, compare direct and website-proxied GET request logs from two
owner-approved networks, including forged forwarding/CF/internal assertion headers. Verify that
resolved IPs match each network's platform-observed address, not `::1`, web egress or forged values.
Local injected-header tests prove the code only, not Render's deployed overwrite behavior. Do not
add a public IP/header echo endpoint. Keep signatures and the signing key out of responses/logs.
On rollback restore coordinated code, mode/origin and key settings together; retain data/indexes.

### Concurrent code-mail reservations

Code mail remains limited to five reservations per recipient per hour, including pending and
failed deliveries. The count and outbox insert use one transaction with a recipient-specific
transaction-scoped advisory lock, so overlapping requests cannot reserve the same remaining slot.
The lock is released at commit before SMTP delivery. Queueing still runs off the HTTP request;
over-cap requests keep their existing quiet responses. This needs no schema migration, provider
change or new setting. Other recipients use separate lock keys; hash collisions can only serialize
their reservations, not share their allowances. Delivery retries keep the existing outbox behavior.
