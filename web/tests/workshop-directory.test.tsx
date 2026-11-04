import { Suspense, useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkshopProfilePage } from "@/features/directory/components/workshop-profile-page"
import { WorkshopsPage } from "@/features/directory/components/workshops-page"
import { workshopJsonLd } from "@/features/directory/json-ld"
import { useWorkshopNavigation } from "@/features/directory/use-workshop-navigation"
import { workshopHead, workshopsHead } from "@/features/directory/workshop-head"
import {
  workshopProfileRouteSchema,
  workshopProfileSearchSchema,
  workshopRouteSchema,
  workshopSearchSchema,
  type WorkshopSearch,
} from "@/features/directory/workshop-schemas"
import { NowProvider } from "@/lib/now"
import { workshopSchema } from "@sayaratak/shared/schemas/profile"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

// A Tuesday at noon in Khartoum.
const NOW = Date.UTC(2026, 9, 6, 10, 0)
const demo = () => workshopSchema.parse(db.workshops[0])

describe("workshop search params", () => {
  it("bad and default values leave the address, a real value stays", () => {
    expect(
      workshopRouteSchema.parse({ sort: "bogus", page: 1, q: "x" })
    ).toMatchObject({ sort: undefined, page: undefined, q: "x" })
    expect(
      workshopRouteSchema.parse({ openNow: true, service: "s-1", page: 2 })
    ).toMatchObject({ openNow: true, service: "s-1", page: 2 })
    expect(workshopSearchSchema.parse({})).toEqual({ sort: "rating", page: 1 })
  })
  it("nearest and the position only live together", () => {
    expect(workshopSearchSchema.parse({ sort: "nearest" }).sort).toBe("rating")
    expect(
      workshopSearchSchema.parse({ sort: "nearest", lat: "15.5" })
    ).toMatchObject({ sort: "rating", lat: undefined, lng: undefined })
    expect(
      workshopSearchSchema.parse({ sort: "nearest", lat: "15.5", lng: "32.5" })
    ).toMatchObject({ sort: "nearest", lat: 15.5, lng: 32.5 })
  })
  it("the profile tab falls back to services", () => {
    expect(workshopProfileSearchSchema.parse({ tab: "x" }).tab).toBe("services")
    expect(workshopProfileRouteSchema.parse({ tab: "services" }).tab).toBe(
      undefined
    )
    expect(workshopProfileRouteSchema.parse({ tab: "about" }).tab).toBe("about")
  })
})

describe("workshop heads", () => {
  const data = { title: "T", description: "D", locale: "en" as const }
  const robots = (h: { meta: object[] }) =>
    h.meta.find((m) => "name" in m && m.name === "robots")
  const canonical = (h: { links: { rel: string; href: string }[] }) =>
    new URL(h.links.find((l) => l.rel === "canonical")?.href ?? "", "http://x")
      .pathname +
    new URL(h.links.find((l) => l.rel === "canonical")?.href ?? "", "http://x")
      .search
  it("the directory is indexed until a query value other than page appears", () => {
    const plain = workshopSearchSchema.parse({})
    expect(robots(workshopsHead(data, plain))).toBeUndefined()
    expect(canonical(workshopsHead(data, { ...plain, page: 2 }))).toBe(
      "/en/workshops?page=2"
    )
    const near = workshopsHead(
      data,
      workshopSearchSchema.parse({ lat: 15, lng: 32, page: 2 })
    )
    expect(robots(near)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(near)).toBe("/en/workshops")
    expect(
      robots(workshopsHead(data, { ...plain, openNow: true }))
    ).toBeDefined()
  })
  it("each profile tab has its own canonical", () => {
    const d = { ...data, slug: "w" }
    const s = workshopProfileSearchSchema.parse({})
    expect(canonical(workshopHead(d, s))).toBe("/en/workshops/w")
    expect(canonical(workshopHead(d, { tab: "about" }))).toBe(
      "/en/workshops/w?tab=about"
    )
  })
})

