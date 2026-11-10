AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## How to work in this repo

- Use `ponytail` only when writing code. Skip it for planning, reading, and updating `progress.md`.
- Report information concisely and directly. Do not pad responses or claim anything is tested unless verified.
- Always record progress. After each bounded step, update the relevant `progress.md` (`api/plan/progress.md` and `web/plan/progress.md`: step status, gate boxes, notes, `"Resume here"`, plus Deviations and Decisions log when they apply). Never leave a step finished without recording it.
- When something is unclear, ask instead of guessing or picking silently. Present the recommended option first, labeled `(Recommended)`. This overrides the plan's fallback rule (`pick the simplest option and log it`).
- STRICT RULE: do not just agree with the owner. When a request or decision looks wrong (UX, accessibility, the plan, architecture, scope, security), explain why with evidence and ask clarifying questions before editing. Disagree first; implement only after confirmation.
- Always provide a clear browser walkthrough guide whenever UI changes need manual verification.

## Repository layout

Root is a Bun workspace (`packages/*`, `web`, `api` with `linker = "hoisted"` in `bunfig.toml`). It also holds `CLAUDE.md`, `AGENTS.md`, `biome.json`, `render.yaml`, `.claude/`, `.graphifyignore`, and `graphify-out/` (gitignored).

- `packages/shared/` (`@sayaratak/shared`): shared Zod entity/field schemas (`schemas/*`, `search/schemas.ts`, `listings/schemas.ts`) and shared utilities (`lib/{slug,phone,digits}.ts`). Exported as TypeScript sources (`./* -> ./src/*.ts`) consumed by both `web` and `api`.
- `web/`: TanStack Start / Router / Query / Table + React + Tailwind v4 + shadcn/ui application.
  - `web/plan/` (gitignored via `web/.gitignore`): frontend blueprint (`implementation.md`, `progress.md`).
  - `web/docs/` (committed): `ARCHITECTURE.md`, `DESIGN.md`, `BACKEND_HANDOFF.md`, `SWAP_TO_REAL_API.md`, `DEMO.md`.
- `api/`: Bun + Hono + PostgreSQL 18 + Drizzle ORM + Better-Auth backend API.
  - `api/CONTRIBUTING.md`: mandatory architecture, style, import, and B9 gate law for all backend code.
  - `api/plan/` (gitignored via `api/.gitignore`): backend and Phase 11 frontend-swap blueprint (`implementation.md`, `progress.md`).
  - `api/docs/` (committed) and `api/RUNBOOK.md`: mobile API contract guide and ops runbook.

Do not read `implementation.md` whole. Open `"Resume here"` in `api/plan/progress.md` and `web/plan/progress.md`, take the next step, and read only that step in Part B plus its referenced A-sections. Repository docs are the only authority; external conventions do not apply.

Product: Sayaratak, a vehicle and auto-services marketplace for Sudan (cars, trucks, motorcycles, tuk-tuks, spare parts, rentals, dealerships, workshops, mechanics). Arabic (default, RTL) and English. All prices are whole SDG pounds only.

## Settled decisions (override conflicting plan wording)

- Package manager & runtime: Bun only (`bun@1.4.2`). Never use npm or pnpm (`web/.cta.json` is stale scaffold output).
- Import boundaries: `@/` in `web/` (`web/src/*`), `~/` in `api/` (`api/src/*`), and `@sayaratak/shared/<path>` for shared schemas/utils. Never import `web/` or `@/` from `api/src/**` (Biome enforces this). Never import `src/mocks` from `web` client code.
- Fonts: IBM Plex Sans and IBM Plex Sans Arabic.
- UI primitives: shadcn (`base-nova`) on `@base-ui/react` (`"rtl": true`). Check installed Base UI APIs instead of older Radix plan wording (`DirectionProvider`, `shadcn migrate rtl`). Use `render` instead of `asChild`, and style navigation links with `buttonVariants` instead of wrapping links in `Button`. Add shadcn components with `bunx --bun shadcn@latest add <name>`.
- Auth & account integration: Better-Auth `1.7.10` handles authentication (`emailOTP`, admin `twoFactor` email code, social OAuth redirects, `bearer` for native apps), while `GET /api/v1/me` (currently `/api/me` on the mock) still serves the shared `User` shape and `POST /me/password` stays (decision O2).
- Infrastructure choices: PostgreSQL 18 everywhere (`api/docker-compose.yml` exposes `postgres` on 5432 and tmpfs `postgres-test` on 5434); Cloudinary for media and private receipts/verification documents streamed by the API; manual Bankak transfers with receipt upload; Cloudflare R2 for private backups; Render target hosting.

