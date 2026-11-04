# Architecture

TanStack Start (React 19) with TanStack Router, Query and Table, React Hook Form with Zod 4, shadcn/ui on Base UI and Tailwind CSS v4, i18next. Built and run with Bun; the production server is Nitro with the `bun` preset. Import alias `@/` points at `src/`.

## Rendering

| Area | Rendering |
|---|---|
| Public pages: home, search, landing presets, listing, directories, profiles, map shell, static pages | Server rendered. Loaders prefetch TanStack Query data and the cache is sent to the browser |
| Auth, onboarding, post wizard | Server-rendered shell, interactive on the client |
| Dashboards: `/account`, `/dealer`, `/workshop`, `/mechanic`, `/admin` | `ssr: false` on the layout route, behind an auth and role guard |
| Map canvas, charts, image uploader, lightbox | Client only, lazy loaded |

The router and its `QueryClient` are created per request on the server (`src/router.tsx`), so no cached data leaks between visitors. One i18n instance is created per request too. Server-rendering preferences (locale, data saver, listing view, sidebar) come from cookies through the root loader and a React context, never from module-level state. `@tanstack/react-store` holds only client-only transient state: the auth dialog and the action to replay after sign-in.

## Routing and URLs

- Every page URL starts with `/$locale` (`ar` or `en`). `/` redirects using the `locale` cookie, then `Accept-Language`, then `ar`. An unknown locale is a 404.
- Route files are thin: `validateSearch` with a Zod 4 schema, a loader, and a component from `src/features`. The URL is the only source of truth for filters, sort, page and tab.
- Main routes:

```
/$locale                                   home
/$locale/search                            search (noindex with filters)
/$locale/vehicles/$type/$intent/{-$city}   landing presets, e.g. /ar/vehicles/cars/sale/khartoum
/$locale/parts                             parts preset
/$locale/listing/$slug                     listing detail
/$locale/dealerships | workshops | mechanics (and /$slug)
/$locale/map                               map search
/$locale/post                              post wizard (?step=)
/$locale/auth/login | signup | forgot      /auth redirects to /auth/login
/$locale/onboarding/role, /onboarding/$role/$step
/$locale/about | contact | privacy | terms | suspended
/$locale/account/* /dealer/* /workshop/* /mechanic/* /admin/*
/sitemap.xml  /robots.txt  /api/$
```

- Listing slug: words of the title and city (Arabic letters kept, diacritics and tatweel dropped, Latin lowercased, 60 characters), then a hyphen and the six-character id (`packages/shared/src/lib/slug.ts`). The page resolves by the id and redirects when the words differ.
- Landing `$type` is `cars`, `trucks`, `motorcycles`, `tuk-tuks`, `rickshaws`; `$intent` is `sale` or `rent`; the city is a taxonomy slug.
- Lists show 24 items per page with numbered pagination.

## Data layer

