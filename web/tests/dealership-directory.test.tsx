import { Suspense, useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DealershipProfilePage } from "@/features/directory/components/dealership-profile-page"
import { DealershipsPage } from "@/features/directory/components/dealerships-page"
import { dealershipHead, dealershipsHead } from "@/features/directory/head"
import { dealershipJsonLd } from "@/features/directory/json-ld"
import {
  dealershipProfileRouteSchema,
  dealershipProfileSearchSchema,
  dealershipRouteSchema,
  dealershipSearchSchema,
  inventorySearch,
  type DealershipSearch,
} from "@/features/directory/schemas"
import { useDealershipNavigation } from "@/features/directory/use-dealership-navigation"
import { NowProvider } from "@/lib/now"
import { dealershipSchema } from "@sayaratak/shared/schemas/profile"
import { HoursTable } from "@/components/app/hours-table"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

// A Tuesday at noon in Khartoum.
const NOW = Date.UTC(2026, 9, 6, 10, 0)
const demo = () =>
  dealershipSchema.parse({ ...db.dealerships[0], inventoryCount: 0 })

describe("dealership search params", () => {
  it("bad and default values leave the address, a real value stays", () => {
    expect(
      dealershipRouteSchema.parse({ sort: "bogus", page: 1, q: "nasr" })
    ).toMatchObject({ sort: undefined, page: undefined, q: "nasr" })
    expect(
      dealershipRouteSchema.parse({ sort: "listings", verified: true, page: 2 })
    ).toMatchObject({ sort: "listings", verified: true, page: 2 })
    expect(dealershipSearchSchema.parse({})).toEqual({
      sort: "rating",
      page: 1,
    })
  })
  it("the profile keeps its own filters and a tab, and scopes the inventory to the owner", () => {
    const route = dealershipProfileRouteSchema.parse({
      tab: "inventory",
      sort: "relevance",
      type: "car",
      fuel: ["petrol"],
    })
    expect(route).toMatchObject({
      tab: undefined,
      sort: undefined,
      type: "car",
    })
    expect(route).not.toHaveProperty("fuel")
    const full = dealershipProfileSearchSchema.parse({ type: "car", page: 2 })
    expect(inventorySearch(full, "u-9")).toMatchObject({
      kind: "vehicle",
      type: "car",
      page: 2,
      seller: "u-9",
    })
    expect(inventorySearch(full, "u-9")).not.toHaveProperty("tab")
  })
})

describe("dealership heads", () => {
  const data = { title: "T", description: "D", locale: "en" as const }
  const robots = (h: { meta: object[] }) =>
    h.meta.find((m) => "name" in m && m.name === "robots")
  const canonical = (h: { links: { rel: string; href: string }[] }) => {
    const href = h.links.find((l) => l.rel === "canonical")?.href ?? ""
    return new URL(href, "http://x").pathname + new URL(href, "http://x").search
  }
  it("the directory is indexed until a query value other than page appears", () => {
    const plain = dealershipSearchSchema.parse({})
    expect(robots(dealershipsHead(data, plain))).toBeUndefined()
    expect(canonical(dealershipsHead(data, { ...plain, page: 2 }))).toBe(
      "/en/dealerships?page=2"
    )
    const filtered = dealershipsHead(data, { ...plain, q: "a", page: 2 })
    expect(robots(filtered)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(filtered)).toBe("/en/dealerships")
    expect(
      robots(dealershipsHead(data, { ...plain, sort: "newest" }))
    ).toBeDefined()
  })
  it("a profile tab has its canonical, an inventory filter makes it noindex", () => {
    const d = { ...data, slug: "al-nasr-motors" }
    const s = dealershipProfileSearchSchema.parse({})
    expect(canonical(dealershipHead(d, s))).toBe(
      "/en/dealerships/al-nasr-motors"
    )
    const about = dealershipHead(d, { ...s, tab: "about" })
    expect(canonical(about)).toBe("/en/dealerships/al-nasr-motors?tab=about")
    expect(robots(about)).toBeUndefined()
    const filtered = dealershipHead(d, { ...s, type: "car", page: 2 })
    expect(robots(filtered)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(filtered)).toBe("/en/dealerships/al-nasr-motors")
  })
})

