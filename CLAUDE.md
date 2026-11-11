CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

How to work in this repo

Use ponytail only when writing code. Skip it for planning, reading, and updating progress.md.
When reporting information to me, be extremely concise, straightforward and sacrifice grammar for the sake of concision. 
Always record progress. After each bounded step, update web/plan/progress.md (step status, gate boxes, notes, "Resume here"), plus the Deviations and Decisions log when they apply. Never leave a step finished without recording it.
When something is unclear, ask; do not implement what seems best. Use AskUserQuestion with the recommended option first, labeled "(Recommended)". This overrides the plan's own rule of "pick the simplest option and log it" (A1 rule 17).
STRICT RULE: do not just take my side. When a request or decision of mine looks wrong (UX, accessibility, the plan, architecture, scope), say so with the reason and evidence, and ask clarifying questions with AskUserQuestion before changing anything. Disagree first, implement only after I have answered. Never agree to be agreeable.
Always give me a walkthrough steps guide so I can test the changes manually in the browser.

Repository layout

sayaratak-new/ is the git repo root (history before the move has paths without the web/ prefix). web/ is the whole application; the root also holds this file, .claude/, .graphifyignore and graphify-out/ (gitignored).
web/plan/ holds the plan and is gitignored (web/.gitignore). web/plan/implementation.md (~280 KB) is the blueprint: Part A is reference (rules, design tokens, architecture, schemas, mock API contract, copy), Part B is 143 numbered steps in 15 phases. web/plan/progress.md mirrors every step with the same IDs, gate checkboxes, a "Resume here" block, a Deviations table and a Decisions log.
web/docs/ is different: it is committed and holds the handoff docs that step 14.10 writes. Do not put the plan files there. Wherever the plan says docs/ for implementation.md or progress.md, read it as plan/.
Do not read implementation.md whole. Open progress.md "Resume here", take the first step not done, read that step in Part B plus only the A-sections it names (index table at the top of implementation.md).
These docs are the only authority. Any AGENTS.md or planning set outside this repository does not apply.
Product: Sayaratak, a vehicle and auto-services marketplace for Sudan (cars, trucks, parts, rentals, dealerships, workshops, mechanics). Frontend only; no backend. Every screen runs against a mock API shaped like the future real one. All prices are SDG only.

Settled decisions (override anything in the plan that says otherwise)

Container runtime: Podman Desktop (`podman` and `podman-compose`) replaces Docker locally — never invoke `docker` or `docker compose` (no Docker daemon runs on this machine). `podman-compose` works without `podman.socket` and does not support `--wait`; use `podman-compose -f api/docker-compose.yml up -d postgres-test` (poll with `podman-compose -f api/docker-compose.yml exec postgres-test pg_isready -U sayaratak -d sayaratak`), `podman-compose -f api/docker-compose.yml stop postgres-test`, and `podman` for any container run/build (e.g. `PG_CLIENT_CMD`).
Package manager: Bun only. No pnpm or npm. The "packageManager": "pnpm" line in web/.cta.json is stale scaffold output; ignore it.
Import alias is @/ (tsconfig.json, components.json). implementation.md writes ~/; read that as @/.
Fonts: IBM Plex Sans + IBM Plex Sans Arabic (A5). The template's Inter is to be replaced.
shadcn runs on Base UI (style: base-nova, @base-ui/react, "rtl": true). The plan's Radix wording (DirectionProvider, shadcn migrate rtl) must be checked against the installed Base UI components before use. Use `render` instead of `asChild`, and style navigation links with buttonVariants instead of wrapping a Link in Button.

Current state

Phases 0 to 5 are done. Next step is 6.0 (Interaction foundation, new in the fourth audit), then the rest of Phase 6 in order. Open "Resume here" in web/plan/progress.md and start there.

Commands (run from web/)

bun install
bun run dev          # vite dev --port 3000
bun run build        # vite build
bun run typecheck    # tsc --noEmit
bun run lint         # eslint (@tanstack/eslint-config)
bun run check        # prettier --check; `bun run format` writes
bun run generate-routes   # tsr generate -> src/routeTree.gen.ts

