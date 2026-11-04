import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { toast } from "@/components/ui/toast"
import { FavoritesPage } from "@/features/favorites/components/favorites-page"
import {
  favoritesSearchSchema,
  pruneFavoritesSearch,
} from "@/features/favorites/schemas"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  vi.restoreAllMocks()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  // Every favorite of the person starts open to the public: approved, available, a car.
  for (const l of saved()) {
    l.moderation = "approved"
    l.status = "available"
    l.kind = "vehicle"
    l.vehicleType = "car"
  }
})

const me = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const rows = () => db.favorites.filter((f) => f.userId === me().id)
const saved = () =>
  rows().map((f) => db.listings.find((l) => l.id === f.listingId)!)
// Slugs hold Arabic letters, so hrefs are compared decoded.
const hrefOf = (a: Element) => decodeURIComponent(a.getAttribute("href")!)
const link = (id: string) =>
  [...document.querySelectorAll("li article h3 a")].find(
    (a) =>
      hrefOf(a) === `/en/listing/${db.listings.find((l) => l.id === id)!.slug}`
  ) ?? null
const cardOf = async (id: string) => {
  await waitFor(() => expect(link(id)).toBeTruthy())
  return link(id)!.closest("article")!
}
// Listing ids in the order the grid shows them.
const shown = () =>
  [...document.querySelectorAll("li article h3 a")].map(
    (a) => db.listings.find((l) => hrefOf(a).endsWith(`/${l.slug}`))!.id
  )

const open = (search = "") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <FavoritesPage />
    </NowProvider>,
    { role: "user", path: `/en/account/favorites${search}` }
  )

describe("search params", () => {
  it("keep only what differs from the defaults", () => {
    expect(pruneFavoritesSearch(favoritesSearchSchema.parse({}))).toEqual({})
    expect(
      pruneFavoritesSearch(
        favoritesSearchSchema.parse({
          type: "truck",
          sort: "price_asc",
          page: "2",
        })
      )
    ).toEqual({ type: "truck", sort: "price_asc", page: 2 })
    expect(
      favoritesSearchSchema.parse({ type: "x", sort: "x", page: "0" })
    ).toEqual({ type: undefined, sort: "recent", page: 1 })
  })
})