describe("dealershipJsonLd", () => {
  const info = {
    name: "Al Nasr",
    description: "D",
    city: "Khartoum",
    url: "https://x/en/dealerships/al-nasr-motors",
    origin: "https://x",
  }
  it("is an AutoDealer with open days only and a rating once reviewed", () => {
    const d = demo()
    const none = dealershipJsonLd(
      { ...d, rating: { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] } },
      info
    )
    expect(none["@type"]).toBe("AutoDealer")
    expect(none).not.toHaveProperty("aggregateRating")
    const open = d.hours.filter((h) => !h.closed).length
    expect(none.openingHoursSpecification).toHaveLength(open)
    expect(none.address).toMatchObject({
      addressLocality: "Khartoum",
      addressCountry: "SD",
    })
    const rated = dealershipJsonLd(
      { ...d, rating: { avg: 4.5, count: 3, distribution: [0, 0, 0, 1, 2] } },
      info
    )
    expect(rated.aggregateRating).toMatchObject({
      ratingValue: 4.5,
      reviewCount: 3,
    })
  })
})

describe("HoursTable", () => {
  // NowProvider swaps in Date.now() after mount, so the test freezes Date and leaves timers alone.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it("lists the week from Saturday and marks today on the Khartoum clock", async () => {
    const hours = demo().hours.map((h) => ({ ...h, closed: h.day === 5 }))
    await renderShell(
      <NowProvider serverNow={NOW}>
        <HoursTable hours={hours} />
      </NowProvider>
    )
    const rows = screen.getAllByRole("row")
    expect(rows).toHaveLength(7)
    expect(within(rows[0]!).getByText("Saturday")).toBeTruthy()
    expect(within(rows[6]!).getByText("Closed")).toBeTruthy()
    const today = rows.filter((r) => r.getAttribute("aria-current") === "date")
    expect(today).toHaveLength(1)
    expect(within(today[0]!).getByText("Tuesday")).toBeTruthy()
  })
})

function Directory({ start }: { start: DealershipSearch }) {
  const [search, setSearch] = useState(start)
  return (
    <DealershipsPage
      search={search}
      onChange={setSearch}
      onPageChange={(page) => setSearch({ ...search, page })}
      hrefFor={(p) => `?page=${p}`}
    />
  )
}

describe("DealershipsPage", () => {
  const start = dealershipSearchSchema.parse({})
  it("shows the count, the cards and the empty state with a way out", async () => {
    await renderShell(
      <NowProvider serverNow={NOW}>
        <Directory start={start} />
      </NowProvider>
    )
    const h1 = await screen.findByRole("heading", { level: 1 })
    expect(h1.textContent).toMatch(/Dealerships/)
    await waitFor(() =>
      expect(
        screen.getAllByRole("heading", { level: 2 }).length
      ).toBeGreaterThan(5)
    )
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Dealership name" }),
      {
        target: { value: "zzzz" },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByText("No dealerships found")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))
    await waitFor(() =>
      expect(screen.queryByText("No dealerships found")).toBeNull()
    )
  })
  it("the verified switch narrows the list and the sort is a real option", async () => {
    await renderShell(<Directory start={start} />)
    await screen.findAllByRole("heading", { level: 2 })
    const all = screen.getAllByRole("heading", { level: 2 }).length
    fireEvent.click(screen.getByRole("switch", { name: "Verified only" }))
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 2 }).length).toBeLessThan(
        all
      )
    )
    expect(screen.getAllByText("Verified").length).toBe(
      screen.getAllByRole("heading", { level: 2 }).length
    )
  })
})

function Nav({ search }: { search: DealershipSearch }) {
  const nav = useDealershipNavigation(search)
  return (
    <>
      <button
        onClick={() => nav.onChange({ ...search, q: "nasr", sort: "rating" })}
      >
        filter
      </button>
      <button onClick={() => nav.onPageChange(2)}>page</button>
      <output>{nav.hrefFor(3)}</output>
    </>
  )
}

