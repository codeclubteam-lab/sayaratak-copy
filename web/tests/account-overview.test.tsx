import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { attentionOf } from "@/features/account-overview/attention"
import { AccountOverviewPage } from "@/features/account-overview/components/account-overview-page"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
// jsdom lacks it; input-otp polls it for password-manager badges.
document.elementFromPoint = () => null

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => vi.unstubAllEnvs())

const DAY = 24 * 60 * 60 * 1000
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString()
const me = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const mine = () => db.listings.filter((l) => l.ownerUserId === me().id)

// Every listing of the user is healthy, then three get a problem each: rejected, ending in 2 days, reserved for 20 days.
function seedProblems() {
  for (const l of mine()) {
    l.moderation = "approved"
    l.status = "available"
    l.expiresAt = iso(60)
    l.updatedAt = iso(0)
    l.rejectionReason = null
  }
  const [rejected, expiring, reserved] = mine()
  Object.assign(rejected!, {
    moderation: "rejected",
    rejectionReason: "Photos are blurry",
  })
  expiring!.expiresAt = iso(2)
  Object.assign(reserved!, { status: "reserved", updatedAt: iso(-20) })
  return { rejected: rejected!, expiring: expiring!, reserved: reserved! }
}

const open = (path = "/en/account") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <AccountOverviewPage />
    </NowProvider>,
    { role: "user", path }
  )
const rowOf = async (title: string) =>
  (await screen.findByText(title)).closest("li")!

describe("attentionOf", () => {
  const base = mine
  it("follows the rules of the needs-attention list", () => {
    const l = { ...base()[0]! }
    const now = Date.now()
    const healthy = {
      ...l,
      moderation: "approved" as const,
      status: "available" as const,
      expiresAt: iso(60),
      updatedAt: iso(0),
    }
    expect(attentionOf(healthy, now)).toBeUndefined()
    expect(attentionOf({ ...healthy, moderation: "rejected" }, now)).toBe(
      "rejected"
    )
    expect(
      attentionOf({ ...healthy, moderation: "draft" }, now)
    ).toBeUndefined()
    expect(attentionOf({ ...healthy, expiresAt: iso(6) }, now)).toBe("expiring")
    expect(attentionOf({ ...healthy, expiresAt: iso(-3) }, now)).toBe(
      "expiring"
    )
    const reserved = { ...healthy, status: "reserved" as const }
    expect(
      attentionOf({ ...reserved, updatedAt: iso(-13) }, now)
    ).toBeUndefined()
    expect(attentionOf({ ...reserved, updatedAt: iso(-15) }, now)).toBe(
      "reserved"
    )
  })
})