## Current state

- Web phases 0 to 14 (mocked frontend) and API phases 0 to 10 (backend API + OpenAPI contract CI) are built.
- Active phase is **Phase 11: Frontend swap** (`api/plan/implementation.md` Part B and `web/docs/SWAP_TO_REAL_API.md`). Check `"Resume here"` in both `api/plan/progress.md` and `web/plan/progress.md` before doing work (step `11.1` is committed on `main`; next is `11.2` Remove mock-only UI).

## Commands

Never run heavy suites or checks in parallel on this machine (6.8 GiB RAM). Stop temporary dev servers, browsers, and `postgres-test` when finished.

### Root
- `bun install --frozen-lockfile`
- `bun audit --audit-level=high --ignore=GHSA-p6vx-979v-rg4c --ignore=GHSA-jp82-f5mq-hwhp --ignore=GHSA-97r2-qh9m-474h --ignore=GHSA-wp97-x4hv-qvhp --ignore=GHSA-7rv5-mrxv-xcr9 --ignore=GHSA-9wx9-5pv9-3349 --ignore=GHSA-mrhx-c7xc-m3w5`

### Shared (`packages/shared/`)
- `bun run --cwd packages/shared lint` (`biome lint .`)
- `bun run --cwd packages/shared check` (`biome format .`; `format` writes)

