import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlanReminderDialog } from "@/features/billing/components/plan-reminder-dialog"
import { SidebarPlanCard } from "@/features/billing/components/sidebar-plan-card"
import { markSignIn } from "@/lib/sign-in-flag"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  sessionStorage.clear()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const dealer = () =>
  db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
// The dealer moves to the free plan with Growth picked and unpaid, as onboarding leaves a new one.
const pickGrowth = () => {
  const row = dealer()
  for (const s of db.subscriptions)
    if (s.userId === row.id && s.status === "active")
      s.planId = "plan-dealer-starter"
  db.payments = db.payments.filter(
    (p) => !(p.userId === row.id && p.itemType === "plan")
  )
  row.chosenPlanId = "plan-dealer-growth"
}
const openDialog = () => {
  const ui = () => <PlanReminderDialog me={publicUser(dealer())} />
  return renderShell(ui(), { role: "dealership", path: "/en/dealer" })
}
const openCard = () =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <SidebarPlanCard me={publicUser(dealer())} />
    </NowProvider>,
    { role: "dealership", path: "/en/dealer" }
  )

describe("PlanReminderDialog", () => {
  it("shows after a sign in with the free and the picked plan side by side", async () => {
    pickGrowth()
    markSignIn()
    await openDialog()
    expect(
      await screen.findByRole("heading", {
        name: "Your Growth plan is one step away",
      })
    ).toBeTruthy()
    expect(screen.getByText(/Pay 350,000 SDG by Bankak transfer/)).toBeTruthy()
    expect(screen.getByText("Your current plan")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Upgrade to Growth" })
    ).toBeTruthy()
  })

  it("stays shut without a sign in, and with no plan waiting", async () => {
    pickGrowth()
    await openDialog()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("Upgrade opens the checkout", async () => {
    pickGrowth()
    markSignIn()
    const { router } = await openDialog()
    fireEvent.click(
      await screen.findByRole("button", { name: "Upgrade to Growth" })
    )
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/en/dealer/billing/checkout?item=plan%3Aplan-dealer-growth"
      )
    )
  })

  it("Keep Starter clears the waiting plan on the account", async () => {
    pickGrowth()
    markSignIn()
    await openDialog()
    fireEvent.click(await screen.findByRole("button", { name: "Keep Starter" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(dealer().chosenPlanId).toBeUndefined()
  })

  it("Not now closes and keeps the plan waiting for the next sign in", async () => {
    pickGrowth()
    markSignIn()
    await openDialog()
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(dealer().chosenPlanId).toBe("plan-dealer-growth")
  })
})

describe("SidebarPlanCard", () => {
  it("an unpaid pick says so and links to its checkout", async () => {
    pickGrowth()
    await openCard()
    expect(await screen.findByText("Not paid")).toBeTruthy()
    expect(
      screen.getByText("You are on Starter until the payment is approved.")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Pay now" }).getAttribute("href")
    ).toBe("/en/dealer/billing/checkout?item=plan%3Aplan-dealer-growth")
  })

  it("an upgrade under review keeps the current plan, adds a note and links to the history", async () => {
    pickGrowth()
    dealer().chosenPlanId = undefined
    db.payments.push({
      ...db.payments[0]!,
      id: "pay-review",
      userId: dealer().id,
      itemType: "plan",
      itemId: "plan-dealer-growth",
      status: "pending_review",
    })
    await openCard()
    expect(
      await screen.findByText(/Your payment for Growth is under review/)
    ).toBeTruthy()
    expect(screen.getByText("Starter")).toBeTruthy()
    expect(screen.getByText("Active")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "View payment" }).getAttribute("href")
    ).toBe("/en/dealer/billing?tab=history")
  })

  it("a renewal under review keeps the active plan and adds a note", async () => {
    const row = dealer()
    row.chosenPlanId = undefined
    const active = db.subscriptions.find(
      (s) => s.userId === row.id && s.status === "active"
    )!
    db.payments.push({
      ...db.payments[0]!,
      id: "pay-renewal",
      userId: row.id,
      itemType: "plan",
      itemId: active.planId,
      status: "pending_review",
    })
    await openCard()
    expect(
      await screen.findByText("Your renewal payment is under review.")
    ).toBeTruthy()
    expect(screen.getByText("Active")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Manage plan" })).toBeTruthy()
  })

  it("the free plan shows its usage and an Upgrade link", async () => {
    pickGrowth()
    dealer().chosenPlanId = undefined
    await openCard()
    expect(await screen.findByText("Starter")).toBeTruthy()
    expect(screen.getByRole("meter", { name: "Vehicles" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Upgrade" }).getAttribute("href")
    ).toBe("/en/dealer/billing")
  })
})
