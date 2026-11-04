import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { UsersPage } from "@/features/admin-users/components/users-page"
import { toast } from "@/components/ui/toast"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const open = (path = "/en/admin/users") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <UsersPage />
    </NowProvider>,
    { role: "admin", path }
  )
const call = async (path: string, as?: string, body?: unknown) => {
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(as ? { cookie: `sy_session=${as}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  )
  return { status: res.status, body: await res.json() }
}
const login = () =>
  call("/auth/login", undefined, {
    email: "dealer@demo.sy",
    password: "Demo1234",
  })
const sheet = () => screen.findByRole("dialog", { name: "User" })

describe("UsersPage", () => {
  it("lists every account; role, status and counts match the DB", async () => {
    const all = await call("/admin/users?pageSize=500", "u-admin")
    expect(all.body.total).toBe(db.users.length)
    const cases: [string, (u: (typeof db.users)[number]) => boolean][] = [
      ["role=dealership", (u) => u.role === "dealership"],
      ["role=mechanic", (u) => u.role === "mechanic"],
      ["status=banned", (u) => u.banned],
      ["status=active", (u) => !u.banned],
    ]
    for (const [query, match] of cases) {
      const { body } = await call(
        `/admin/users?pageSize=500&${query}`,
        "u-admin"
      )
      expect(body.total, query).toBe(db.users.filter(match).length)
    }
    const dealer = (await call("/admin/users?id=u-dealer", "u-admin")).body
      .items[0]
    const own = db.listings.filter(
      (l) => l.ownerUserId === "u-dealer" && l.moderation !== "draft"
    )
    expect(dealer.listings).toBe(own.length)
    expect(dealer.reportsAgainst).toBe(
      db.reports.filter((r) => own.some((l) => l.id === r.listingId)).length
    )
    await open()
    const table = await screen.findByRole("table", { name: "Users" })
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(
        Math.min(20, db.users.length) + 1
      )
    )
  })

  it("ban refuses sign-in and hides the listings and business; unban asks first and brings them back", async () => {
    const add = vi.spyOn(toast, "add")
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-dealer" && l.moderation === "approved"
    )!
    const shop = db.dealerships.find((d) => d.ownerId === "u-dealer")!
    expect((await login()).status).toBe(200)
    await open("/en/admin/users?id=u-dealer")
    let panel = await sheet()
    expect(await within(panel).findByText("Al Nasr Motors")).toBeTruthy()
    expect(
      await within(panel).findByRole("link", { name: "View their listings" })
    ).toHaveProperty(
      "href",
      expect.stringContaining("/en/admin/listings?ownerId=u-dealer")
    )
    fireEvent.click(within(panel).getByRole("button", { name: "Ban" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Ban Al Nasr Motors",
    })
    fireEvent.input(within(dialog).getByRole("textbox"), {
      target: { value: "Fake listings" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Ban" }))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "User banned" })
    )
    const user = db.users.find((u) => u.id === "u-dealer")!
    expect(user.banned).toBe(true)
    expect(user.bannedReason).toBe("Fake listings")
    expect(user.bannedUntil).toBeTruthy()

    const refused = await login()
    expect(refused.status).toBe(403)
    expect(refused.body.code).toBe("banned")
    expect((await call(`/listings/${listing.slug}`)).status).toBe(404)
    const list = await call("/dealerships?pageSize=100")
    expect(list.body.items.some((d: { id: string }) => d.id === shop.id)).toBe(
      false
    )
    const page = await call(`/dealerships/${shop.slug}`)
    expect(page.body.unavailable).toBe(true)

    panel = await sheet()
    fireEvent.click(await within(panel).findByRole("button", { name: "Unban" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(user.banned).toBe(true)
    fireEvent.click(within(confirm).getByRole("button", { name: "Unban" }))
    await waitFor(() => expect(user.banned).toBe(false))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "User unbanned" })
    )
    expect((await login()).status).toBe(200)
    expect((await call(`/listings/${listing.slug}`)).status).toBe(200)
    expect((await call(`/dealerships/${shop.slug}`)).body.unavailable).toBe(
      undefined
    )
  })

  it("the sheet lists the person's latest payments", async () => {
    const payer = db.payments[0]!.userId
    const count = db.payments.filter((p) => p.userId === payer).length
    await open(`/en/admin/users?id=${payer}`)
    const panel = await sheet()
    const heading = await within(panel).findByRole("heading", {
      name: /^Payments/,
    })
    await waitFor(
      () => expect(heading.textContent).toBe(`Payments (${count})`),
      { timeout: 4000 }
    )
    expect(
      within(heading.parentElement!).getAllByRole("listitem")
    ).toHaveLength(Math.min(5, count))
  })

  it("an admin account cannot be banned", async () => {
    await open("/en/admin/users?id=u-admin")
    const panel = await sheet()
    await within(panel).findByText("Site admin")
    expect(within(panel).queryByRole("button", { name: "Ban" })).toBeNull()
    expect(
      (
        await call("/admin/users/u-admin/ban", "u-admin", {
          reason: "x",
          duration: "7d",
        })
      ).status
    ).toBe(403)
  })

  it("an unknown id says the user is gone", async () => {
    await open("/en/admin/users?id=nope")
    const panel = await sheet()
    expect(
      await within(panel).findByText("This user no longer exists.")
    ).toBeTruthy()
  })
})