describe("workshopJsonLd", () => {
  it("is an AutoRepair with a phone, photos and open days", () => {
    const w = demo()
    const json = workshopJsonLd(w, {
      name: "W",
      description: "D",
      city: "Khartoum",
      url: "https://x/en/workshops/w",
      origin: "https://x",
    })
    expect(json["@type"]).toBe("AutoRepair")
    expect(json.telephone).toBe(w.phone)
    expect(json.openingHoursSpecification).toHaveLength(
      w.hours.filter((h) => !h.closed).length
    )
  })
})

function Directory({ start }: { start: WorkshopSearch }) {
  const [search, setSearch] = useState(start)
  return (
    <WorkshopsPage
      search={search}
      onChange={setSearch}
      onPageChange={(page) => setSearch({ ...search, page })}
      hrefFor={(p) => `?page=${p}`}
    />
  )
}

describe("WorkshopsPage", () => {
  const start = workshopSearchSchema.parse({})
  const cards = () => screen.getAllByRole("heading", { level: 2 }).length
  it("shows the cards, and the empty state has a way out", async () => {
    await renderShell(
      <NowProvider serverNow={NOW}>
        <Directory start={start} />
      </NowProvider>
    )
    expect(
      (await screen.findByRole("heading", { level: 1 })).textContent
    ).toMatch(/Workshops/)
    await waitFor(() => expect(cards()).toBeGreaterThan(5))
    fireEvent.change(screen.getByRole("searchbox", { name: "Workshop name" }), {
      target: { value: "zzzz" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByText("No workshops found")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))
    await waitFor(() =>
      expect(screen.queryByText("No workshops found")).toBeNull()
    )
  })
  it("verified and open now narrow the list", async () => {
    await renderShell(
      <NowProvider serverNow={NOW}>
        <Directory start={start} />
      </NowProvider>
    )
    await waitFor(() => expect(cards()).toBeGreaterThan(5))
    const all = cards()
    fireEvent.click(screen.getByRole("switch", { name: "Verified only" }))
    await waitFor(() => expect(cards()).toBeLessThan(all))
    fireEvent.click(screen.getByRole("switch", { name: "Verified only" }))
    await waitFor(() => expect(cards()).toBe(all))
    fireEvent.click(screen.getByRole("switch", { name: "Open now" }))
    await waitFor(() => expect(cards()).toBeLessThanOrEqual(all))
  })
  it("a service id keeps only the workshops that offer it", async () => {
    const template = db.workshops[0]!.services.find(
      (s) => s.templateId
    )?.templateId
    const offered = db.workshops.filter((w) =>
      w.services.some((s) => s.templateId === template)
    ).length
    expect(template).toBeTruthy()
    await renderShell(
      <NowProvider serverNow={NOW}>
        <Directory start={workshopSearchSchema.parse({ service: template })} />
      </NowProvider>
    )
    await waitFor(() => expect(cards()).toBe(Math.min(offered, 12)))
  })
  it("the Filters button opens a sheet with the filters and shows the result count", async () => {
    await renderShell(
      <NowProvider serverNow={NOW}>
        <Directory start={workshopSearchSchema.parse({ verified: true })} />
      </NowProvider>
    )
    const open = await screen.findByRole("button", { name: /^Filters/ })
    fireEvent.click(open)
    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByRole("switch", { name: "Open now" })).toBeTruthy()
    await waitFor(() =>
      expect(
        within(sheet).getByRole("button", { name: /^Show \d+ results$/ })
      ).toBeTruthy()
    )
    fireEvent.click(within(sheet).getByRole("button", { name: /^Show / }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
  it("Use my location sets the position and the nearest sort, clearing drops both", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: { latitude: 15.5007, longitude: 32.5599 },
      } as GeolocationPosition)
    )
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    })
    await renderShell(
      <NowProvider serverNow={NOW}>
        <Directory start={start} />
      </NowProvider>
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Use my location" })
    )
    expect(
      await screen.findByRole("button", { name: "Clear my location" })
    ).toBeTruthy()
    expect(
      screen.getByRole("combobox", { name: "Sort by" }).textContent
    ).toMatch(/^Nearest/)
    fireEvent.click(screen.getByRole("button", { name: "Clear my location" }))
    expect(
      await screen.findByRole("button", { name: "Use my location" })
    ).toBeTruthy()
    expect(
      screen.getByRole("combobox", { name: "Sort by" }).textContent
    ).toMatch(/^Top rated/)
    vi.unstubAllGlobals()
  })
})

