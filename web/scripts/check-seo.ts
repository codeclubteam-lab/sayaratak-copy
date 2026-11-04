// Fetches the sitemap, robots.txt and 24 sample pages from a running server and asserts the head tags (A6, steps 6.9 and 14.7).
// Usage: bun run seo:check [origin]   (default SEO_ORIGIN, then APP_ORIGIN, then http://localhost:3000)
import process from "node:process"

import {
  base,
  canonicalOf,
  check,
  get,
  getJson,
  pathOf,
  result,
  robotsOf,
  tagsOf,
  unescape,
} from "./seo-lib"
import { checkPolicy } from "./check-seo-policy"

// robots.txt and sitemap
const robots = await (await get("/robots.txt")).text()
for (const rule of [
  "Disallow: /api/",
  ...["ar", "en"].flatMap((l) =>
    [
      "account",
      "dealer",
      "workshop",
      "mechanic",
      "admin",
      "auth",
      "onboarding",
      "post",
    ].flatMap((s) => [`Disallow: /${l}/${s}$`, `Disallow: /${l}/${s}/`])
  ),
])
  check(robots.includes(rule + "\n"), `robots.txt lacks "${rule}"`)
// The public directories share a prefix with the dashboards and must stay crawlable.
check(
  !/^Disallow: \/(ar|en)\/(dealer|workshop|mechanic)$/m.test(robots),
  "robots.txt blocks a public directory by prefix"
)
check(
  /^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robots),
  "robots.txt Sitemap line"
)

const sitemap = await (await get("/sitemap.xml")).text()
const urls = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc>(.*?)<\/url>/g)]
const locs = urls.map((m) => decodeURI(unescape(m[1]!)))
const under = (dir: string, locale = "ar") =>
  locs.filter((u) => u.includes(`/${locale}${dir}`)).length
check(locs.length > 0, "sitemap has no urls")
for (const [i, m] of urls.entries()) {
  const alt = [...m[2]!.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(
    (a) => a[1]
  )
  check(
    alt.join() === "ar,en,x-default",
    `sitemap alternates of ${locs[i]}: ${alt.join()}`
  )
}
for (const dir of [
  "/listing/",
  "/vehicles/",
  "/dealerships/",
  "/workshops/",
  "/mechanics/",
])
  check(
    under(dir) > 0 && under(dir) === under(dir, "en"),
    `sitemap ${dir} counts ar/en`
  )
for (const bad of ["/search", "/map", "/account", "/admin", "/post", "/auth"])
  check(!locs.some((u) => u.includes(bad)), `sitemap lists ${bad}`)
// Profile counts must match the public directories (active rows only).
for (const [dir, api] of [
  ["/dealerships/", "dealerships"],
  ["/workshops/", "workshops"],
  ["/mechanics/", "mechanics"],
] as const) {
  const { total } = (await (await get(`/api/${api}?pageSize=1`)).json()) as {
    total: number
  }
  check(
    under(dir) === total,
    `sitemap ${dir}: ${under(dir)} urls, API ${total}`
  )
}
console.log(
  `sitemap ${locs.length} urls: listings ${under("/listing/")}, landings ${under("/vehicles/")}, profiles ${under("/dealerships/") + under("/workshops/") + under("/mechanics/")} (per language)`
)

// Sample pages: [path, JSON-LD types that must appear, whether the page is indexable].
const first = (dir: string, locale = "ar") =>
  locs.find((u) => u.includes(`/${locale}${dir}`))!.slice(base.length)
const samples: [string, string[]][] = [
  ["/ar", []],
  ["/en", []],
  [first("/vehicles/", "ar"), []],
  [
    locs
      .find((u) => /\/en\/vehicles\/[^/]+\/[^/]+\/[^/]+$/.test(u))!
      .slice(base.length),
    [],
  ],
  [first("/listing/", "ar"), ["BreadcrumbList"]],
  [first("/listing/", "en"), ["BreadcrumbList", "Offer"]],
  [first("/dealerships/", "ar"), ["AutoDealer", "BreadcrumbList"]],
  [first("/workshops/", "en"), ["AutoRepair", "BreadcrumbList"]],
  [first("/mechanics/", "ar"), ["Person", "BreadcrumbList"]],
  ["/en/about", []],
  ["/ar/dealerships", []],
  ["/en/parts", []],
  // Step 14.7: every page type in the other language too, a part, an Arabic slug and deep pages of a list.
  [
    `/en/listing/${(await getJson<{ items: { slug: string }[] }>("/api/listings?kind=part&pageSize=1")).items[0]!.slug}`,
    ["BreadcrumbList", "Product"],
  ],
  [
    locs
      .find((u) => /\/ar\/listing\/[\u0600-\u06FF]/.test(u))!
      .slice(base.length),
    ["BreadcrumbList", "Offer"],
  ],
  [first("/dealerships/", "en"), ["AutoDealer", "BreadcrumbList"]],
  [first("/workshops/", "ar"), ["AutoRepair", "BreadcrumbList"]],
  [first("/mechanics/", "en"), ["Person", "BreadcrumbList"]],
  ["/ar/contact", []],
  ["/en/terms", []],
  ["/ar/privacy", []],
  ["/en/workshops", []],
  ["/ar/mechanics", []],
  ["/ar/vehicles/cars/sale?page=2", []],
  ["/en/search?page=2", []],
]

for (const [path, types] of samples) {
  const res = await get(path)
  const html = await res.text()
  const tags = tagsOf(html)
  const meta = (key: string) =>
    tags.find((t) => t.name === key || t.property === key)?.content
  const where = path
  check(res.status === 200, `${where} status ${res.status}`)
  check(/<title>[^<]+ \| Sayaratak<\/title>/.test(html), `${where} title`)
  check(!!meta("description"), `${where} description`)
  const canonical = canonicalOf(tags)
  check(canonical === decodeURI(path), `${where} canonical ${canonical}`)
  const lang = (l: string) =>
    tags.find((t) => t.rel === "alternate" && t.hreflang === l)?.href
  const rest = path.replace(/^\/(?:ar|en)/, "")
  for (const [l, locale] of [
    ["ar", "ar"],
    ["en", "en"],
    ["x-default", "ar"],
  ] as const)
    check(
      pathOf(lang(l)) === decodeURI(`/${locale}${rest}`),
      `${where} hreflang ${l}: ${lang(l)}`
    )
  for (const key of [
    "og:title",
    "og:description",
    "og:url",
    "og:type",
    "og:locale",
    "twitter:card",
  ])
    check(!!meta(key), `${where} ${key}`)
  if (path.includes("/listing/")) check(!!meta("og:image"), `${where} og:image`)
  check(robotsOf(tags) === undefined, `${where} is noindex`)
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs
    ),
  ].map((m) => m[1]!)
  let found = ""
  for (const b of blocks) {
    try {
      JSON.parse(b)
      found += b
    } catch {
      check(false, `${where} JSON-LD does not parse`)
    }
  }
  for (const t of types)
    check(found.includes(`"@type":"${t}"`), `${where} JSON-LD ${t}`)
}

await checkPolicy(locs)

console.log(
  result.failed
    ? `seo:check: ${result.failed} failed`
    : `seo:check: ${samples.length} pages and the indexation policy ok`
)
if (result.failed) process.exit(1)
