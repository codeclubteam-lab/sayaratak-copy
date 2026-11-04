// @vitest-environment node
import { describe, expect, it } from "vitest"

import { robotsTxt, sitemapXml } from "@/lib/sitemap"
import { db } from "@/mocks/db"
import { sitemapEntries } from "@/mocks/sitemap"
import { isPublic } from "@/mocks/search"

describe("sitemap", () => {
  const entries = sitemapEntries()
  const under = (dir: string) =>
    entries.filter((e) => e.path.startsWith(dir)).length
  const available = db.listings.filter(
    (l) => isPublic(l) && l.status === "available"
  )

  it("lists the seed's indexable pages", () => {
    expect(under("/listing/")).toBe(available.length)
    expect(under("/dealerships/")).toBe(
      db.dealerships.filter((d) => d.status === "active").length
    )
    expect(under("/workshops/")).toBe(
      db.workshops.filter((d) => d.status === "active").length
    )
    expect(under("/mechanics/")).toBe(
      db.mechanics.filter((d) => d.status === "active").length
    )
    // 5 types x 2 intents, plus one per city that has a vehicle for it
    const cities = new Set(
      available
        .filter((l) => l.kind === "vehicle")
        .map((l) => `${l.vehicleType}/${l.intent}/${l.cityId}`)
    )
    expect(under("/vehicles/")).toBe(10 + cities.size)
    expect(entries.some((e) => /^\/(search|map)/.test(e.path))).toBe(false)
  })

  it("leaves out a sold or pending listing", () => {
    const hidden = db.listings.filter(
      (l) => l.status === "sold" || l.moderation !== "approved"
    )
    expect(hidden.length).toBeGreaterThan(0)
    const paths = new Set(entries.map((e) => e.path))
    for (const l of hidden) expect(paths.has(`/listing/${l.slug}`)).toBe(false)
  })

  it("writes both locales with alternates and escaped Arabic paths", () => {
    const xml = sitemapXml("https://x.sd", [{ path: "/listing/سيارة-l1" }])
    expect(xml.match(/<url>/g)).toHaveLength(2)
    expect(xml).toContain(
      `<loc>https://x.sd/en/listing/${encodeURI("سيارة-l1")}</loc>`
    )
    expect(xml).toContain('hreflang="x-default" href="https://x.sd/ar/listing/')
    expect(xml.match(/<xhtml:link/g)).toHaveLength(6)
  })

  it("robots.txt blocks the private sections in both locales", () => {
    const txt = robotsTxt("https://x.sd")
    expect(txt).toContain("Disallow: /api/\n")
    expect(txt).toContain("Disallow: /ar/account/\n")
    expect(txt).toContain("Disallow: /en/post$\n")
    // Exact paths, so the public /ar/dealerships and /ar/workshops stay open.
    expect(txt).toContain("Disallow: /ar/dealer$\n")
    expect(txt).not.toMatch(/^Disallow: \/ar\/(dealer|workshop|mechanic)$/m)
    expect(txt).toContain("Sitemap: https://x.sd/sitemap.xml")
  })
})
