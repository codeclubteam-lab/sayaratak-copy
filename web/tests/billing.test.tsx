import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BillingPage } from "@/features/billing/components/billing-page"
import { CheckoutPage } from "@/features/billing/components/checkout-page"
import { PromoteDialog } from "@/features/billing/components/promote-dialog"
import {
  billingSearchSchema,
  paymentFormSchema,
  pruneBillingSearch,
} from "@/features/billing/schemas"
import { NowProvider } from "@/lib/now"
import { db, newId, resetDb } from "@/mocks/db"
import { paymentReference } from "@/mocks/lib"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  document.cookie = "mock_fail=; Path=/; Max-Age=0"
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const dealer = () =>
  db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
const growth = () => db.plans.find((p) => p.id === "plan-dealer-growth")!
// The dealer's own payments are cleared first, so the seed's pending ones do not blur the check.
const payment = (status: "pending_review" | "rejected", extra = {}) => {
  db.payments = db.payments.filter((p) => p.userId !== dealer().id)
  db.payments.unshift({
    id: newId("pay"),
    userId: dealer().id,
    itemType: "plan",
    itemId: "plan-dealer-pro",
    itemLabel: { en: "Pro", ar: "برو" },
    amount: 300_000,
    method: "bankak_transfer",
    reference: "SY-111111",
    payerName: "Dealer",
    transactionRef: "TX999999",
    receiptUrl: "/mock/r.webp",
    status,
    createdAt: new Date().toISOString(),
    ...extra,
  })
}

const openBilling = (search = "") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <BillingPage audience="dealership" />
    </NowProvider>,
    { role: "dealership", path: `/en/dealer/billing${search}` }
  )
const openCheckout = (item: string) =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <CheckoutPage audience="dealership" />
    </NowProvider>,
    {
      role: "dealership",
      path: `/en/dealer/billing/checkout?item=${item}`,
    }
  )

describe("search params and schema", () => {
  it("keep only what differs from the defaults", () => {
    expect(pruneBillingSearch(billingSearchSchema.parse({}))).toEqual({})
    expect(
      pruneBillingSearch(
        billingSearchSchema.parse({ tab: "history", page: "2" })
      )
    ).toEqual({ tab: "history", page: 2 })
    expect(billingSearchSchema.parse({ tab: "x", page: "0" })).toEqual({
      tab: "plan",
      page: 1,
    })
  })

  it("the payment form asks for a name, a number of 4 or more and an image", () => {
    const png = new File(["x"], "r.png", { type: "image/png" })
    const bad = paymentFormSchema.safeParse({
      payerName: "A",
      transactionRef: "12",
      receipt: new File(["x"], "r.pdf", { type: "application/pdf" }),
    })
    expect(bad.error?.issues.map((i) => i.message).sort()).toEqual([
      "validation.image_type",
      "validation.name_min",
      "validation.txn_min",
    ])
    expect(
      paymentFormSchema.safeParse({
        payerName: "Amal",
        transactionRef: "1234",
        receipt: png,
      }).success
    ).toBe(true)
  })
})

describe("BillingPage, plan tab", () => {
  it("shows the current plan and its usage, and every plan of the audience", async () => {
    await openBilling()
    const current = await screen.findByRole("region", { name: "Your plan" })
    expect(within(current).getByText(growth().name.en)).toBeTruthy()
    expect(within(current).getByText("Active")).toBeTruthy()
    expect(within(current).getByText(/Ends .+ · in \d+ days/)).toBeTruthy()
    expect(within(current).getByRole("meter")).toBeTruthy()
    expect(screen.getByText("Your current plan")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeTruthy()
    // The free plan has nothing to buy.
    expect(
      screen.getByText(
        "Your account returns to this plan when a paid plan ends."
      )
    ).toBeTruthy()
    expect(screen.getByText("3 a month")).toBeTruthy()
  })

  it("the current plan has no button, an upgrade opens its checkout", async () => {
    const { router } = await openBilling()
    await screen.findByRole("region", { name: "Your plan" })
    expect(screen.queryByRole("button", { name: /Growth/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/en/dealer/billing/checkout?item=plan%3Aplan-dealer-pro"
      )
    )
  })

  it("a payment under review shows a notice and blocks a second payment", async () => {
    payment("pending_review")
    await openBilling()
    expect(
      await screen.findByText(
        "Your payment for Pro is under review. The plan starts as soon as it is approved."
      )
    ).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Payment under review",
      }).disabled
    ).toBe(true)
  })

  it("without individual plans a user sees an empty state", async () => {
    db.settings.individualSubscriptionsEnabled = false
    await renderShell(
      <NowProvider serverNow={Date.now()}>
        <BillingPage audience="user" />
      </NowProvider>,
      { role: "user", path: "/en/account/billing" }
    )
    expect(
      await screen.findByText("Plans are not available right now")
    ).toBeTruthy()
  })
})

