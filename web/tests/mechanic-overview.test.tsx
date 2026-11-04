import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkshopOverviewPage } from "@/features/workshop-overview/components/workshop-overview-page"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
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
  db.users.find((u) => u.role === "mechanic" && u.onboardingDone)!
const biz = () => db.mechanics.find((m) => m.ownerId === owner().id)!

const open = (path = "/en/mechanic") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <WorkshopOverviewPage role="mechanic" />
    </NowProvider>,
    { role: "mechanic", path }
  )
const cardLink = async (label: string) =>
  (await screen.findAllByText(label)).map((e) => e.closest("a")).find(Boolean)!

describe("WorkshopOverviewPage role=mechanic", () => {
  it("the availability switch changes the public profile", async () => {
    biz().available = true
    await open()
    const toggle = await screen.findByRole("switch", {
      name: "Available for new work",
    })
    expect(screen.getByText("Available for work")).toBeTruthy()
    fireEvent.click(toggle)
    expect(await screen.findByText("Not taking work now")).toBeTruthy()
    await waitFor(() => expect(biz().available).toBe(false))
    const res = await handleMock(
      new Request(`http://x/api/mechanics/${biz().slug}`)
    )
    expect(((await res.json()) as { available: boolean }).available).toBe(false)
  })

  it("ignores a second press while the save runs", async () => {
    biz().available = true
    await open()
    const toggle = await screen.findByRole("switch", {
      name: "Available for new work",
    })
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle.getAttribute("aria-busy")).toBe("true"))
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle.getAttribute("aria-busy")).toBe("false"))
    expect(biz().available).toBe(false)
    expect(screen.getByText("Not taking work now")).toBeTruthy()
  })

  it("links every number to the mechanic page that explains it", async () => {
    await open("/en/mechanic?range=7d")
    const hrefs = {
      "Profile views": "/en/mechanic/analytics?range=7d",
      Calls: "/en/mechanic/analytics?range=7d",
      "WhatsApp clicks": "/en/mechanic/analytics?range=7d",
      "Unread inquiries": "/en/mechanic/inquiries",
      Rating: "/en/mechanic/reviews",
    }
    for (const [label, href] of Object.entries(hrefs)) {
      expect((await cardLink(label)).getAttribute("href")).toBe(href)
    }
  })

  it("links open setup items to profile and portfolio", async () => {
    Object.assign(biz(), { specializationIds: [], portfolio: [] })
    await open()
    expect(
      (await screen.findByText("Choose your specializations"))
        .closest("a")
        ?.getAttribute("href")
    ).toBe("/en/mechanic/profile")
    expect(
      screen
        .getByText("Add portfolio photos")
        .closest("a")
        ?.getAttribute("href")
    ).toBe("/en/mechanic/portfolio")
  })

  it("links the plan card to mechanic billing", async () => {
    await open()
    const card = (await screen.findByText("Your plan")).closest("section")!
    expect(
      (await within(card).findByRole("link")).getAttribute("href")
    ).toMatch(/^\/en\/mechanic\/billing/)
  })
})
