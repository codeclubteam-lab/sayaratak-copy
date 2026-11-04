import { Suspense, useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { MechanicProfilePage } from "@/features/directory/components/mechanic-profile-page"
import { MechanicsPage } from "@/features/directory/components/mechanics-page"
import { mechanicJsonLd } from "@/features/directory/json-ld"
import { mechanicHead, mechanicsHead } from "@/features/directory/mechanic-head"
import {
  mechanicProfileRouteSchema,
  mechanicProfileSearchSchema,
  mechanicRouteSchema,
  mechanicSearchSchema,
  type MechanicSearch,
} from "@/features/directory/mechanic-schemas"
import { useMechanicNavigation } from "@/features/directory/use-mechanic-navigation"
import { mechanicSchema } from "@sayaratak/shared/schemas/profile"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

const demo = () => mechanicSchema.parse(db.mechanics[0])

describe("mechanic search params", () => {
  it("bad and default values leave the address, a real value stays", () => {
    expect(
      mechanicRouteSchema.parse({ sort: "bogus", page: 1, q: "x" })
    ).toMatchObject({ sort: undefined, page: undefined, q: "x" })
    expect(
      mechanicRouteSchema.parse({ minYears: 5, available: true, page: 2 })
    ).toMatchObject({ minYears: 5, available: true, page: 2 })
    expect(mechanicSearchSchema.parse({})).toEqual({ sort: "rating", page: 1 })
  })
  it("minYears is 3, 5 or 10, anything else is dropped", () => {
    expect(mechanicSearchSchema.parse({ minYears: "10" }).minYears).toBe(10)
    expect(mechanicSearchSchema.parse({ minYears: 4 }).minYears).toBe(undefined)
    expect(mechanicSearchSchema.parse({ minYears: "x" }).minYears).toBe(
      undefined
    )
  })
  it("the profile tab falls back to work", () => {
    expect(mechanicProfileSearchSchema.parse({ tab: "x" }).tab).toBe("work")
    expect(mechanicProfileRouteSchema.parse({ tab: "work" }).tab).toBe(
      undefined
    )
    expect(mechanicProfileRouteSchema.parse({ tab: "reviews" }).tab).toBe(
      "reviews"
    )
  })
})

describe("mechanic heads", () => {
  const data = { title: "T", description: "D", locale: "en" as const }
  const robots = (h: { meta: object[] }) =>
    h.meta.find((m) => "name" in m && m.name === "robots")
  const canonical = (h: { links: { rel: string; href: string }[] }) => {
    const url = new URL(
      h.links.find((l) => l.rel === "canonical")?.href ?? "",
      "http://x"
    )
    return url.pathname + url.search
  }
  it("the directory is indexed until a query value other than page appears", () => {
    const plain = mechanicSearchSchema.parse({})
    expect(robots(mechanicsHead(data, plain))).toBeUndefined()
    expect(canonical(mechanicsHead(data, { ...plain, page: 2 }))).toBe(
      "/en/mechanics?page=2"
    )
    const filtered = mechanicsHead(data, { ...plain, minYears: 5, page: 2 })
    expect(robots(filtered)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(filtered)).toBe("/en/mechanics")
    expect(
      robots(mechanicsHead(data, { ...plain, available: true }))
    ).toBeDefined()
  })
  it("each profile tab has its own canonical", () => {
    const d = { ...data, slug: "m" }
    expect(canonical(mechanicHead(d, { tab: "work" }))).toBe("/en/mechanics/m")
    expect(canonical(mechanicHead(d, { tab: "about" }))).toBe(
      "/en/mechanics/m?tab=about"
    )
  })
})

describe("mechanicJsonLd", () => {
  it("is a Person with a job title, a phone and the cities served", () => {
    const m = demo()
    const json = mechanicJsonLd(m, {
      name: "M",
      description: "D",
      jobTitle: "Auto mechanic",
      city: "Bahri",
      served: ["Bahri", "Khartoum"],
      url: "https://x/en/mechanics/m",
      origin: "https://x",
    })
    expect(json["@type"]).toBe("Person")
    expect(json.jobTitle).toBe("Auto mechanic")
    expect(json.telephone).toBe(m.phone)
    expect(json.areaServed).toHaveLength(2)
  })
})

function Directory({ start }: { start: MechanicSearch }) {
  const [search, setSearch] = useState(start)
  return (
    <MechanicsPage
      search={search}
      onChange={setSearch}
      onPageChange={(page) => setSearch({ ...search, page })}
      hrefFor={(p) => `?page=${p}`}
    />
  )
}

describe("MechanicsPage", () => {
  const start = mechanicSearchSchema.parse({})
  const cards = () => screen.getAllByRole("heading", { level: 2 }).length
  const total = (pred: (m: (typeof db.mechanics)[number]) => boolean) =>
    Math.min(
      db.mechanics.filter((m) => m.status === "active" && pred(m)).length,
      12
    )
  it("shows the cards, and the empty state has a way out", async () => {
    await renderShell(<Directory start={start} />)
    expect(
      (await screen.findByRole("heading", { level: 1 })).textContent
    ).toMatch(/Mechanics/)
    await waitFor(() => expect(cards()).toBeGreaterThan(5))
    fireEvent.change(screen.getByRole("searchbox", { name: "Mechanic name" }), {
      target: { value: "zzzz" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(await screen.findByText("No mechanics found")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))
    await waitFor(() =>
      expect(screen.queryByText("No mechanics found")).toBeNull()
    )
  })
  it("verified and available narrow the list", async () => {
    await renderShell(<Directory start={start} />)
    await waitFor(() => expect(cards()).toBeGreaterThan(5))
    const all = cards()
    fireEvent.click(screen.getByRole("switch", { name: "Verified only" }))
    await waitFor(() => expect(cards()).toBe(total((m) => m.verified)))
    expect(cards()).toBeLessThan(all)
    fireEvent.click(screen.getByRole("switch", { name: "Verified only" }))
    await waitFor(() => expect(cards()).toBe(all))
    fireEvent.click(screen.getByRole("switch", { name: "Available for work" }))
    await waitFor(() => expect(cards()).toBe(total((m) => m.available)))
  })
  it("a specialization and a minimum of years keep only matching mechanics", async () => {
    const spec = db.mechanics[0]!.specializationIds[0]!
    await renderShell(
      <Directory
        start={mechanicSearchSchema.parse({
          specialization: spec,
          minYears: 5,
        })}
      />
    )
    await waitFor(() =>
      expect(cards()).toBe(
        total(
          (m) => m.specializationIds.includes(spec) && m.yearsOfExperience >= 5
        )
      )
    )
  })
  it("a city matches the home city or any served city", async () => {
    const m = db.mechanics.find((x) => x.servedCityIds.length > 1)!
    const other = m.servedCityIds.find((id) => id !== m.cityId)!
    await renderShell(
      <Directory start={mechanicSearchSchema.parse({ city: other })} />
    )
    await waitFor(() =>
      expect(cards()).toBe(total((x) => x.servedCityIds.includes(other)))
    )
  })
  it("sorting by experience puts the most experienced first", async () => {
    const top = Math.max(...db.mechanics.map((m) => m.yearsOfExperience))
    const first = db.mechanics.find((m) => m.yearsOfExperience === top)!
    await renderShell(
      <Directory start={mechanicSearchSchema.parse({ sort: "experience" })} />
    )
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 2 })[0]?.textContent).toBe(
        first.name.en
      )
    )
  })
  it("the Filters button opens a sheet with the filters and shows the result count", async () => {
    await renderShell(
      <Directory start={mechanicSearchSchema.parse({ verified: true })} />
    )
    fireEvent.click(await screen.findByRole("button", { name: /^Filters/ }))
    const sheet = await screen.findByRole("dialog")
    expect(
      within(sheet).getByRole("switch", { name: "Available for work" })
    ).toBeTruthy()
    await waitFor(() =>
      expect(
        within(sheet).getByRole("button", { name: /^Show \d+ results$/ })
      ).toBeTruthy()
    )
  })
})

