# Sayaratak

Sayaratak is a marketplace for vehicles and auto services in Sudan: cars, trucks, motorcycles, tuk-tuks, rickshaws, spare parts, rentals, dealerships, workshops and mechanics. The site is in Arabic (the default, right to left) and English. Every price is in Sudanese pounds (SDG) and there is no other currency.

This folder holds the frontend only. There is no backend yet. The app calls a mock API that runs inside the same server process and has the same shape as the planned real API. See `docs/BACKEND_HANDOFF.md` for that API and `docs/SWAP_TO_REAL_API.md` for switching to it.

## Run it

You need [Bun](https://bun.sh) (developed on 1.4). Bun is the only package manager and script runner used here; do not use npm or pnpm.

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run dev            # http://localhost:3000, redirects to /ar
```

For a demo, run the production build as one long-lived process. The mock keeps its data in memory, so a restart puts the seed data back.

```bash
bun run build
bun run start          # .output/server/index.mjs, port 3000 (set PORT to change it)
```

## Environment variables

| Variable | Where it is read | Default in `.env.example` | What it does |
|---|---|---|---|
| `API_BASE_URL` | server | `http://localhost:3000` | Origin of the API for calls made during server rendering. The client adds `/api` |
| `VITE_API_BASE_URL` | browser (build time) | empty | Origin of the API for browser calls. Empty means same origin |
| `APP_ORIGIN` | server | `http://localhost:3000` | Public origin used in canonical and hreflang links, `sitemap.xml` and `robots.txt`. Falls back to the request origin |
| `VITE_DEMO` | browser and server | `true` | Shows the demo accounts on the sign-in page, the emailed code on screen, the "Reset demo data" button, and turns on the mock auto-reply in messages |
| `VITE_FEATURE_OTP` | browser | `false` | Shows the phone verification prompt on the account overview. Phone sign-in is future work |
| `MOCK_LATENCY_MS` | server | `300` | Fixed delay for browser calls to the mock. Empty gives a random 150 to 450 ms. Server-rendering calls always get 0 |
| `MOCK_EMPTY` | server | `false` | `true` seeds only the taxonomy, plans, settings, pages and the demo accounts, for checking empty states |
| `MOCK_REPLY_MS` | server | unset | Delay of the mock auto-reply in messages (8 seconds when unset). Tests set it |
| `SEO_ORIGIN` | `scripts/check-seo.ts` | unset | Server the SEO check runs against |
| `PORT` | `bun run start` | `3000` | Port of the production server |

## Demo accounts

Every account uses the password `Demo1234`. Sign in with the email.

| Role | Email | Name | Dashboard |
|---|---|---|---|
| Individual | `user@demo.sy` (phone `+249912345601`) | Omar Hassan | `/ar/account` |
| Dealership | `dealer@demo.sy` | Al Nasr Motors | `/ar/dealer` |
| Workshop | `workshop@demo.sy` | Al Amal Auto Care | `/ar/workshop` |
| Mechanic | `mechanic@demo.sy` | Yousif Ibrahim | `/ar/mechanic` |
| Admin | `admin@demo.sy` | Site admin | `/ar/admin` |
| New account, onboarding not done | `new@demo.sy` | New Visitor | `/ar/onboarding/role` |

With `VITE_DEMO=true` the sign-in page has a folded "Demo accounts" list. Emailed codes are not sent anywhere: the code step shows the code on screen. Phone codes always accept `123456`. The dealership starts verified; the workshop and the mechanic do not, and have no verification request yet.

In development, `Ctrl+Shift+D` opens a dev panel that signs in as any role, sets the mock latency, makes the next calls fail (500, 404, 422, offline), ends the session or bans the signed-in account.

## Scripts

| Script | What it does |
|---|---|
| `bun run dev` | Vite dev server on port 3000 |
| `bun run build` | Production build into `.output/` (Nitro, `bun` preset) |
| `bun run start` | Runs the production build |
| `bun run preview` | Vite preview of the build |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint, then `scripts/check-rules.ts` (project rules: logical CSS only, `RemoveButton` on every Remove, no `console.log`, no "use client") |
| `bun run check` / `bun run format` | Prettier check or write |
| `bun run test` | Vitest unit and component tests. Use this, not `bun test`, which skips the Vitest setup |
| `bun run test:e2e` | Playwright smoke, accessibility and keyboard suites against a production build on port 3100. Uses the installed Chrome |
| `bun run test:states` | Builds, then checks loading, empty, error and form states (ports 3100 and 3101) |
| `bun run test:journeys` | Builds, then runs the end-to-end journeys in `e2e/journeys` (port 3102, one worker) |
| `bun run size` | Gzip size of every JS chunk in the build; fails over budget |
| `bun run i18n:check` | Every key exists in both languages and sits in the file its prefix maps to |
| `bun run i18n:literals` | Finds hard-coded UI strings |
| `bun run seo:check` | Titles, canonicals, hreflang, JSON-LD and the indexation policy on 24 pages. Needs a running server |
| `bun run audit:design` | Static check of the design rules (allowlist with reasons in `scripts/audit-design-allow.ts`) |
| `bun run contrast` | WCAG contrast of every token pair; fails under the minimum |
| `bun run shots` | Screenshots of key pages in both languages |
| `bun run generate-routes` | Regenerates `src/routeTree.gen.ts` |

The release gate is `bun run typecheck && bun run lint && bun run build && bun run size`.

## Folder map

```
src/
  routes/          file routes, kept thin: parse search params, run a loader, render a feature
    $locale/       every public and dashboard page (ar or en)
    api/$.ts       catch-all that hands /api/* to the mock
    sitemap[.]xml.ts, robots[.]txt.ts
  features/<name>/ one folder per screen or domain: components/, queries.ts, schemas.ts, hooks.ts
  components/ui/   shadcn components on Base UI (only token and RTL fixes, never restyled per screen)
  components/app/  shared app components (ListingCard, DataTable, RemoveButton, Gallery...)
  lib/             api client and query keys, i18n, formatting, SEO, slugs, motion helpers
  hooks/           shared React hooks
  schemas/         Zod schemas shared by the app and the mock: entities, inputs, responses
  mocks/           server-only mock API: router, handlers, in-memory db, seed
  messages/        ar/*.json and en/*.json, flat keys
  styles.css       tokens, type roles, motion tokens
scripts/           checks and tools behind the scripts above
tests/             Vitest tests (they run against the mock through tests/mock-fetch.ts)
e2e/               Playwright specs and the route list
docs/              handoff documents
public/            logo, icons, make logos, mock photos and banners
```

## Documentation

- `docs/ARCHITECTURE.md`: rendering, routing, data layer, mock API, i18n, forms, tables, state and the performance budget, plus the decisions that changed the original plan.
- `docs/DESIGN.md`: tokens, type scale, spacing, component rules, do and do not, contrast.
- `docs/BACKEND_HANDOFF.md`: every endpoint with its schemas, and the behaviors the real backend must repeat.
- `docs/SWAP_TO_REAL_API.md`: the steps to point the app at a real API.
