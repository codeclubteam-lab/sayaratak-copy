import { expect, it } from "vitest"

import { buildHead } from "@/lib/seo"
import { makeListingSlug, parseListingId } from "@sayaratak/shared/lib/slug"

it("builds Latin and Arabic slugs and reads the id back", () => {
  expect(makeListingSlug("Toyota Hilux 2019", "Khartoum", "k3f9a2")).toBe(
    "toyota-hilux-2019-khartoum-k3f9a2"
  )
  // harakat and tatweel removed, Arabic-Indic digits converted, symbols collapsed
  expect(makeListingSlug("تَويوتا هايلكس ٢٠١٩ !!", "الخرطـوم", "k3f9a2")).toBe(
    "تويوتا-هايلكس-2019-الخرطوم-k3f9a2"
  )
  expect(makeListingSlug("???", "", "k3f9a2")).toBe("k3f9a2")
  const long = makeListingSlug("a".repeat(100), "b", "k3f9a2")
  expect(long).toBe(`${"a".repeat(60)}-k3f9a2`)
  expect(parseListingId("toyota-hilux-2019-khartoum-k3f9a2")).toBe("k3f9a2")
  expect(parseListingId("k3f9a2")).toBe("k3f9a2")
})

it("builds head tags with hreflang and noindex", () => {
  const { meta, links } = buildHead({
    title: "Search",
    path: "/ar/search",
    locale: "ar",
    noindex: true,
  })
  const hrefs = links.map((l) => l.href)
  expect(hrefs).toEqual([
    "http://localhost:3000/ar/search",
    "http://localhost:3000/ar/search",
    "http://localhost:3000/en/search",
    "http://localhost:3000/ar/search",
  ])
  expect(meta).toContainEqual({ name: "robots", content: "noindex, follow" })
  expect(meta[0]).toEqual({ title: "Search | Sayaratak" })
  expect(
    buildHead({ title: "Home", path: "/en/", locale: "en" }).links[0]?.href
  ).toBe("http://localhost:3000/en")
})
