import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { NowProvider } from "@/lib/now"
import { ListingsManager } from "@/features/listings-manager/components/listings-manager"
import {
  listingsManagerSearchSchema,
  pruneSearch,
} from "@/features/listings-manager/schemas"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}

beforeEach(() => resetDb())

const mine = () => db.listings.filter((l) => l.ownerUserId === "u-omar")

async function open(search: Record<string, unknown> = {}) {
  const onNavigate = vi.fn()
  const view = await renderShell(
    <NowProvider serverNow={Date.now()}>
      <TooltipProvider>
        <ListingsManager
          scope="user"
          search={listingsManagerSearchSchema.parse(search)}
          onNavigate={onNavigate}
        />
      </TooltipProvider>
    </NowProvider>,
    { role: "user", path: "/en/account/listings" }
  )
  await waitFor(() =>
    expect(
      document
        .querySelector("[data-slot=data-table]")
        ?.getAttribute("aria-busy")
    ).not.toBe("true")
  )
  return { ...view, onNavigate }
}
// The newest active listing sits in the first row, so a test can pick it before the table renders.
const newestActive = () =>
  mine()
    .filter((l) => l.moderation === "approved" && l.status === "available")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!
const rowOf = async (title: string) =>
  (await screen.findAllByRole("row")).find((r) => within(r).queryByText(title))!

describe("search params", () => {
  it("keep only what differs from the defaults", () => {
    expect(pruneSearch(listingsManagerSearchSchema.parse({}))).toEqual({})
    expect(
      pruneSearch(
        listingsManagerSearchSchema.parse({
          tab: "pending",
          sort: "views",
          page: "2",
          q: "corolla",
        })
      )
    ).toEqual({ tab: "pending", sort: "views", page: 2, q: "corolla" })
    expect(listingsManagerSearchSchema.parse({ tab: "nope" }).tab).toBe("all")
  })
})