- `src/lib/api/client.ts` exports `apiFetch(path, { method, query, body, form, schema })`. It builds the URL from `API_BASE_URL` (server) or `VITE_API_BASE_URL` (browser) plus `/api`, repeats array keys (`fuel=petrol&fuel=diesel`), sends cookies (on the server it forwards the incoming request's cookie header), validates the response with the given Zod schema, and throws `ApiError { status, code, fields, retryAfter }`. The UI reacts to `code`, never to message text.
- Each feature has `queries.ts` with `queryOptions` factories and mutation hooks. Query keys come only from `src/lib/api/query-keys.ts`. Mutations invalidate by key prefix. Favorites, read marks, status changes and switches are optimistic with rollback and a toast.
- Defaults: `staleTime` 30 s, `retry` 1, no refetch on focus except inbox and notifications. Taxonomy is cached forever.
- Loaders `ensureQueryData` what is above the fold. When only search params change, the loader does not wait: old results stay and dim, then update.
- Router: `defaultPreload: "intent"` (off with data saver), `defaultPreloadStaleTime: 0`, `defaultPendingMs: 400`, `defaultPendingMinMs: 300`, `scrollRestoration: true`, view transitions on route change only.

## Mock API

- `src/routes/api/$.ts` is a server route that hands every `/api/*` request to `handleMock` in `src/mocks/router.ts`. It imports the mock inside the handler, so mock code never reaches the browser bundle. Never import `src/mocks` from client code.
- Handlers live in `src/mocks/handlers/`, one file per domain, registered with `route("GET", "/listings/:slug", handler)`. They validate input and output with the same Zod schemas as the app (`src/schemas`).
- Data is an in-memory database on `globalThis` (`src/mocks/db.ts`) seeded with a fixed faker seed (`src/mocks/seed/`), so every start has the same data. It is lost on restart and not shared between processes.
- Session: an httpOnly `sy_session` cookie holding the user id (30 days, `SameSite=Lax`).
- Latency: 0 ms for server-rendering calls (`x-mock-ssr: 1`), otherwise `MOCK_LATENCY_MS` or 150 to 450 ms at random.
- Failure injection: `x-mock-fail` header or `mock_fail` cookie (`500`, `404`, `422`, `offline`), set from the dev panel.
- Uploads are kept in a server-side map and served from `/api/uploads/:id`.
- `src/mocks/sitemap.ts` feeds `/sitemap.xml` from the same data.
- Unit and component tests run every API call through the mock (`tests/mock-fetch.ts`), so the mock is also the test fixture.

## i18n and RTL

- i18next with flat keys whose prefix picks the file: `listing.call` lives in `src/messages/{ar,en}/listing.json`. `useT()` takes no namespace and returns `{ t, locale }`. Zod messages are keys such as `validation.required`, never sentences. `bun run i18n:check` enforces the prefix map and both languages.
- `<html lang dir>` comes from the locale; Arabic is `dir="rtl"`. The app is wrapped in the Base UI direction provider so menus and sliders open on the right side.
- CSS uses logical properties only (`ms-`, `pe-`, `start-`, `text-start`, `border-s`, `rounded-e`...). `bun run lint` fails on physical ones outside `components/ui`. Directional icons flip with `rtl:-scale-x-100`. Phone numbers, plates and model names sit in `<bdi>` or `dir="ltr"`.
- `src/lib/format.ts` owns numbers, prices, dates and relative time: `Intl` with Latin digits, Gregorian calendar, `Africa/Khartoum`. Time-dependent text reads `useNow()` so server and client HTML match.
- User-written text (titles, descriptions, reviews) is never translated. Taxonomy names, business names and descriptions, notifications and pages are stored as `{ ar, en }`.

## Forms

- React Hook Form with `zodResolver`, typed `useForm<z.input<S>, unknown, z.output<S>>`. Validate on blur, then on change; an empty field stays quiet until the first submit. A failed submit focuses the first invalid field. Server `fields` errors are set on their fields.
- Number fields hold `number | null` and use `requiredInt`, `optionalInt`, `latSchema`, `lngSchema` from `packages/shared/src/schemas/fields.ts`. `z.coerce` is only for URL search params.
- A form marks its minority: "(Optional)" by default, or `<FieldMarks value="required">` (asterisks) when optional fields outnumber required ones.
- Long forms (post wizard, onboarding) save a draft to `sessionStorage` and, signed in, to `PATCH /api/drafts/:key`. Forms with unsaved changes warn before leaving.
- Every Remove asks for confirmation first through `RemoveButton` (`src/components/app/remove-button.tsx`). Un-saving a favorite and dismissing a filter chip are not removals.

## Tables

`DataTable` (`src/components/app/data-table.tsx`) wraps TanStack Table with manual pagination, sorting and filtering, all in URL search params. It has a column menu, row selection with a bulk bar, and loading, empty and error states. Below `md` it renders a mobile card when the table gives one. Column factories live in `features/<name>/columns.tsx` and take `t`.

## Cookies

| Cookie | Holds | Lifetime |
|---|---|---|
| `sy_session` | user id, httpOnly (mock only) | 30 days |
| `locale` | `ar` or `en` | 1 year |
| `data_saver` | `1` or absent | 1 year |
| `listing_view` | `grid` or `row` | 1 year |
| `city` | taxonomy city id | 1 year |
| `geo` | `lat,lng` | 24 hours |
| `sidebar` | `open` or `closed` | 1 year |

## SEO

Each route's `head()` sets title, description, canonical, hreflang (`ar`, `en`, `x-default`), Open Graph and Twitter tags, and JSON-LD (`Vehicle` and `Offer`, `Product`, `AutoDealer`, `AutoRepair`, `Person`, `BreadcrumbList`). Indexed: home, landing presets, approved available listings, profiles, directories, static pages. `noindex, follow`: search with filters, filtered directories, map. `noindex`: unavailable listings and every dashboard, auth, onboarding and post page. `robots.txt` closes each section twice, `/ar/dealer$` and `/ar/dealer/`, because robots rules are prefixes and `/ar/dealer` alone would also block `/ar/dealerships`.

## Performance budget

- Target: home LCP under 2.5 s on Slow 4G, layout shift under 0.05, every press answered within 100 ms.
- `bun run size` limits: entry chunk 200 KB gzip, the lazy Recharts chunk 120 KB, any other chunk 80 KB.
- Images: WebP with `srcset`, fixed ratio boxes with a placeholder color, lazy except the first row; the listing cover is `fetchpriority="high"`. Data saver caps images at 640 px and turns off preload, view transitions, video preload and map tiles until tapped.
- Measured in step 14.5 and accepted by the owner (2026-10-23) as not yet meeting the target: LCP 7.7 to 13.1 s, Lighthouse performance 44 to 59, home JS about 380 KB gzip (entry 137 KB). Known causes to work on before release: the 294 KB inline router payload, hydration work, mobile cards rendered in desktop tables, mock photos over 100 KB, no `srcset` on hero banners.

## Decisions that changed the original plan

| Area | What was built |
|---|---|
| Sign in | Separate `/auth/login` (email and password) and `/auth/signup` (name, email, password, confirm, terms). Sign-up and password reset use a 6-digit emailed code. Phone sign-in is future work. The backend will use Better-Auth's own endpoints (see `SWAP_TO_REAL_API.md`) |
| Plans | Each audience's first plan priced 0 is its free plan. Paid plans carry `featuredCredits` (free 7-day Featured per period). Workshop and mechanic plans can cap services, photos and portfolio items |
| Ads | Businesses buy banner campaigns on 11 ad pages (weekly price, 3 slots each), paid by the same Bankak checkout and approved by an admin. House banners fill unsold slots |
| Promotions | Two types, as on OpenSooq and Dubizzle: Featured (seller picks 3, 7 or 14 days; top of search, home rail, badge) and Bump up (one-off, back to the top of the newest). They replaced pin, boost, homepage and sponsored (owner, 2026-10-27) |
| Search ranking | Relevance puts Featured listings first but caps them per page of 24 (see `BACKEND_HANDOFF.md`) |
| Admin | Bans take a duration (7 days, 30 days, permanent). Suspended businesses keep their page with a notice. Backups restore a real snapshot |
| Buttons | The `outline` button variant stays in app code; a section's Save is `secondary` until the form is dirty |
| Performance | Budget not met yet, accepted for the demo (above) |
