# Sayaratak API

Bun + Hono + Drizzle on Postgres 18. Better-Auth for accounts. Contract in `openapi.json`,
code standard in `CONTRIBUTING.md`, guide for app developers in `docs/MOBILE.md`.

## Setup

Needs Bun 1.4.2 and Docker (for local Postgres only).

```sh
bun install                   # from the repo root, workspaces
cd api
cp .env.example .env          # fill BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # postgres on 5432 (dev), postgres-test on 5434 (tests)
bun run db:migrate
bun run db:seed               # demo data from the web mocks; refuses when APP_ENV=production
bun run dev                   # http://localhost:4000, restarts on change
```

Service keys (Google, Cloudinary, SMTP, R2, Firebase, Apple) are optional in development and
required when `APP_ENV=production`. The full list is in `.env.example`.

App developers: [docs/MOBILE.md](docs/MOBILE.md) has a bearer-token walkthrough for listings,
uploads, messages and push. Browse the read-only contract at `http://localhost:4000/api/docs`
in development; that page returns 404 in production. The JSON contract remains available at
`/api/v1/openapi.json`.

## Commands (run in `api/`)

| Command | What it does |
| --- | --- |
| `bun run dev` / `bun run start` | Server with reload / server |
| `bun run typecheck` / `lint` / `check` | tsc / Biome lint / Biome format check (`format` writes) |
| `bun run test` | Test suite, needs `docker compose up -d` (postgres-test) |
| `bun run parity` | Parity tests against the web mocks |
| `bun run db:generate` | New migration from schema changes (commit the SQL) |
| `bun run db:migrate` | Apply migrations (advisory lock, safe to run twice) |
| `bun run db:seed` | Demo data |
| `bun run db:bootstrap` | Reference data only (taxonomy, plans, prices, pages, settings); safe to re-run |
| `bun run create-admin` | First admin account, password asked on the terminal |
| `bun run db:backup` / `db:restore <id>` | Backup to R2 / restore (typed word) |
| `bun run job <name>` | Run one background job by hand |
| `bun run openapi` | Regenerate `openapi.json` (a test fails when it is stale) |

## API compatibility checks

CI checks that `openapi.json` matches the routes, then rejects breaking `/api/v1`
changes with oasdiff 1.35.0. The binary and its SHA-256 are pinned in
`.github/workflows/ci.yml`; it is not an application dependency. Pull requests to
`main` compare against their base commit, pushes to `main` against the previous
commit, and other branches against `origin/main`. Missing baselines fail the check.

New optional inputs, response fields and routes are allowed. Removing a route,
response field (even optional), or enum value, changing a type, or requiring a new
input is not. Put breaking changes in `/api/v2` and keep `/api/v1` available.
`.github/oasdiff-levels.txt` enforces the stricter response-field and enum rules.
Deprecation and sunset dates do not permit v1 removals. The checker also rejects
type widening or narrowing that oasdiff normally considers compatible.

With the pinned oasdiff binary on `PATH`, run from the repo root:

```sh
base=$(mktemp)
git show origin/main:api/openapi.json > "$base"
bun api/scripts/check-api-contract.ts "$base" api/openapi.json
rm "$base"
bun api/scripts/contract-smoke.ts
```

The smoke check uses temporary contracts and proves both passing additions and
failing removals without changing the real contract or needing a database.
For freshness, run `bun run test tests/openapi.test.ts` from `api/` with the test
database running. After an intentional additive schema change, run `bun run openapi`
and commit the updated contract.

## Production image

Built from the repo root, because the workspace needs `packages/shared`:

```sh
docker build -f api/Dockerfile -t sayaratak-api .
```

The image runs as the `bun` user, carries `postgresql-client` 18 for the backup scripts and the
`drizzle/` folder that `/api/health/ready` reads, and starts `bun src/index.ts` on `PORT`
(4000). Migrations never run on boot: `render.yaml` runs `bun run db:migrate` as Render's
pre-deploy command.

Two database users in production: `MIGRATE_DATABASE_URL` is the database owner and only the
pre-deploy step (`db:migrate`) and `db:restore` use it. `DATABASE_URL` is the user the API runs as,
for example `postgres://sayaratak_app:<password>@<host>/<database>`. `db:migrate` creates that user
with the password in the URL (or changes its password to match) and grants read and write on rows:
no schema changes, no update or delete on `audit_log`, queries cut off at 10 s. In development leave
`MIGRATE_DATABASE_URL` blank and one user does everything.

Health: `/api/health/live` (process up, used by Render) and `/api/health/ready` (database,
migrations, SMTP, jobs).