If a script above or in the plan is missing, check progress.md to see whether Phase 0 already added it. Test runner: Vitest, Playwright and axe are added by the plan. Use bun run test, never bun test (Bun's own runner ignores the Vitest setup). Phase gate: bun run typecheck && bun run lint && bun run build && bun run size.

Formatting: Prettier, no semicolons, double quotes, 2 spaces, trailingComma: es5, Tailwind class sorting (cn, cva). Add shadcn components with bunx --bun shadcn@latest add <name>. .npmrc sets legacy-peer-deps=true.

Target architecture (from implementation.md A6)

Stack: TanStack Start/Router/Query/Table, React Hook Form + Zod (@hookform/resolvers), shadcn/ui on Tailwind v4, i18next, Bun. Adding any dependency not listed in A6 needs a Deviations entry.
Arabic (default, RTL) and English. Every public URL is prefixed /$locale. Locale comes from the path, then the locale cookie, then Accept-Language. Unknown locale is a 404.
Routes are thin: parse search params (validateSearch with a Zod 4 schema; URL is the only source of truth for filters/sort/page/tab), run a loader, render a features/* component. Public pages SSR with Query prefetched in loaders. The five dashboards (account, dealer, workshop, mechanic, admin) use ssr: false behind an auth guard. Map screens are client-only and lazy.
Mock API: one server route src/routes/api/$.ts forwards to handleMock in src/mocks/router.ts, with per-domain handlers in src/mocks/handlers/ and an in-memory DB on globalThis (src/mocks/db.ts, fixed faker seed). Mock code is server-only; never import src/mocks from client code. Auth is an httpOnly sy_session cookie. An x-mock-fail header and a dev panel inject failures.
Data layer: lib/api/client.ts apiFetch validates responses with Zod and throws typed ApiError. Each feature has queries.ts (queryOptions factories and mutation hooks); query keys only from lib/api/query-keys.ts. One QueryClient and one i18n instance per request on the server so nothing leaks between visitors. Server-rendering preferences (locale, data saver) come from cookies via root loader and context, never module-level stores. @tanstack/react-store is for client-only transient state (auth dialog + pending action).
Folder plan: src/routes, src/features/<name>/{components,queries.ts,schemas.ts,hooks.ts}, src/components/{ui,app}, src/lib, src/mocks, src/messages/{en,ar}/*.json, plus scripts/, e2e/, tests/. Shared Zod entity/field schemas (types via z.infer), the search and listing-form schemas and lib/{slug,phone,digits} live in the workspace package packages/shared, imported as @sayaratak/shared/schemas/<name>, @sayaratak/shared/search/schemas, @sayaratak/shared/listings/schemas, @sayaratak/shared/lib/<name>.

Rules that are easy to violate

No dead UI: every button/link/toggle/form must mutate the mock DB or local state and invalidate queries. No href="#", empty handlers or console-only submits.
HARD RULE (owner): every Remove asks for confirmation first, wherever it is in the app. Use `RemoveButton` (components/app/remove-button.tsx, on `ConfirmDialog`); scripts/check-rules.ts fails a file that uses `common.remove` without it. The heart toggle (un-save) and dismissing a search filter chip are not removals. The Undo toast comes after the confirm, not instead of it.
Logical CSS only (ms-, me-, ps-, pe-, start-, end-, text-start, border-s, border-e, rounded-s, rounded-e). Never ml-/mr-/pl-/pr-/left-/right-/text-left/text-right/border-l/border-r/rounded-l/rounded-r (or rounded-tl/tr/bl/br) outside components/ui. Isolate phone numbers, plates and model names with <bdi> or dir="ltr".
No hard-coded UI strings: each needs ar and en keys. Zod messages are i18n keys, not sentences. useT() takes no namespace argument and returns { t, locale }. No TODO/FIXME/console.log in src/**.
Numeric form fields use requiredInt, optionalInt, latSchema, lngSchema (A7), not z.coerce.number(). z.coerce is only for URL search params.
No any. as only right after a Zod parse at the API boundary. Money is whole SDG pounds, no currency field anywhere. Dates are ISO strings, formatted only via lib/format.ts; time-dependent text uses useNow() to stay hydration-safe.
Do not edit components/ui for looks; restyle via tokens (only the RTL/token fixes in step 1.4 are allowed).
Visual system (A5): asphalt text, Nile green primary, amber (--signal) only for paid promotion. Cards have no border or shadow; shadows only on floating layers. Spacing scale 4/8/12/16/20/24/32/48. No gradients, hover lifts, entrance animations or illustrations. Motion and feedback follow A5b only: token durations (80 to 220 ms), opacity, transform and colors, every press answered within 100 ms.
Required marks: a form marks its minority. The default writes "(Optional)"; a form with more optional than required fields wraps itself in `<FieldMarks value="required">` (asterisk, `aria-required`, "* Required" note). Count the fields when you build a profile or settings form (A5, Required and optional marks).
Type roles (text-caption, text-ui, text-body, text-lead, text-title, text-page, text-hero) are custom utilities in src/styles.css. cn() reads them as text colors, so never merge a role and a text color in one cn() call (cn("text-ui", "text-muted-foreground") drops text-ui). Put them in one literal class string or on separate elements.
Files kebab-case, one component per file, named exports, type over interface, files under ~200 lines.
One commit per step, message step 6.3: listing detail page. Never commit with failing typecheck. Each UI step must pass the ten gates G1 to G10 (A1b) before being marked [x] in progress.md.
Product facts to preserve: sign-in is deferred (browse/call/WhatsApp are public; favorites, messaging, publishing, reviews gate with a replayable auth dialog). Payment is a manual Bankak transfer with receipt upload approved by an admin. One account has one role. Search pages with filters are noindex; landing presets and listings are indexed. Listing pages are 24 per page with numbered pagination.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