### Web (`web/`)
- `bun run --cwd web dev` (`vite dev --port 3000`)
- `bun run --cwd web build` / `bun run --cwd web start`
- `bun run --cwd web typecheck` (`tsc --noEmit`)
- `bun run --cwd web lint` (`eslint && bun scripts/check-rules.ts`)
- `bun run --cwd web check` (`prettier --check`; `format` writes)
- `bun run --cwd web i18n:check` / `bun run --cwd web i18n:literals`
- `bun run --cwd web size`
- `bun run --cwd web generate-routes` (`tsr generate`)
- `bun run --cwd web test --maxWorkers=2` — always use Vitest via `bun run`, never bare `bun test` (Bun's runner ignores Vitest setup). Keep `--maxWorkers=2` to avoid memory exhaustion.
- Playwright suites: `test:e2e`, `test:states`, `test:journeys`, plus `seo:check` and `audit:design`.

### API (`api/`)
- `bun run --cwd api dev` / `bun run --cwd api start`
- `bun run --cwd api typecheck`
- `bun run --cwd api lint` (`biome lint .`)
- `bun run --cwd api check` (`biome format .`; `format` writes)
- `bun run --cwd api openapi` (regenerates `api/openapi.json`; required when `/api/v1` routes change)
- `bun run --cwd api db:generate` / `db:migrate` / `db:seed` / `db:bootstrap` / `create-admin` / `parity`
- `docker compose -f api/docker-compose.yml up -d --wait postgres-test` before API tests, then `bun test --cwd api --timeout 120000 ...` (DB reset/seed hooks can take > 5 s under load), and `docker compose -f api/docker-compose.yml stop postgres-test` afterward.

## Target architecture

- `web/` stack: TanStack Start/Router/Query/Table, React Hook Form + Zod, shadcn/ui on Tailwind v4, i18next, Bun. Adding any dependency not in A6 needs a Deviations entry.
- Web routing & SSR: every public URL is prefixed `/$locale` (`ar` default RTL, `en` LTR). Unknown locale is 404. Routes parse search params with `validateSearch` (URL is the source of truth), run loaders, and render `features/*`. Dashboards use `ssr: false` behind auth guards; maps are client-only and lazy.
- Data & isolation: API fetches validate responses with Zod and throw typed errors. Query keys live in `lib/api/query-keys.ts`. Create one `QueryClient` and one i18n instance per SSR request; read SSR preferences from cookies via root loader/context, never module globals. `@tanstack/react-store` is for transient UI state only.
- Web folders: `src/routes`, `src/features/<name>/{components,queries.ts,schemas.ts,hooks.ts}`, `src/components/{ui,app}`, `src/lib`, `src/mocks`, `src/messages/{en,ar}/*.json`, `scripts/`, `e2e/`, `tests/`.
- `api/` structure (`api/CONTRIBUTING.md`): feature modules under `src/modules/<name>/` (`routes`, `service`, `queries`, `tables`, `mapper`, `test`, `parity.test`, optional `types`), shared infrastructure under `src/shared/`, background jobs under `src/jobs/`. Every `/api/v1` route uses `spec()`, validates with shared schemas, delegates to a service, and keeps unidirectional imports (`routes -> service -> queries -> tables`; cross-module calls go through services only).

## Rules that are easy to violate

- **No dead UI**: every button, link, toggle, and form must mutate state/backend and invalidate queries. No `href="#"`, empty handlers, or console-only submits.
- **HARD RULE (owner)**: every Remove action asks for confirmation first, everywhere in the app. Use `RemoveButton` on `ConfirmDialog`; `scripts/check-rules.ts` fails files using `common.remove` without it. Un-saving a favorite heart or dismissing a filter chip is not a removal. Undo toasts come after confirm, not instead of it.
- **Logical CSS only**: use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `border-s`, `border-e`, `rounded-s`, `rounded-e`. Never use `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`/`border-l`/`border-r`/`rounded-l`/`rounded-r`/`rounded-tl`/`tr`/`bl`/`br` outside `components/ui`. Isolate phone numbers, plates, and model names with `<bdi>` or `dir="ltr"`.
- **i18n & clean output**: no hardcoded UI strings (every key in both `ar` and `en`); Zod messages are i18n keys; `useT()` takes no namespace argument and returns `{ t, locale }`. No `"use client"` in `web/src/**`, no `TODO`/`FIXME`, no `console.log` (`api` uses `log` from `~/shared/log/logger`).
- **Numeric schemas**: form fields use `requiredInt`, `optionalInt`, `latSchema`, `lngSchema` — not `z.coerce.number()`. `z.coerce` is only for URL search params.
- **Type safety & formatting**: no `any`; `as` only right after a Zod parse at the API boundary. Money is whole SDG pounds (no currency field). Dates are ISO strings formatted only via `lib/format.ts`; time-dependent text uses `useNow()`. Do not modify `components/ui` for styling; customize via tokens.
- **Visual tokens**: asphalt text, Nile green primary, amber (`--signal`) reserved for paid promotion. Cards have no border or shadow; shadows belong only on floating layers. Spacing scale `4/8/12/16/20/24/32/48`. No gradients, hover lifts, entrance animations, or illustrations; motion follows A5b (80 to 220 ms, immediate press feedback). Forms mark the minority (`<FieldMarks value="required">` when fewer required than optional fields). Never combine custom type-role utilities (`text-caption`, `text-ui`, `text-body`, `text-lead`, `text-title`, `text-page`, `text-hero`) with a text color in the same `cn()` call.
- **Code structure & lint limits**: kebab-case filenames, named exports, `type` over `interface`. In `api/` and `packages/shared/`, Biome enforces <= 200 lines/file, <= 40 lines/function, cognitive complexity <= 10, <= 3 params, no default exports, and no `biome-ignore` suppressions. Prettier formats `web/` (no semicolons, double quotes, 2 spaces, `es5` trailing commas, Tailwind class sorting); Biome formats `api/` and `packages/shared/` with matching style.
- **Commits & gates**: one commit per step (`step <x.y>: <summary>`). Never commit failing typecheck, lint, format, or tests. Complete all applicable gates before marking a step `[x]` in `progress.md`.
- **Product invariants**: deferred sign-in (browsing, call, and WhatsApp are public; favorites, messaging, publishing, and reviews gate on sign-in); Bankak manual transfer with receipt review; one role per account; filtered search pages are `noindex` while presets and listings are indexed; 24 listings per page with numbered pagination.

## graphify

This project maintains a codebase knowledge graph in `graphify-out/` (gitignored).

- When `graphify-out/graph.json` exists, orient first before raw grepping or broad file reads using `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"`.
- Use `graphify-out/wiki/index.md` for broad navigation, or `graphify-out/GRAPH_REPORT.md` for architecture review when scoped queries are not enough.
- Run `graphify update .` after modifying code to keep the AST graph current.
