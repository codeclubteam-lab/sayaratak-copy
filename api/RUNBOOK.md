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