describe("FavoritesPage", () => {
  it("lists the saved listings, newest save first, with the count", async () => {
    await open()
    const expected = [...rows()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((f) => f.listingId)
    await cardOf(expected[0]!)
    expect(shown()).toEqual(expected)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      `(${rows().length})`
    )
  })

  it("removes a listing at once from the heart, and Undo brings it back", async () => {
    const add = vi.spyOn(toast, "add")
    await open()
    const id = rows()[0]!.listingId
    fireEvent.click(
      within(await cardOf(id)).getByRole("button", {
        name: "Save to favorites",
      })
    )
    await waitFor(() => expect(link(id)).toBeNull())
    await waitFor(() =>
      expect(db.favorites.some((f) => f.listingId === id)).toBe(false)
    )
    const options = add.mock.calls[0]![0]
    expect(options.title).toBe("Removed from favorites")
    options.actionProps!.onClick!({} as never)
    await cardOf(id)
    expect(db.favorites.some((f) => f.listingId === id)).toBe(true)
  })

  it("shows a sold listing as unavailable, without a link, and Remove deletes it", async () => {
    const add = vi.spyOn(toast, "add")
    const sold = saved()[0]!
    sold.status = "sold"
    await open()
    await waitFor(() => expect(screen.getByText("Sold")).toBeTruthy())
    const card = screen.getByText("Sold").closest("article")!
    expect(within(card).getByText("No longer available")).toBeTruthy()
    expect(within(card).queryByRole("link")).toBeNull()
    expect(
      within(card).queryByRole("button", { name: "Save to favorites" })
    ).toBeNull()
    fireEvent.click(within(card).getByRole("button", { name: "Remove" }))
    // It asks first: Cancel keeps the favorite, Remove removes it.
    const dialog = await screen.findByRole("alertdialog", {
      name: "Remove from favorites?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(db.favorites.some((f) => f.listingId === sold.id)).toBe(true)
    fireEvent.click(within(card).getByRole("button", { name: "Remove" }))
    await confirmRemove("Remove from favorites?")
    await waitFor(() =>
      expect(db.favorites.some((f) => f.listingId === sold.id)).toBe(false)
    )
    await waitFor(() => expect(screen.queryByText("Sold")).toBeNull())
    expect(add).toHaveBeenCalledOnce()
  })

  it("keeps a listing the public cannot open as unavailable too", async () => {
    saved()[0]!.moderation = "removed"
    await open()
    expect(await screen.findByText("No longer available")).toBeTruthy()
    expect(screen.queryByText("Sold")).toBeNull()
  })

  it("filters by type, writes it to the URL, and says when a type has none", async () => {
    saved()[0]!.vehicleType = "truck"
    const truck = saved()[0]!.id
    const { router } = await open()
    await cardOf(truck)
    fireEvent.click(screen.getByRole("button", { name: "Trucks" }))
    await waitFor(() => expect(shown()).toEqual([truck]))
    expect(router.state.location.search).toMatchObject({ type: "truck" })
    fireEvent.click(screen.getByRole("button", { name: "Motorcycles" }))
    expect(await screen.findByText("No favorites of this type")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Show all" }))
    await waitFor(() => expect(shown()).toHaveLength(rows().length))
    expect(router.state.location.search).not.toHaveProperty("type")
  })

  it("sorts by price and writes it to the URL", async () => {
    saved().forEach((l, i) => (l.price = (i + 1) * 1000))
    const { router } = await open()
    await cardOf(saved()[0]!.id)
    await pick(
      screen.getByRole("combobox", { name: "Sort by" }),
      "Price: high to low"
    )
    await waitFor(() =>
      expect(shown()).toEqual(
        [...saved()].sort((a, b) => b.price - a.price).map((l) => l.id)
      )
    )
    expect(router.state.location.search).toMatchObject({ sort: "price_desc" })
  })

  it("pages by 24, and a page past the end lands on the last page", async () => {
    const mine = new Set(saved().map((l) => l.id))
    const more = db.listings
      .filter((l) => l.moderation === "approved" && !mine.has(l.id))
      .slice(0, 30 - mine.size)
    for (const l of more)
      db.favorites.push({
        id: `t-${l.id}`,
        userId: me().id,
        listingId: l.id,
        createdAt: new Date().toISOString(),
      })
    expect(rows()).toHaveLength(30)
    const { router } = await open("?page=9")
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ page: 2 })
    )
    await waitFor(() => expect(shown()).toHaveLength(6))
    fireEvent.click(screen.getByRole("link", { name: "Go to page 1" }))
    await waitFor(() => expect(shown()).toHaveLength(24))
  })

  it("explains an empty list and links to the listings", async () => {
    db.favorites = db.favorites.filter((f) => f.userId !== me().id)
    await open()
    expect(await screen.findByText("No favorites yet")).toBeTruthy()
    // Nothing to filter or sort yet.
    expect(screen.queryByRole("group", { name: "Filter by type" })).toBeNull()
    expect(
      screen.getByRole("link", { name: "Browse listings" }).getAttribute("href")
    ).toBe("/en/search")
  })

  it("shows an error with Try again, then recovers", async () => {
    const real = globalThis.fetch
    const view = await open()
    await cardOf(rows()[0]!.listingId)
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      /\/api\/favorites\?/.test(String(input))
        ? Promise.resolve(new Response("{}", { status: 500 }))
        : real(input, init)
    )
    fireEvent.click(screen.getByRole("button", { name: "Trucks" }))
    expect(
      await screen.findByText("Could not load your favorites.")
    ).toBeTruthy()
    vi.stubGlobal("fetch", real)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("No favorites of this type")).toBeTruthy()
    expect(view.router.state.location.search).toMatchObject({ type: "truck" })
  })

  it("reads in Arabic", async () => {
    await renderShell(
      <NowProvider serverNow={Date.now()}>
        <FavoritesPage />
      </NowProvider>,
      { role: "user", locale: "ar", path: "/ar/account/favorites" }
    )
    expect(
      (await screen.findByRole("heading", { level: 1 })).textContent
    ).toContain("المفضلة")
    expect(screen.getByRole("button", { name: "سيارات" })).toBeTruthy()
  })
})
