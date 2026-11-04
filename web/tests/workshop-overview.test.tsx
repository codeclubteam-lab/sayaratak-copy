import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkshopOverviewPage } from "@/features/workshop-overview/components/workshop-overview-page"
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

const owner = () =>
  db.users.find((u) => u.role === "workshop" && u.onboardingDone)!
const biz = () => db.workshops.find((w) => w.ownerId === owner().id)!

const open = (path = "/en/workshop") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <WorkshopOverviewPage />
    </NowProvider>,
    { role: "workshop", path }
  )
const cardLink = async (label: string) =>
  (await screen.findAllByText(label)).map((e) => e.closest("a")).find(Boolean)!

describe("WorkshopOverviewPage", () => {
  it("links every number to the page that explains it, keeping the range", async () => {
    await open("/en/workshop?range=7d")
    const hrefs = {
      "Profile views": "/en/workshop/analytics?range=7d",
      Calls: "/en/workshop/analytics?range=7d",
      "WhatsApp clicks": "/en/workshop/analytics?range=7d",
      "Unread inquiries": "/en/workshop/inquiries",
      Rating: "/en/workshop/reviews",
    }
    for (const [label, href] of Object.entries(hrefs)) {
      expect((await cardLink(label)).getAttribute("href")).toBe(href)
    }
  })

  it("links each open setup item to the page that fixes it", async () => {
    Object.assign(biz(), { services: [], images: [] })
    await open()
    expect(
      (await screen.findByText("Add three services"))
        .closest("a")
        ?.getAttribute("href")
    ).toBe("/en/workshop/services")
    expect(
      screen.getByText("Add three photos").closest("a")?.getAttribute("href")
    ).toBe("/en/workshop/photos")
  })

  it("Reply under a recent review posts the reply", async () => {
    const at = new Date().toISOString()
    db.reviews = db.reviews.filter((r) => r.targetId !== biz().id)
    db.reviews.push({
      id: "w-1",
      targetType: "workshop",
      targetId: biz().id,
      authorId: "u-omar",
      authorName: "Ali",
      rating: 5,
      body: "Fixed my brakes fast",
      createdAt: at,
      status: "visible",
    })
    await open()
    const section = (await screen.findByText("Recent reviews")).closest(
      "section"
    )!
    const row = (
      await within(section).findByText("Fixed my brakes fast")
    ).closest("li")!
    fireEvent.click(within(row).getByRole("button", { name: "Reply" }))
    fireEvent.change(within(row).getByRole("textbox", { name: "Your reply" }), {
      target: { value: "Thank you, Ali" },
    })
    fireEvent.click(within(row).getByRole("button", { name: "Post reply" }))
    await waitFor(() =>
      expect(db.reviews.find((r) => r.id === "w-1")?.reply?.body).toBe(
        "Thank you, Ali"
      )
    )
    expect(await within(row).findByText("Thank you, Ali")).toBeTruthy()
    expect(
      within(section)
        .getByRole("link", { name: "See all" })
        .getAttribute("href")
    ).toBe("/en/workshop/reviews")
  })

  it("shows the plan with a Manage plan link to workshop billing", async () => {
    await open()
    expect(
      (await screen.findByRole("link", { name: "Manage plan" })).getAttribute(
        "href"
      )
    ).toBe("/en/workshop/billing")
  })

  it("an upgrade under review keeps Basic and links to the payment", async () => {
    const sub = db.subscriptions.find(
      (s) => s.userId === owner().id && s.status === "active"
    )!
    sub.planId = "plan-workshop-basic"
    db.payments.push({
      ...db.payments[0]!,
      id: "pay-upgrade",
      userId: owner().id,
      itemType: "plan",
      itemId: "plan-workshop-plus",
      status: "pending_review",
    })
    await open()
    expect(
      await screen.findByText(/Your payment for Plus is under review/)
    ).toBeTruthy()
    expect(screen.getByText("Basic")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "View payment" }).getAttribute("href")
    ).toBe("/en/workshop/billing?tab=history")
  })
})
