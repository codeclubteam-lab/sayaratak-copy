// The A6 indexation policy against a running server (step 14.7): noindex listing states, slug redirects, filtered and preset searches, and the server-rendered listing body.
import { formatNumber } from "@/lib/format"
import {
  canonicalOf,
  check,
  get,
  getJson,
  pathOf,
  robotsOf,
  tagsOf,
  unescape,
} from "./seo-lib"

type Row = {
  id: string
  slug: string
  price: number
  description: { ar: string; en: string }
}
const admin = "u-admin"
const one = async (query: string) =>
  (
    await getJson<{ items: Row[] }>(
      `/api/admin/listings?${query}&pageSize=1`,
      admin
    )
  ).items[0]
const noindexed = async (path: string, as?: string) => {
  const res = await get(path, { as })
  check(
    res.status === 200,
    `${path} status ${res.status}${as ? ` as ${as}` : ""}`
  )
  check(
    robotsOf(tagsOf(await res.text())) === "noindex, follow",
    `${path} lacks noindex, follow`
  )
}

export async function checkPolicy(locs: string[]) {
  // Sold, rented and reserved stay public but out of the index and the sitemap.
  for (const status of ["sold", "rented", "reserved"]) {
    const row = await one(`moderation=approved&status=${status}`)
    check(!!row, `no ${status} listing in the seed`)
    if (!row) continue
    await noindexed(`/en/listing/${row.slug}`)
    check(!locs.some((u) => u.endsWith(row.slug)), `sitemap lists ${status}`)
  }

  // Pending, rejected and removed are a 404 to the public; their owner and admins see a noindex page.
  const hidden = async (row: Row, state: string) => {
    const path = `/ar/listing/${row.slug}`
    const res = await get(path)
    check(res.status === 404, `${state} ${path} public status ${res.status}`)
    await noindexed(path, admin)
  }
  for (const state of ["pending", "rejected"]) {
    const row = await one(`moderation=${state}`)
    check(!!row, `no ${state} listing in the seed`)
    if (row) await hidden(row, state)
  }
  // The seed has no removed listing: remove one for the check and put it back with a plain patch (no notification).
  const live = (await one("moderation=approved&status=available"))!
  const moderate = (moderation: string) =>
    get(`/api/admin/listings/${live.id}`, {
      as: admin,
      method: "PATCH",
      body: JSON.stringify({ moderation }),
    })
  await moderate("removed")
  try {
    await hidden(live, "removed")
  } finally {
    await moderate("approved")
  }

  // Wrong words in a slug (Latin or Arabic) redirect to the canonical slug.
  const arabic = locs.find((u) => /\/ar\/listing\/[\u0600-\u06FF]/.test(u))!
  const arabicSlug = arabic.slice(arabic.lastIndexOf("/") + 1)
  for (const [path, to] of [
    [`/en/listing/wrong-words-${live.id}`, `/en/listing/${live.slug}`],
    [
      `/ar/listing/كلمات-خاطئة-${arabicSlug.slice(arabicSlug.lastIndexOf("-") + 1)}`,
      `/ar/listing/${arabicSlug}`,
    ],
  ] as const) {
    const res = await get(encodeURI(path), { redirect: "manual" })
    const at = pathOf(res.headers.get("location"))
    check(res.status === 301 && at === to, `${path}: ${res.status} to ${at}`)
  }

  // Filtered searches, filtered directories and the map: noindex, follow.
  for (const path of [
    "/ar/search?q=test",
    "/en/search?maxPrice=5000000",
    "/en/map",
    "/ar/map",
    "/ar/dealerships?q=a",
    "/en/workshops?verified=true",
    "/ar/vehicles/cars/sale?sort=price_asc",
  ])
    await noindexed(path)
  // A search equal to one landing preset points its canonical at the landing.
  for (const [path, to] of [
    ["/ar/search?type=car&intent=sale", "/ar/vehicles/cars/sale"],
    ["/en/search?type=truck&intent=rent", "/en/vehicles/trucks/rent"],
  ] as const) {
    await noindexed(path)
    const canonical = canonicalOf(tagsOf(await (await get(path)).text()))
    check(canonical === to, `${path} canonical ${canonical}`)
  }
  // Parts have their own path, so `/search?kind=part` redirects there.
  const parts = await get("/en/search?kind=part", { redirect: "manual" })
  const partsAt = pathOf(parts.headers.get("location"))
  check(
    parts.status >= 300 && parts.status < 400 && partsAt === "/en/parts",
    `/en/search?kind=part: ${parts.status} to ${partsAt}`
  )

  // The listing body is in the server HTML: no JavaScript runs in a fetch.
  const html = await (await get(`/en/listing/${live.slug}`)).text()
  const body = unescape(
    html.slice(html.indexOf("<body")).replace(/<[^>]+>/g, " ")
  )
  const h1 = unescape(
    /<h1\b[^>]*>(.*?)<\/h1>/s.exec(html)?.[1]?.replace(/<[^>]+>/g, "") ?? ""
  ).trim()
  const title = unescape(/<title>([^<]+)<\/title>/.exec(html)?.[1] ?? "")
  check(
    h1 !== "" && title.startsWith(h1),
    `listing h1 "${h1}" vs title "${title}"`
  )
  check(
    body.includes(formatNumber(live.price, "en")),
    "listing price not in the server HTML"
  )
  const text = (live.description.en || live.description.ar).slice(0, 40)
  check(
    body.replace(/\s+/g, " ").includes(text.replace(/\s+/g, " ")),
    "listing description not in the server HTML"
  )
}