describe("useDealershipNavigation", () => {
  it("writes only non-default values to the address", async () => {
    const { router } = await renderShell(
      <Nav search={dealershipSearchSchema.parse({ verified: true })} />
    )
    const at = () =>
      router.history.location.pathname + router.history.location.search
    fireEvent.click(await screen.findByRole("button", { name: "filter" }))
    await waitFor(() =>
      expect(at()).toBe("/en/dealerships?q=nasr&verified=true")
    )
    fireEvent.click(screen.getByRole("button", { name: "page" }))
    await waitFor(() => expect(at()).toContain("page=2"))
    expect(screen.getByRole("status").textContent).toBe(
      "/en/dealerships?verified=true&page=3"
    )
  })
})

const profile = (
  search: Record<string, unknown> = {},
  slug = db.dealerships[0]!.slug
) => (
  <NowProvider serverNow={NOW}>
    <Suspense fallback={null}>
      <DealershipProfilePage
        slug={slug}
        search={dealershipProfileSearchSchema.parse(search)}
      />
    </Suspense>
  </NowProvider>
)

describe("DealershipProfilePage", () => {
  it("a visitor sees the header, contact buttons, three tabs and the dealership's own listings", async () => {
    await renderShell(profile())
    const name = db.dealerships[0]!.name.en
    expect(await screen.findByRole("heading", { level: 1, name })).toBeTruthy()
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent)
    expect(tabs[0]).toBe("Vehicles")
    expect(tabs[1]).toBe("About")
    expect(tabs[2]).toMatch(/^Reviews \(\d+\)$/)
    expect(
      screen.getAllByRole("button", { name: "Call" }).length
    ).toBeGreaterThan(0)
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Vehicles for sale and rent",
      })
    ).toBeTruthy()
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(5)
    )
    // Only the type, price and year blocks: the profile address cannot hold the others.
    expect(screen.getByText("Vehicle type")).toBeTruthy()
    expect(screen.queryByText("Fuel type")).toBeNull()
    expect(screen.queryByText("Condition")).toBeNull()
    expect(
      document.querySelector('script[type="application/ld+json"]')
    ).toBeTruthy()
  })
  it("a banned owner's profile shows a notice, no contact and no JSON-LD", async () => {
    const d = db.dealerships[0]!
    db.users.find((u) => u.id === d.ownerId)!.banned = true
    await renderShell(profile())
    expect(
      await screen.findByRole("heading", {
        name: "Not taking enquiries right now",
      })
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Browse other dealerships" })
    ).toHaveProperty("href", expect.stringContaining("/en/dealerships"))
    expect(screen.queryByRole("button", { name: "Call" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull()
    const ld = [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].map((el) => el.textContent)
    expect(ld.some((json) => json.includes("AutoDealer"))).toBe(false)
  })
  it("the owner does not get contact buttons on their own profile", async () => {
    await renderShell(profile(), { role: "dealership" })
    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByRole("button", { name: "Call" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull()
  })
  it("the tabs write to the address", async () => {
    const { router } = await renderShell(profile())
    fireEvent.click(await screen.findByRole("tab", { name: "About" }))
    await waitFor(() =>
      expect(router.history.location.search).toBe("?tab=about")
    )
  })
  it("About shows the hours with today marked, the address and the numbers", async () => {
    await renderShell(profile({ tab: "about" }))
    expect(
      await screen.findByRole("heading", { name: "Opening hours" })
    ).toBeTruthy()
    expect(document.querySelectorAll('tr[aria-current="date"]')).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "Address" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /\+249/ })).toBeTruthy()
  })
  it("Reviews mounts the reviews section for the dealership", async () => {
    await renderShell(profile({ tab: "reviews" }))
    expect(await screen.findByRole("heading", { name: "Reviews" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Write a review" })).toBeTruthy()
  })
})