function Nav({ search }: { search: WorkshopSearch }) {
  const nav = useWorkshopNavigation(search)
  return (
    <>
      <button
        onClick={() => nav.onChange({ ...search, q: "x", sort: "rating" })}
      >
        filter
      </button>
      <button onClick={() => nav.onPageChange(2)}>page</button>
      <output>{nav.hrefFor(3)}</output>
    </>
  )
}

describe("useWorkshopNavigation", () => {
  it("writes only non-default values to the address", async () => {
    const { router } = await renderShell(
      <Nav search={workshopSearchSchema.parse({ openNow: true })} />
    )
    const at = () =>
      router.history.location.pathname + router.history.location.search
    fireEvent.click(await screen.findByRole("button", { name: "filter" }))
    await waitFor(() => expect(at()).toBe("/en/workshops?q=x&openNow=true"))
    fireEvent.click(screen.getByRole("button", { name: "page" }))
    await waitFor(() => expect(at()).toContain("page=2"))
    expect(screen.getByRole("status").textContent).toBe(
      "/en/workshops?openNow=true&page=3"
    )
  })
})

const profile = (
  search: Record<string, unknown> = {},
  slug = db.workshops[0]!.slug
) => (
  <NowProvider serverNow={NOW}>
    <Suspense fallback={null}>
      <WorkshopProfilePage
        slug={slug}
        search={workshopProfileSearchSchema.parse(search)}
      />
    </Suspense>
  </NowProvider>
)

describe("WorkshopProfilePage", () => {
  it("a visitor sees the header, contact buttons, three tabs and the service list", async () => {
    await renderShell(profile())
    const w = db.workshops[0]!
    expect(
      await screen.findByRole("heading", { level: 1, name: w.name.en })
    ).toBeTruthy()
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent)
    expect(tabs[0]).toBe("Services")
    expect(tabs[1]).toBe("About")
    expect(tabs[2]).toMatch(/^Reviews \(\d+\)$/)
    expect(
      screen.getAllByRole("button", { name: "Call" }).length
    ).toBeGreaterThan(0)
    const list = screen.getByRole("heading", { level: 2, name: "Services" })
    const rows = within(list.parentElement!).getAllByRole("listitem")
    expect(rows).toHaveLength(w.services.length)
    const priced = w.services.filter((s) => s.priceFrom !== undefined).length
    expect(screen.queryAllByText("From")).toHaveLength(priced)
    expect(
      document.querySelector('script[type="application/ld+json"]')
    ).toBeTruthy()
  })
  it("a call logs a phone_click for the workshop", async () => {
    const id = db.workshops[0]!.id
    const clicks = () =>
      db.events.find((e) => e.targetId === id)?.counts.phone_click ?? 0
    const before = clicks()
    await renderShell(profile())
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Call" }))[0]!
    )
    await waitFor(() => expect(clicks()).toBe(before + 1))
  })
  it("the owner does not get contact buttons on their own profile", async () => {
    await renderShell(profile(), { role: "workshop" })
    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByRole("button", { name: "Call" })).toBeNull()
  })
  it("the tabs write to the address", async () => {
    const { router } = await renderShell(profile())
    fireEvent.click(await screen.findByRole("tab", { name: "About" }))
    await waitFor(() =>
      expect(router.history.location.search).toBe("?tab=about")
    )
  })
  it("About shows photos that open in the viewer, hours with today marked and the address", async () => {
    await renderShell(profile({ tab: "about" }))
    expect(
      await screen.findByRole("heading", { name: "Opening hours" })
    ).toBeTruthy()
    expect(document.querySelectorAll('tr[aria-current="date"]')).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "Address" })).toBeTruthy()
    const photo = screen.getAllByRole("button", {
      name: /^Open photo 1 of/,
    })[0]!
    fireEvent.click(photo)
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })
  it("Reviews mounts the reviews section for the workshop", async () => {
    await renderShell(profile({ tab: "reviews" }))
    expect(await screen.findByRole("heading", { name: "Reviews" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Write a review" })).toBeTruthy()
  })
})
