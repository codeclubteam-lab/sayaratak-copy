import { useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { SearchPage } from "@/features/search/components/search-page"
import { searchHead } from "@/features/search/head"
import {
  landingSearch,
  routeHref,
  searchRoute,
} from "@/features/search/landing"
import {
  compact,
  fullSearch,
  routeSearchSchema,
  searchParamsSchema,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"
import { fill, searchTitle } from "@/features/search/title"
import { useSearchNavigation } from "@/features/search/use-search-navigation"
import enSearch from "@/messages/en/search.json"
import arSearch from "@/messages/ar/search.json"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

const base = searchParamsSchema.parse({})
const find = (s: Partial<SearchParams>): SearchParams => ({ ...base, ...s })

describe("search routes", () => {
  it("a type and an intent make a landing, the city goes in the path", () => {
    const r = searchRoute(
      find({ type: "car", intent: "sale", city: "khartoum", minPrice: 5 })
    )
    expect(r).toMatchObject({ to: "landing", type: "cars", city: "khartoum" })
    expect(routeHref(r)).toBe("/vehicles/cars/sale/khartoum?minPrice=5")
  })
  it("parts live on /parts, anything else on /search, defaults stay out of the URL", () => {
    expect(routeHref(searchRoute(find({ kind: "part", q: "brake" })))).toBe(
      "/parts?q=brake"
    )
    expect(routeHref(searchRoute(find({ type: "car" })))).toBe(
      "/search?type=car"
    )
    expect(compact(find({ page: 1 }))).toEqual({})
    expect(compact(find({ page: 3, sort: "newest" }))).toEqual({
      page: 3,
      sort: "newest",
    })
  })
  it("route validation drops bad and default values, so the router cleans the address", () => {
    const parsed = routeSearchSchema.parse({
      sort: "bogus",
      page: 0,
      kind: "vehicle",
      minPrice: "abc",
      q: "hilux",
    })
    expect(parsed).toMatchObject({
      sort: undefined,
      page: undefined,
      kind: undefined,
      minPrice: undefined,
      q: "hilux",
    })
    expect(fullSearch(parsed, "part")).toMatchObject({
      kind: "part",
      sort: "relevance",
      page: 1,
    })
  })
  it("landingSearch turns the path into filters and refuses unknown segments", () => {
    expect(
      landingSearch({ type: "tuk-tuks", intent: "rent" }, base)
    ).toMatchObject({ kind: "vehicle", type: "tuk_tuk", intent: "rent" })
    expect(landingSearch({ type: "boats", intent: "sale" }, base)).toBe(
      undefined
    )
    expect(landingSearch({ type: "cars", intent: "swap" }, base)).toBe(
      undefined
    )
  })
})

describe("searchTitle", () => {
  const tax = () => structuredClone(db.taxonomy)
  const t =
    (messages: Record<string, string>) =>
    (key: string, v?: Record<string, string>) =>
      fill(messages[key] ?? key, v)
  it("reads like the heading in the plan, in both languages", () => {
    const s = find({ type: "car", intent: "sale", city: "khartoum" })
    expect(searchTitle(s, tax(), "en", t(enSearch))).toBe(
      "Cars for sale in Khartoum"
    )
    expect(searchTitle(s, tax(), "ar", t(arSearch))).toBe(
      "سيارات للبيع في الخرطوم"
    )
    expect(searchTitle(find({ kind: "part" }), tax(), "en", t(enSearch))).toBe(
      "Spare parts"
    )
    expect(searchTitle(find({}), tax(), "en", t(enSearch))).toBe("Vehicles")
  })
})

describe("searchHead", () => {
  const data = { title: "T", description: "D", locale: "en" as const }
  const robots = (h: ReturnType<typeof searchHead>) =>
    h.meta.find((m) => "name" in m && m.name === "robots")
  const canonical = (h: ReturnType<typeof searchHead>) => {
    const href = h.links.find((l) => l.rel === "canonical")?.href
    return href && new URL(href).pathname + new URL(href).search
  }
  it("/search with no query and page 1 is indexed, page 2 has its own canonical", () => {
    const one = searchHead(data, base, "/search", [])
    expect(robots(one)).toBeUndefined()
    expect(canonical(one)).toBe("/en/search")
    expect(canonical(searchHead(data, find({ page: 2 }), "/search", []))).toBe(
      "/en/search?page=2"
    )
  })
  it("any filter is noindex, and a preset-equivalent search points at its landing", () => {
    const filtered = searchHead(data, find({ minPrice: 5 }), "/search", [])
    expect(robots(filtered)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(filtered)).toBe("/en/search")
    const preset = searchHead(
      data,
      find({ type: "car", intent: "sale", city: "khartoum" }),
      "/search",
      []
    )
    expect(robots(preset)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(preset)).toBe("/en/vehicles/cars/sale/khartoum")
  })
  it("a landing is indexed until a query value appears, then its canonical stays", () => {
    const s = find({ type: "car", intent: "sale", kind: "vehicle" })
    const path = "/vehicles/cars/sale"
    const held = ["kind", "type", "intent"]
    expect(robots(searchHead(data, s, path, held))).toBeUndefined()
    const filtered = searchHead(data, { ...s, maxPrice: 9 }, path, held)
    expect(robots(filtered)).toMatchObject({ content: "noindex, follow" })
    expect(canonical(filtered)).toBe("/en/vehicles/cars/sale")
  })
  it("a landing built by the route (city key set to undefined) is indexed", () => {
    const s = landingSearch({ type: "cars", intent: "sale" }, find({}))!
    const head = searchHead(data, s, "/vehicles/cars/sale", [
      "kind",
      "type",
      "intent",
    ])
    expect(robots(head)).toBeUndefined()
    expect(canonical(head)).toBe("/en/vehicles/cars/sale")
  })
})

function Nav({ search }: { search: SearchParams }) {
  const nav = useSearchNavigation(search)
  return (
    <>
      <button
        onClick={() =>
          nav.onChange(
            find({ type: "car", intent: "sale", city: "omdurman", minPrice: 7 })
          )
        }
      >
        to landing
      </button>
      <button onClick={() => nav.onChange(find({ minPrice: 7 }))}>
        to search
      </button>
      <button onClick={() => nav.onChange(find({ kind: "part" }))}>
        to parts
      </button>
      <button onClick={() => nav.onPageChange(2)}>page</button>
      <output>{nav.hrefFor(3)}</output>
    </>
  )
}

describe("useSearchNavigation", () => {
  it("moves between /search, the landing and /parts as the filters change", async () => {
    const { router } = await renderShell(<Nav search={find({ type: "car" })} />)
    const at = () =>
      router.history.location.pathname + router.history.location.search
    fireEvent.click(await screen.findByRole("button", { name: "to landing" }))
    await waitFor(() =>
      expect(at()).toBe("/en/vehicles/cars/sale/omdurman?minPrice=7")
    )
    fireEvent.click(screen.getByRole("button", { name: "to search" }))
    await waitFor(() => expect(at()).toBe("/en/search?minPrice=7"))
    fireEvent.click(screen.getByRole("button", { name: "to parts" }))
    await waitFor(() => expect(at()).toBe("/en/parts"))
    fireEvent.click(screen.getByRole("button", { name: "page" }))
    await waitFor(() => expect(at()).toContain("page=2"))
    expect(screen.getByRole("status").textContent).toBe(
      "/en/search?page=3&type=car"
    )
  })
})

function Harness({ start }: { start: SearchParams }) {
  const [search, setSearch] = useState(start)
  return (
    <SearchPage
      search={search}
      onChange={setSearch}
      onPageChange={(page) => setSearch({ ...search, page })}
      hrefFor={(p) => `?page=${p}`}
    />
  )
}

describe("SearchPage", () => {
  const start = find({ type: "car", intent: "sale", city: "khartoum" })
  it("shows the title, count, cards, chips and numbered pages", async () => {
    await renderShell(<Harness start={start} />)
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Cars for sale in Khartoum",
      })
    ).toBeTruthy()
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(5)
    )
    expect(screen.getByText(/\d+ listings?/)).toBeTruthy()
    const chips = screen.getByRole("list", { name: "Active filters" })
    expect(
      within(chips).getByRole("button", { name: "Remove Khartoum" })
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Go to page 2" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Show on map" }).getAttribute("href")
    ).toMatch(/^\/en\/map\?/)
  })
  it("sort, view and keyword update the results", async () => {
    await renderShell(<Harness start={find({})} />)
    await pick(await screen.findByLabelText("Sort by"), "Price: low to high")
    fireEvent.click(screen.getByRole("button", { name: "List view" }))
    expect(document.cookie).toContain("listing_view=row")
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Search by make, model or keyword",
      }),
      {
        target: { value: "zzzz" },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(
      await screen.findByText("No listings match these filters")
    ).toBeTruthy()
    const list = screen.getByRole("list", { name: "Active filters" })
    expect(
      within(list).getByRole("button", { name: "Remove zzzz" })
    ).toBeTruthy()
    fireEvent.click(within(list).getByRole("button", { name: "Remove zzzz" }))
    await waitFor(() =>
      expect(screen.queryByText("No listings match these filters")).toBeNull()
    )
  })
  it("an empty search offers the filters to loosen, with counts", async () => {
    await renderShell(<Harness start={find({ type: "car", maxPrice: 1 })} />)
    expect(
      await screen.findByText("No listings match these filters")
    ).toBeTruthy()
    const remove = await screen.findByRole("button", {
      name: /^Remove .* \(\d+\)$/,
    })
    fireEvent.click(remove)
    await waitFor(() =>
      expect(screen.queryByText("No listings match these filters")).toBeNull()
    )
  })
})
