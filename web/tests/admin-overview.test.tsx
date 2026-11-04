import { screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminOverviewPage } from "@/features/admin-overview/components/admin-overview-page"
import { formatNumber } from "@/lib/format"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
document.elementFromPoint = () => null

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const open = (path = "/en/admin") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <AdminOverviewPage />
    </NowProvider>,
    { role: "admin", path }
  )
const linkOf = async (label: string) =>
  (await screen.findByText(label)).closest("a")!
const DAY = 24 * 60 * 60 * 1000
const shows = (link: HTMLElement, n: number | string) =>
  waitFor(() => expect(within(link).getByText(String(n))).toBeTruthy())

describe("AdminOverviewPage", () => {
  it("links every total to its screen and matches the tables", async () => {
    await open()
    const live = db.listings.filter((l) => l.moderation === "approved")
    const cards: [string, string, number][] = [
      ["Total users", "/en/admin/users", db.users.length],
      ["Total listings", "/en/admin/listings?tab=approved", live.length],
      [
        "Total vehicles",
        "/en/admin/listings?tab=approved&type=vehicle",
        live.filter((l) => l.kind === "vehicle").length,
      ],
      ["Dealerships", "/en/admin/dealerships", db.dealerships.length],
      ["Workshops", "/en/admin/workshops", db.workshops.length],
      ["Mechanics", "/en/admin/mechanics", db.mechanics.length],
      [
        "Active subscriptions",
        "/en/admin/plans?tab=subscribers",
        db.subscriptions.filter((s) => s.status === "active").length,
      ],
    ]
    for (const [label, href, n] of cards) {
      const link = await linkOf(label)
      expect(link.getAttribute("href")).toBe(href)
      if (n < 1000) await shows(link, n)
    }
    expect((await linkOf("Revenue (SDG)")).getAttribute("href")).toBe(
      "/en/admin/payments?tab=approved"
    )
  })

  it("links the four queues with the sidebar counts", async () => {
    await open()
    const queues: [string, string, number][] = [
      [
        "Pending listings",
        "/en/admin/moderation",
        db.listings.filter((l) => l.moderation === "pending").length,
      ],
      [
        "Open reports",
        "/en/admin/reports",
        db.reports.filter((r) => r.status === "open").length,
      ],
      [
        "Pending verifications",
        "/en/admin/verifications",
        db.verifications.filter((v) => v.status === "pending").length,
      ],
      [
        "Pending payments",
        "/en/admin/payments",
        db.payments.filter((p) => p.status === "pending_review").length,
      ],
    ]
    for (const [label, href, n] of queues) {
      const link = await linkOf(label)
      expect(link.getAttribute("href")).toBe(href)
      await shows(link, n)
    }
  })

  it("lists the ten newest events, each linking to its screen", async () => {
    await open()
    const feed = (await screen.findByText("Recent activity")).closest(
      "section"
    )!
    const links = await within(feed).findAllByRole("link")
    expect(links).toHaveLength(10)
    for (const a of links)
      expect(a.getAttribute("href")).toMatch(/^\/en\/admin\/\w+\?(id|listing)=/)
  })

  it.each(["7d", "30d"] as const)(
    "sums revenue of payments approved in the last %s",
    async (range) => {
      const days = range === "7d" ? 7 : 30
      const approved = db.payments.filter((p) => p.status === "approved")
      approved[0]!.reviewedAt = new Date(Date.now() - 20 * DAY).toISOString()
      const sum = approved
        .filter(
          (p) =>
            Date.parse(p.reviewedAt ?? p.createdAt) >= Date.now() - days * DAY
        )
        .reduce((total, p) => total + p.amount, 0)
      await open(`/en/admin?range=${range}`)
      await shows(await linkOf("Revenue (SDG)"), formatNumber(sum, "en"))
    }
  )
})