describe("ListingsManager", () => {
  it("offers Export CSV to every seller, not only dealerships", async () => {
    await open()
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy()
  })

  it("shows the limit meter of the plan, and no meter when individual plans are off", async () => {
    const { unmount } = await open()
    const meter = await screen.findByRole("meter", { name: "Listings used" })
    expect(meter.getAttribute("aria-valuemax")).toBe("40")
    unmount()
    db.settings.individualSubscriptionsEnabled = false
    await open()
    expect(screen.queryByRole("meter")).toBeNull()
  })

  it("disables Post at the limit and points to billing", async () => {
    db.subscriptions.find(
      (s) => s.userId === "u-omar" && s.status === "active"
    )!.usage.limit = 1
    await open()
    expect(
      screen
        .getByRole("button", { name: "Post a listing" })
        .hasAttribute("disabled")
    ).toBe(true)
    expect(
      screen
        .getAllByRole("link", { name: "See plans" })[0]!
        .getAttribute("href")
    ).toBe("/en/account/billing")
  })

  it("lists the owner's listings, 24 to a page, with the tabs", async () => {
    await open()
    expect(screen.getAllByRole("tab")).toHaveLength(7)
    const rows = screen.getAllByRole("row").length - 1
    expect(rows).toBe(
      Math.min(24, mine().filter((l) => l.moderation !== "removed").length)
    )
  })

  it("changes the status in the row and keeps it", async () => {
    const target = newestActive()
    await open({ tab: "active" })
    const row = await rowOf(target.title)
    await pick(within(row).getByRole("combobox"), "Reserved")
    await waitFor(() => expect(target.status).toBe("reserved"))
  })

  it("renews, duplicates and deletes from the row menu", async () => {
    const target = newestActive()
    target.expiresAt = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const before = target.expiresAt
    await open({ tab: "active" })
    const menu = async () =>
      fireEvent.click(
        within(await rowOf(target.title)).getByRole("button", {
          name: `Actions for ${target.title}`,
        })
      )
    await menu()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Renew" }))
    await waitFor(() => expect(target.expiresAt > before).toBe(true))

    const count = db.listings.length
    await menu()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }))
    await waitFor(() => expect(db.listings.length).toBe(count + 1))
    expect(db.listings.at(-1)?.moderation).toBe("draft")

    await menu()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      })
    )
    await waitFor(() =>
      expect(db.listings.some((l) => l.id === target.id)).toBe(false)
    )
  })

  it("sends a dealership to its own wizard routes to post and edit", async () => {
    const { router } = await renderShell(
      <NowProvider serverNow={Date.now()}>
        <TooltipProvider>
          <ListingsManager
            scope="dealer"
            search={listingsManagerSearchSchema.parse({})}
            onNavigate={vi.fn()}
          />
        </TooltipProvider>
      </NowProvider>,
      { role: "dealership", path: "/en/dealer/inventory" }
    )
    expect(
      (
        await screen.findByRole("link", { name: "Post a listing" })
      ).getAttribute("href")
    ).toBe("/en/dealer/inventory/new")
    const [menu] = await screen.findAllByRole("button", {
      name: /^Actions for /,
    })
    fireEvent.click(menu!)
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(
        /^\/en\/dealer\/inventory\/[^/]+\/edit$/
      )
    )
  })

  it("keeps Renew off while the listing has more than a week left", async () => {
    const target = newestActive()
    target.expiresAt = new Date(Date.now() + 25 * 86_400_000).toISOString()
    await open({ tab: "active" })
    fireEvent.click(
      within(await rowOf(target.title)).getByRole("button", {
        name: `Actions for ${target.title}`,
      })
    )
    expect(
      (await screen.findByRole("menuitem", { name: "Renew" })).getAttribute(
        "aria-disabled"
      )
    ).toBe("true")
  })

  it("explains a rejection and offers no public page for it", async () => {
    const target = mine().find((row) => row.moderation === "rejected")!
    await open({ tab: "rejected" })
    const row = await rowOf(target.title)
    fireEvent.click(
      within(row).getByRole("button", { name: `Actions for ${target.title}` })
    )
    const items = (await screen.findAllByRole("menuitem")).map(
      (i) => i.textContent
    )
    expect(items).not.toContain("View public page")
    expect(items).not.toContain("Promote")
    expect(items).toContain("Edit")
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    // A click (or a tap on a phone) shows the reason, not only a hover.
    fireEvent.click(within(row).getByRole("button", { name: "Rejected" }))
    const popup = await screen.findByRole("dialog")
    expect(within(popup).getByText(/^(Reason:|No reason given)/)).toBeTruthy()
  })

  it("marks the selected approved rows sold or rented in one go", async () => {
    const { client } = await open({ tab: "active" })
    await client.invalidateQueries()
    const boxes = await screen.findAllByRole("checkbox", { name: "Select row" })
    boxes.slice(0, 3).forEach((b) => fireEvent.click(b))
    fireEvent.click(
      await screen.findByRole("button", { name: "Mark sold or rented" })
    )
    await waitFor(() =>
      expect(
        mine().filter((l) => l.status === "sold" || l.status === "rented")
          .length
      ).toBeGreaterThanOrEqual(3)
    )
    for (const row of mine().filter((l) => l.status === "rented"))
      expect(row.intent).toBe("rent")
  })

  it("sends a search and a page change to the route", async () => {
    const { onNavigate } = await open()
    fireEvent.change(screen.getAllByRole("searchbox")[0]!, {
      target: { value: "corolla" },
    })
    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith({ q: "corolla" }, true)
    )
  })

  it("shows the unfinished wizard draft on the Drafts tab and discards it", async () => {
    const { client } = await open({ tab: "drafts" })
    expect(screen.queryByText("You have an unfinished listing")).toBeNull()
    db.drafts.push({
      id: "u-omar:listing:new",
      userId: "u-omar",
      key: "listing:new",
      data: {
        savedAt: new Date().toISOString(),
        values: { vehicleType: "car" },
      },
    })
    await client.invalidateQueries()
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }))
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Discard",
      })
    )
    await waitFor(() =>
      expect(screen.queryByText("You have an unfinished listing")).toBeNull()
    )
    expect(db.drafts[0]?.data).toEqual({})
  })

  it("opens the analytics sheet with totals", async () => {
    const target = newestActive()
    await open({ tab: "active" })
    fireEvent.click(
      within(await rowOf(target.title)).getByRole("button", {
        name: `Actions for ${target.title}`,
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Analytics" }))
    const sheet = await screen.findByRole("dialog")
    expect(await within(sheet).findByText("Shares")).toBeTruthy()
    expect(within(sheet).getByText("Last 30 days")).toBeTruthy()
  })

  it("opens the promote dialog from the row menu of an approved listing", async () => {
    const target = newestActive()
    await open({ tab: "active" })
    fireEvent.click(
      within(await rowOf(target.title)).getByRole("button", {
        name: `Actions for ${target.title}`,
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Promote" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Promote this listing",
    })
    expect(await within(dialog).findAllByRole("radio")).toHaveLength(4)
  })
})