describe("BillingPage, history tab", () => {
  it("lists payments, with the reason of a rejected one", async () => {
    payment("rejected", { rejectionReason: "Receipt is blurry" })
    const { router } = await openBilling("?tab=history")
    const table = await screen.findByRole("table", { name: "Payment history" })
    expect(await within(table).findByText("Rejected")).toBeTruthy()
    expect(within(table).getByText("Reason: Receipt is blurry")).toBeTruthy()
    expect(router.state.location.search).toMatchObject({ tab: "history" })
  })

  it("the tab is written to the URL", async () => {
    const { router } = await openBilling()
    await screen.findByRole("region", { name: "Your plan" })
    fireEvent.click(screen.getByRole("tab", { name: "Payment history" }))
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: "history" })
    )
  })
})

describe("CheckoutPage", () => {
  it("shows the order, the Bankak account and the reference from the server", async () => {
    await openCheckout("plan:plan-dealer-pro")
    expect(
      await screen.findByRole("heading", { name: "Pay by Bankak transfer" })
    ).toBeTruthy()
    const summary = screen.getByRole("region", { name: "Order summary" })
    expect(within(summary).getByText("Bankak transfer")).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(screen.getByText(db.settings.bankakAccount.number)).toBeTruthy()
    expect(
      screen.getByText(paymentReference(dealer().id, "plan-dealer-pro"))
    ).toBeTruthy()
  })

  it("shows the form errors and sends nothing while it is invalid", async () => {
    await openCheckout("plan:plan-dealer-pro")
    await screen.findByRole("button", { name: "Submit payment for review" })
    fireEvent.click(
      screen.getByRole("button", { name: "Submit payment for review" })
    )
    expect(
      await screen.findByText("Enter the full transaction number")
    ).toBeTruthy()
    expect(db.payments.some((p) => p.payerName === "Amal")).toBe(false)
  })

  it("a valid form sends the receipt as multipart and shows the pending state", async () => {
    await openCheckout("plan:plan-dealer-pro")
    // jsdom's FormData cannot cross into the mock server's request parser (handlers.test.ts covers that side), so the post is answered here from the fields the form sent.
    const mock = globalThis.fetch
    let sent: FormData | undefined
    vi.stubGlobal("fetch", async (input: RequestInfo, init?: RequestInit) => {
      if (String(input) !== "/api/payments") return mock(input, init)
      sent = init?.body as FormData
      const row = {
        id: newId("pay"),
        userId: dealer().id,
        itemType: "plan" as const,
        itemId: String(sent.get("itemId")),
        itemLabel: { en: "Pro", ar: "برو" },
        amount: 700_000,
        method: "bankak_transfer" as const,
        reference: "SY-442036",
        payerName: String(sent.get("payerName")),
        transactionRef: String(sent.get("transactionRef")),
        receiptUrl: "/api/uploads/up-1",
        status: "pending_review" as const,
        createdAt: new Date().toISOString(),
      }
      db.payments.unshift(row)
      return Response.json(row)
    })
    await screen.findByRole("button", { name: "Submit payment for review" })
    fireEvent.change(screen.getByLabelText("Name on the transfer"), {
      target: { value: "Amal" },
    })
    fireEvent.change(screen.getByLabelText("Transaction number"), {
      target: { value: "TX123456" },
    })
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!
    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "receipt.png", { type: "image/png" })],
      },
    })
    expect(await screen.findByText("receipt.png")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Submit payment for review" })
    )
    expect(
      await screen.findByRole("heading", { name: "Payment submitted" })
    ).toBeTruthy()
    expect(
      Object.fromEntries(
        [...sent!.entries()].filter(([, v]) => typeof v === "string")
      )
    ).toEqual({
      itemType: "plan",
      itemId: "plan-dealer-pro",
      payerName: "Amal",
      transactionRef: "TX123456",
    })
    expect((sent!.get("receipt") as File).name).toBe("receipt.png")
    expect(screen.queryByLabelText("Transaction number")).toBeNull()
  })

  it("an item that already has a payment under review shows the pending state", async () => {
    payment("pending_review")
    await openCheckout("plan:plan-dealer-pro")
    expect(
      await screen.findByRole("heading", { name: "Payment submitted" })
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Payment history" })).toBeTruthy()
  })
})

