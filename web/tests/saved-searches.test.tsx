import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SavedSearchesPage } from "@/features/saved-searches/components/saved-searches-page"
import { renameSearchSchema } from "@/features/saved-searches/schemas"
import { db, resetDb } from "@/mocks/db"
import { approveListing } from "@/mocks/handlers/admin"
import { isPublic } from "@/mocks/search"
import type { SavedSearchRow } from "@/mocks/types"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

const me = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const base = { kind: "vehicle", includeSold: false, sort: "newest", page: 1 }
const row = (r: Partial<SavedSearchRow> & { id: string }): SavedSearchRow => ({
  userId: me().id,
  name: r.id,
  params: base as SavedSearchRow["params"],
  alerts: false,
  newCount: 0,
  createdAt: new Date().toISOString(),
  ...r,
})
const many = () =>
  row({
    id: "Hilux",
    alerts: true,
    newCount: 2,
    params: {
      ...base,
      intent: "sale",
      type: "car",
      make: "toyota",
      city: "khartoum",
      minYear: 2015,
      maxYear: 2020,
      maxMileage: 100000,
      condition: "used",
    } as SavedSearchRow["params"],
  })
const few = () =>
  row({ id: "Cheap", params: { ...base, q: "corolla" } as never })

beforeEach(() => {
  resetDb()
  vi.restoreAllMocks()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  // jsdom cannot follow a link; the app turns the click into a client navigation.
  document.addEventListener("click", (e) => {
    if ((e.target as Element).closest("a")) e.preventDefault()
  })
  db.savedSearches = [many(), few()]
})

const open = () =>
  renderShell(<SavedSearchesPage />, {
    role: "user",
    path: "/en/account/saved-searches",
  })
const itemOf = async (name: string) =>
  (await screen.findByRole("heading", { name })).closest("li")!
const menu = async (name: string, item: string) => {
  fireEvent.click(
    within(await itemOf(name)).getByRole("button", {
      name: `Actions for ${name}`,
    })
  )
  fireEvent.click(await screen.findByRole("menuitem", { name: item }))
}

describe("renameSearchSchema", () => {
  it("needs a name of at most 60 characters", () => {
    expect(renameSearchSchema.safeParse({ name: "  " }).success).toBe(false)
    expect(renameSearchSchema.safeParse({ name: "a".repeat(61) }).success).toBe(
      false
    )
    expect(renameSearchSchema.parse({ name: " Hilux " }).name).toBe("Hilux")
  })
})

describe("SavedSearchesPage", () => {
  it("shows the first four filters, the rest as +n, and the new matches", async () => {
    await open()
    const hilux = within(await itemOf("Hilux"))
    const chips = hilux.getByRole("list", { name: "Filters of Hilux" })
    expect(within(chips).getAllByRole("listitem")).toHaveLength(5)
    expect(within(chips).getAllByRole("listitem").at(-1)!.textContent).toBe(
      "+3"
    )
    expect(hilux.getByText("New: 2")).toBeTruthy()
    const cheap = within(await itemOf("Cheap"))
    expect(cheap.queryByText(/New:/)).toBeNull()
    expect(cheap.getByText("corolla")).toBeTruthy()
  })

  it("saves the alerts switch at once", async () => {
    await open()
    const toggle = within(await itemOf("Cheap")).getByRole("switch", {
      name: "Alerts for Cheap",
    })
    expect(toggle.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(db.savedSearches.find((s) => s.id === "Cheap")!.alerts).toBe(true)
    )
    await waitFor(() =>
      expect(toggle.getAttribute("aria-checked")).toBe("true")
    )
  })

  it("opens the search with its stored filters and clears the new count", async () => {
    await open()
    const item = within(await itemOf("Hilux"))
    const link = item.getByRole("link", { name: "Open Hilux" })
    const href = decodeURIComponent(link.getAttribute("href")!)
    expect(href.startsWith("/en/vehicles/cars/sale/khartoum")).toBe(true)
    expect(href).toContain("make=toyota")
    fireEvent.click(link)
    await waitFor(() =>
      expect(db.savedSearches.find((s) => s.id === "Hilux")!.newCount).toBe(0)
    )
    await waitFor(() => expect(item.queryByText(/New:/)).toBeNull())
  })

  it("renames from the menu and refuses an empty name", async () => {
    await open()
    await menu("Cheap", "Rename")
    const dialog = await screen.findByRole("dialog", { name: "Rename search" })
    const input = within(dialog).getByRole("textbox", { name: "Name" })
    expect((input as HTMLInputElement).value).toBe("Cheap")
    fireEvent.change(input, { target: { value: " " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    expect(
      await within(dialog).findByText("This field is required")
    ).toBeTruthy()
    expect(db.savedSearches.find((s) => s.id === "Cheap")!.name).toBe("Cheap")

    fireEvent.change(input, { target: { value: "Under 20M" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(db.savedSearches.find((s) => s.id === "Cheap")!.name).toBe(
        "Under 20M"
      )
    )
    expect(
      await screen.findByRole("heading", { name: "Under 20M" })
    ).toBeTruthy()
  })

  it("asks before it deletes", async () => {
    await open()
    await menu("Cheap", "Delete")
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(db.savedSearches).toHaveLength(2)

    await menu("Cheap", "Delete")
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      })
    )
    await waitFor(() => expect(db.savedSearches).toHaveLength(1))
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Cheap" })).toBeNull()
    )
  })

  it("explains how to save a search when there are none", async () => {
    db.savedSearches = []
    await open()
    expect(await screen.findByText("No saved searches yet")).toBeTruthy()
    const start = screen.getByRole("link", { name: "Start a search" })
    expect(start.getAttribute("href")).toBe("/en/search")
  })
})

describe("approving a matching listing", () => {
  it("raises the badge and sends a notification, only with alerts on", () => {
    const listing = db.listings.find(
      (l) => isPublic(l) && l.kind === "vehicle" && l.ownerUserId !== me().id
    )!
    const params = { ...base, intent: listing.intent } as never
    db.savedSearches = [
      row({ id: "on", alerts: true, params }),
      row({ id: "off", alerts: false, params }),
    ]
    const sent = () =>
      db.notifications.filter(
        (n) => n.userId === me().id && n.type === "saved_search_match"
      ).length
    const before = sent()
    approveListing(listing)
    expect(db.savedSearches.map((s) => s.newCount)).toEqual([1, 0])
    expect(sent()).toBe(before + 1)
  })
})