describe("AccountOverviewPage", () => {
  it("shows the four numbers of the account", async () => {
    seedProblems()
    await open()
    const now = Date.now()
    const active = mine().filter(
      (l) =>
        l.moderation === "approved" &&
        (l.status === "available" || l.status === "reserved") &&
        Date.parse(l.expiresAt) > now
    ).length
    const card = (label: string) =>
      screen.getByText(label).parentElement as HTMLElement
    await waitFor(() =>
      expect(
        within(card("Active listings")).getByText(String(active))
      ).toBeTruthy()
    )
    for (const label of [
      "Views, last 30 days",
      "Favorites received",
      "Unread messages",
    ])
      await waitFor(() =>
        expect(
          within(card(label)).queryAllByText(/^\d/).length
        ).toBeGreaterThan(0)
      )
  })

  it("lists each listing that needs attention with its reason and action", async () => {
    const { rejected, expiring, reserved } = seedProblems()
    await open()
    const r = await rowOf(rejected.title)
    expect(within(r).getByText(/Reason: .*Photos are blurry/)).toBeTruthy()
    expect(
      within(r)
        .getByRole("link", { name: "Edit and resubmit" })
        .getAttribute("href")
    ).toContain(`edit=${rejected.id}`)
    expect(
      within(await rowOf(expiring.title)).getByText(/^Ends in/)
    ).toBeTruthy()
    expect(
      within(await rowOf(reserved.title)).getByText("Reserved for 20 days")
    ).toBeTruthy()
  })

  it("renews an ending listing and drops it from the list", async () => {
    const { expiring } = seedProblems()
    await open()
    fireEvent.click(
      within(await rowOf(expiring.title)).getByRole("button", { name: "Renew" })
    )
    await waitFor(() =>
      expect(Date.parse(expiring.expiresAt)).toBeGreaterThan(
        Date.now() + 7 * DAY
      )
    )
    await waitFor(() => expect(screen.queryByText(expiring.title)).toBeNull())
  })

  it("updates the status of a long reservation from a menu", async () => {
    const { reserved } = seedProblems()
    await open()
    fireEvent.click(
      within(await rowOf(reserved.title)).getByRole("button", {
        name: "Update status",
      })
    )
    const items = await screen.findAllByRole("menuitem")
    const closed = reserved.intent === "rent" ? "Rented" : "Sold"
    expect(items.map((i) => i.textContent)).toEqual(["Available", closed])
    fireEvent.click(items[1]!)
    await waitFor(() =>
      expect(reserved.status).toBe(
        reserved.intent === "rent" ? "rented" : "sold"
      )
    )
    await waitFor(() => expect(screen.queryByText(reserved.title)).toBeNull())
  })

  it("says nothing needs attention for a healthy account", async () => {
    const { rejected } = seedProblems()
    rejected.moderation = "approved"
    for (const l of mine()) {
      l.expiresAt = iso(60)
      l.status = "available"
    }
    await open()
    expect(await screen.findByText("Nothing needs your attention")).toBeTruthy()
  })

  it("shows an error with Retry for the numbers and the list, then recovers", async () => {
    seedProblems()
    const view = await open()
    await screen.findAllByText("Edit and resubmit")
    const real = globalThis.fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      /\/me\/(listings|analytics)/.test(String(input))
        ? Promise.resolve(new Response("{}", { status: 500 }))
        : real(input, init)
    )
    await view.client.invalidateQueries()
    expect(await screen.findByText("Could not load this list")).toBeTruthy()
    expect(await screen.findByText("Could not load your numbers")).toBeTruthy()
    vi.stubGlobal("fetch", real)
    for (const retry of screen.getAllByRole("button", { name: "Try again" }))
      fireEvent.click(retry)
    expect(await screen.findAllByText("Edit and resubmit")).toHaveLength(1)
    expect(screen.queryByText("Could not load your numbers")).toBeNull()
  })

  it("shows the latest notifications with a link to all of them", async () => {
    await open()
    const mineNotes = db.notifications.filter((n) => n.userId === me().id)
    expect(mineNotes.length).toBeGreaterThan(0)
    const section = (await screen.findByText("Recent activity")).closest(
      "section"
    )!
    expect(
      within(section)
        .getByRole("link", { name: "See all" })
        .getAttribute("href")
    ).toBe("/en/account/notifications")
    await waitFor(() =>
      expect(within(section).getAllByRole("listitem").length).toBeGreaterThan(0)
    )
    expect(within(section).getAllByRole("listitem").length).toBeLessThanOrEqual(
      5
    )
  })

  it("greets a new account once, and closing the notice drops ?welcome=1", async () => {
    const { router } = await open("/en/account?welcome=1")
    expect(
      await screen.findByRole("link", { name: "Post your first listing" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Post your first listing" })
      ).toBeNull()
    )
    expect(router.state.location.search).toEqual({})
  })

  it("has no welcome without the param", async () => {
    await open()
    await screen.findByText("Needs attention")
    expect(
      screen.queryByRole("link", { name: "Post your first listing" })
    ).toBeNull()
  })

  it("asks to verify an unverified phone only when codes are on", async () => {
    vi.stubEnv("VITE_FEATURE_OTP", "false")
    me().verifiedPhone = false
    await open()
    await screen.findByText("Needs attention")
    expect(screen.queryByText("Verify your phone number")).toBeNull()
  })

  it("verifies the phone with the code and then hides the notice", async () => {
    vi.stubEnv("VITE_FEATURE_OTP", "true")
    expect(me().phone).toBeTruthy()
    me().verifiedPhone = false
    await open()
    expect(await screen.findByText("Verify your phone number")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Verify phone" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(
      await within(dialog).findByLabelText("Verification code"),
      {
        target: { value: "123456" },
      }
    )
    await waitFor(() => expect(me().verifiedPhone).toBe(true))
    await waitFor(() =>
      expect(screen.queryByText("Verify your phone number")).toBeNull()
    )
  })
})