describe("PromoteDialog", () => {
  it("creates an unpaid promotion for the chosen option and opens its checkout", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === dealer().id && l.moderation === "approved"
    )!
    const { router } = await renderShell(
      <PromoteDialog listingId={listing.id} onClose={() => {}} />,
      { role: "dealership", path: "/en/dealer/inventory" }
    )
    await screen.findByRole("radiogroup", { name: "Promote this listing" })
    expect(screen.getAllByRole("radio")).toHaveLength(4)
    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }))
    expect(
      await screen.findByText("Choose a promotion to continue")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: /Bump up/ }))
    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }))
    await waitFor(() =>
      expect(router.state.location.href).toMatch(
        /\/en\/dealer\/billing\/checkout\?item=promotion%3Apromo-/
      )
    )
    expect(
      db.promotions.find(
        (p) =>
          p.listingId === listing.id &&
          p.type === "bump" &&
          p.status === "pending_payment"
      )
    ).toBeTruthy()
  })
})

describe("PromoteDialog credits", () => {
  it("features the listing for 7 days with a plan credit, no checkout", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === dealer().id && l.moderation === "approved"
    )!
    const onClose = vi.fn()
    await renderShell(
      <PromoteDialog listingId={listing.id} onClose={onClose} />,
      { role: "dealership", path: "/en/dealer/inventory" }
    )
    expect(
      await screen.findByText(
        "A 7-day Featured. You have 3 of 3 credits left this month."
      )
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Use a credit" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(
      db.promotions.find(
        (p) =>
          p.listingId === listing.id &&
          p.source === "credit" &&
          p.type === "featured" &&
          p.durationDays === 7 &&
          p.status === "active"
      )
    ).toBeTruthy()
  })
})

describe("account billing, a buyer without a paid plan", () => {
  const omar = () => db.users.find((u) => u.id === "u-omar")!
  // The demo buyer starts on Plus, the only paid plan, so the plan tab has nothing to buy. Dropping that subscription makes him a free buyer.
  beforeEach(() => {
    db.subscriptions = db.subscriptions.filter((s) => s.userId !== omar().id)
    db.payments = db.payments.filter((p) => p.userId !== omar().id)
  })
  const open = (path: string, ui = <BillingPage audience="user" />) =>
    renderShell(<NowProvider serverNow={Date.now()}>{ui}</NowProvider>, {
      role: "user",
      path: `/en/account/billing${path}`,
    })
  const pay = (itemType: "plan" | "promotion", label: string) =>
    db.payments.unshift({
      id: newId("pay"),
      userId: omar().id,
      itemType,
      itemId: itemType === "plan" ? "plan-user-plus" : "promo-1",
      itemLabel: { en: label, ar: label },
      amount: 50_000,
      method: "bankak_transfer",
      reference: "SY-222222",
      payerName: "Omar Hassan",
      transactionRef: "TX123456",
      receiptUrl: "/mock/r.webp",
      status: "pending_review",
      createdAt: new Date().toISOString(),
    })

  it("shows Free as the current plan and Plus as the one to choose, which opens the account checkout", async () => {
    const { router } = await open("")
    const current = await screen.findByRole("region", { name: "Your plan" })
    expect(within(current).getByText("Free")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Plus" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/en/account/billing/checkout?item=plan%3Aplan-user-plus"
      )
    )
  })

  it("opens the checkout of Plus with the buyer's own reference", async () => {
    await open(
      "/checkout?item=plan:plan-user-plus",
      <CheckoutPage audience="user" />
    )
    expect(
      await screen.findByRole("heading", { name: "Pay by Bankak transfer" })
    ).toBeTruthy()
    expect(
      screen.getByText(paymentReference(omar().id, "plan-user-plus"))
    ).toBeTruthy()
  })

  it("lists a plan payment and a promotion payment in the history, both under review", async () => {
    pay("plan", "Plus plan")
    pay("promotion", "Pin for 7 days")
    await open("?tab=history")
    const table = await screen.findByRole("table", { name: "Payment history" })
    expect(await within(table).findByText("Plus plan")).toBeTruthy()
    expect(within(table).getByText("Pin for 7 days")).toBeTruthy()
    expect(within(table).getAllByText("Under review")).toHaveLength(2)
  })
})