function Nav({ search }: { search: MechanicSearch }) {
  const nav = useMechanicNavigation(search)
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

describe("useMechanicNavigation", () => {
  it("writes only non-default values to the address", async () => {
    const { router } = await renderShell(
      <Nav search={mechanicSearchSchema.parse({ available: true })} />
    )
    const at = () =>
      router.history.location.pathname + router.history.location.search
    fireEvent.click(await screen.findByRole("button", { name: "filter" }))
    await waitFor(() => expect(at()).toBe("/en/mechanics?q=x&available=true"))
    fireEvent.click(screen.getByRole("button", { name: "page" }))
    await waitFor(() => expect(at()).toContain("page=2"))
    expect(screen.getByRole("status").textContent).toBe(
      "/en/mechanics?available=true&page=3"
    )
  })
})

const profile = (
  search: Record<string, unknown> = {},
  slug = db.mechanics[0]!.slug
) => (
  <Suspense fallback={null}>
    <MechanicProfilePage
      slug={slug}
      search={mechanicProfileSearchSchema.parse(search)}
    />
  </Suspense>
)

describe("MechanicProfilePage", () => {
  it("a visitor sees the header, contact buttons, specializations and three tabs", async () => {
    await renderShell(profile())
    const m = db.mechanics[0]!
    expect(
      await screen.findByRole("heading", { level: 1, name: m.name.en })
    ).toBeTruthy()
    expect(
      screen.getByText(`${m.yearsOfExperience} years of experience`)
    ).toBeTruthy()
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent)
    expect(tabs[0]).toBe("Work")
    expect(tabs[1]).toBe("About")
    expect(tabs[2]).toMatch(/^Reviews \(\d+\)$/)
    expect(
      screen.getAllByRole("button", { name: "Call" }).length
    ).toBeGreaterThan(0)
    const chips = await screen.findByRole("list", { name: "Specializations" })
    expect(within(chips).getAllByRole("listitem")).toHaveLength(
      m.specializationIds.length
    )
    expect(
      document.querySelector('script[type="application/ld+json"]')
    ).toBeTruthy()
  })
  it("the availability badge follows the mechanic's setting", async () => {
    const m = db.mechanics[0]!
    m.available = true
    const first = await renderShell(profile())
    expect(await screen.findByText("Available for work")).toBeTruthy()
    first.unmount()
    m.available = false
    await renderShell(profile())
    expect(await screen.findByText("Not taking work now")).toBeTruthy()
  })
  it("a portfolio photo shows its caption and opens it in the viewer", async () => {
    const m = db.mechanics[0]!
    await renderShell(profile())
    const open = (
      await screen.findAllByRole("button", { name: /^Open photo 1 of/ })
    )[0]!
    expect(screen.getAllByText(m.portfolio[0]!.caption).length).toBeGreaterThan(
      0
    )
    fireEvent.click(open)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(m.portfolio[0]!.caption)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }))
    expect(
      await within(dialog).findByText(m.portfolio[1]!.caption)
    ).toBeTruthy()
  })
  it("a mechanic without work photos says so", async () => {
    db.mechanics[0]!.portfolio = []
    await renderShell(profile())
    expect(
      await screen.findByText(
        "This mechanic has not added photos of their work yet."
      )
    ).toBeTruthy()
  })
  it("a call logs a phone_click for the mechanic", async () => {
    const id = db.mechanics[0]!.id
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
    await renderShell(profile(), { role: "mechanic" })
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
  it("About shows the bio and the cities served", async () => {
    await renderShell(profile({ tab: "about" }))
    expect(
      await screen.findByRole("heading", { name: "Cities served" })
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "About" })).toBeTruthy()
  })
  it("Reviews mounts the reviews section for the mechanic", async () => {
    await renderShell(profile({ tab: "reviews" }))
    expect(await screen.findByRole("heading", { name: "Reviews" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Write a review" })).toBeTruthy()
  })
})
