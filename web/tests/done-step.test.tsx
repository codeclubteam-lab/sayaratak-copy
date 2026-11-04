import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DoneStep } from "@/features/listings/wizard/done-step"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

// The signed-in person `renderShell` uses, and one listing made theirs with the given review state.
const owner = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
function own(moderation: "approved" | "pending" | "rejected") {
  const row = db.listings[0]!
  row.ownerUserId = owner().id
  row.owner.id = owner().id
  row.moderation = moderation
  return row
}
const open = (
  id: string | undefined,
  options: Parameters<typeof renderShell>[1] = { role: "user" }
) =>
  renderShell(<DoneStep context="public" listingId={id} />, {
    path: `/en/post?step=done${id ? `&listing=${id}` : ""}`,
    ...options,
  })
const where = (router: { state: { location: { href: string } } }) =>
  router.state.location.href

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
})

describe("DoneStep", () => {
  it("a pending listing waits for review: no View listing, no offer, one line about promoting later", async () => {
    const row = own("pending")
    await open(row.id)
    expect(
      await screen.findByRole("heading", {
        name: "Your listing is waiting for review",
      })
    ).toBeTruthy()
    expect(
      screen.getByText("You can promote this listing after it is approved")
    ).toBeTruthy()
    expect(screen.queryByRole("link", { name: "View listing" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Get more views" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull()
    expect(
      screen
        .getByRole("link", { name: "Go to my listings" })
        .getAttribute("href")
    ).toBe("/en/account/listings")
    expect(
      screen.getByRole("link", { name: "Post another" }).getAttribute("href")
    ).toBe("/en/post")
  })

  it("an approved listing is live: View listing, Share and the four promotions with their prices", async () => {
    const row = own("approved")
    await open(row.id)
    expect(
      await screen.findByRole("heading", { name: "Your listing is live" })
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "View listing" }).getAttribute("href")
    ).toBe(`/en/listing/${row.slug}`)
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy()
    expect(
      await screen.findByRole("heading", { name: "Get more views" })
    ).toBeTruthy()
    expect(screen.getAllByRole("radio")).toHaveLength(db.promotionPrices.length)
  })

  it("Share sends the address of the listing, not of the wizard", async () => {
    const row = own("approved")
    await open(row.id)
    fireEvent.click(await screen.findByRole("button", { name: "Share" }))
    const link = await screen.findByRole("menuitem", { name: "WhatsApp" })
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      `/en/listing/${row.id}`
    )
    expect(link.getAttribute("href")).not.toContain("step")
  })

  it("Continue without a choice shows an error and creates nothing", async () => {
    const before = db.promotions.length
    await open(own("approved").id)
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue to payment" })
    )
    expect(
      await screen.findByText("Choose a promotion to continue")
    ).toBeTruthy()
    expect(db.promotions).toHaveLength(before)
  })

  it("a chosen promotion becomes an unpaid promotion and opens its checkout", async () => {
    const row = own("approved")
    const before = db.promotions.length
    const { router } = await open(row.id)
    fireEvent.click(await screen.findByRole("radio", { name: /Bump up/ }))
    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }))
    await waitFor(() => expect(where(router)).toContain("/billing/checkout"))
    expect(db.promotions).toHaveLength(before + 1)
    const promo = db.promotions.at(-1)
    expect(promo).toMatchObject({
      listingId: row.id,
      type: "bump",
      status: "pending_payment",
    })
    expect(decodeURIComponent(where(router))).toBe(
      `/en/account/billing/checkout?item=promotion:${promo?.id}`
    )
  })

  it("Not now closes the offer and creates no promotion", async () => {
    const row = own("approved")
    const before = db.promotions.length
    await open(row.id)
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }))
    expect(screen.queryByRole("heading", { name: "Get more views" })).toBeNull()
    expect(screen.getByRole("link", { name: "View listing" })).toBeTruthy()
    expect(db.promotions).toHaveLength(before)
  })

  it.each([
    ["no listing in the URL", () => undefined, { role: "user" as const }],
    [
      "a listing of someone else",
      () => db.listings[1]!.id,
      { role: "user" as const },
    ],
    [
      "a listing that was rejected",
      () => own("rejected").id,
      { role: "user" as const },
    ],
    ["a signed out visitor", () => own("approved").id, {}],
  ])("%s goes back to the first step", async (_name, id, options) => {
    db.listings[1]!.ownerUserId = "someone-else"
    db.listings[1]!.owner.id = "someone-else"
    const { router } = await open(id(), options)
    await waitFor(() => expect(where(router)).toBe("/en/post"))
    expect(screen.queryByRole("heading", { name: /Your listing/ })).toBeNull()
  })
})
