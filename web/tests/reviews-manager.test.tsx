import { Suspense } from "react"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DealershipProfilePage } from "@/features/directory/components/dealership-profile-page"
import { MechanicProfilePage } from "@/features/directory/components/mechanic-profile-page"
import { WorkshopProfilePage } from "@/features/directory/components/workshop-profile-page"
import { dealershipProfileSearchSchema } from "@/features/directory/schemas"
import { mechanicProfileSearchSchema } from "@/features/directory/mechanic-schemas"
import { workshopProfileSearchSchema } from "@/features/directory/workshop-schemas"
import { ReviewsManagerPage } from "@/features/reviews/components/reviews-manager-page"
import {
  pruneReviewsSearch,
  replySchema,
  reviewsSearchSchema,
} from "@/features/reviews/schemas"
import { db, resetDb } from "@/mocks/db"
import type { Review } from "@sayaratak/shared/schemas/review"
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

const owner = () =>
  db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
const biz = () => db.dealerships.find((d) => d.ownerId === owner().id)!
const add = (
  id: string,
  name: string,
  status: Review["status"],
  replied = false
) => {
  const at = new Date().toISOString()
  db.reviews.push({
    id,
    targetType: "dealership",
    targetId: biz().id,
    authorId: "u-omar",
    authorName: name,
    rating: 4,
    body: `Body of ${name}`,
    createdAt: at,
    status,
    reply: replied ? { body: "Thanks a lot", createdAt: at } : undefined,
  })
}
// A business with nothing but the reviews a test adds.
const fresh = () => {
  db.reviews = db.reviews.filter((r) => r.targetId !== biz().id)
  add("t-1", "Ali", "visible")
  add("t-2", "Bashir", "visible", true)
  add("t-3", "Chadi", "hidden")
  add("t-4", "Dina", "flagged")
}
const open = (search = "") => {
  fresh()
  return renderShell(<ReviewsManagerPage targetType="dealership" />, {
    role: "dealership",
    path: `/en/dealer/reviews${search}`,
  })
}
const item = async (name: string) =>
  (await screen.findByText(`Body of ${name}`)).closest("li")!

describe("search params and reply schema", () => {
  it("keep only what differs from the defaults", () => {
    expect(pruneReviewsSearch(reviewsSearchSchema.parse({}))).toEqual({})
    expect(
      pruneReviewsSearch(
        reviewsSearchSchema.parse({ filter: "needs_reply", page: "2" })
      )
    ).toEqual({ filter: "needs_reply", page: 2 })
    expect(reviewsSearchSchema.parse({ filter: "x", page: "0" })).toEqual({
      filter: "all",
      page: 1,
    })
  })
  it("a reply needs 2 to 500 characters", () => {
    expect(replySchema.safeParse({ body: " a " }).success).toBe(false)
    expect(replySchema.safeParse({ body: "ok" }).success).toBe(true)
    expect(replySchema.safeParse({ body: "x".repeat(501) }).success).toBe(false)
  })
})

describe("ReviewsManagerPage", () => {
  it("lists every review of the business with its status in words", async () => {
    await open()
    expect(await screen.findByText("Body of Ali")).toBeTruthy()
    expect(
      within(await item("Chadi")).getByText("Hidden by moderators")
    ).toBeTruthy()
    expect(within(await item("Dina")).getByText("Reported")).toBeTruthy()
    // A hidden review takes no reply and cannot be reported.
    const hidden = await item("Chadi")
    expect(within(hidden).queryByRole("button", { name: "Reply" })).toBeNull()
    expect(
      within(hidden).queryByRole("button", { name: "Report to moderators" })
    ).toBeNull()
  })

  it("Needs reply shows the unanswered visible reviews and writes itself to the URL", async () => {
    const { router } = await open()
    await screen.findByText("Body of Ali")
    fireEvent.click(screen.getByRole("button", { name: "Needs reply" }))
    await waitFor(() => expect(screen.queryByText("Body of Bashir")).toBeNull())
    expect(screen.getByText("Body of Ali")).toBeTruthy()
    expect(screen.getByText("Body of Dina")).toBeTruthy()
    expect(screen.queryByText("Body of Chadi")).toBeNull()
    expect(router.state.location.search).toMatchObject({
      filter: "needs_reply",
    })
  })

  it("Reply saves at once and the public list shows it", async () => {
    await open()
    const row = await item("Ali")
    fireEvent.click(within(row).getByRole("button", { name: "Reply" }))
    const box = within(row).getByRole("textbox", { name: "Your reply" })
    fireEvent.change(box, { target: { value: "x" } })
    fireEvent.click(within(row).getByRole("button", { name: "Post reply" }))
    expect(await within(row).findByText("Write a longer message")).toBeTruthy()
    fireEvent.change(box, { target: { value: "We are glad you came" } })
    fireEvent.click(within(row).getByRole("button", { name: "Post reply" }))
    await waitFor(() =>
      expect(db.reviews.find((r) => r.id === "t-1")?.reply?.body).toBe(
        "We are glad you came"
      )
    )
    expect(await within(row).findByText("We are glad you came")).toBeTruthy()
    // Focus goes back to the button that replaces the form.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(row).getByRole("button", { name: "Edit reply" })
      )
    )
    fireEvent.click(within(row).getByRole("button", { name: "Edit reply" }))
    expect(
      within(row).getByRole<HTMLTextAreaElement>("textbox", {
        name: "Your reply",
      }).value
    ).toBe("We are glad you came")
  })

  it("a reply shows on the public profile's Reviews tab", async () => {
    await open()
    const row = await item("Ali")
    fireEvent.click(within(row).getByRole("button", { name: "Reply" }))
    fireEvent.change(within(row).getByRole("textbox", { name: "Your reply" }), {
      target: { value: "Come back any time" },
    })
    fireEvent.click(within(row).getByRole("button", { name: "Post reply" }))
    expect(await within(row).findByText("Come back any time")).toBeTruthy()
    cleanup()
    await renderShell(
      <Suspense fallback={null}>
        <DealershipProfilePage
          slug={biz().slug}
          search={dealershipProfileSearchSchema.parse({ tab: "reviews" })}
        />
      </Suspense>
    )
    const card = (await screen.findByText("Body of Ali")).closest("li")!
    expect(within(card).getByText("Reply from the owner")).toBeTruthy()
    expect(within(card).getByText("Come back any time")).toBeTruthy()
    // The visitor sees the reply, not the owner's controls.
    expect(
      within(card).queryByRole("button", { name: "Edit reply" })
    ).toBeNull()
    expect(screen.queryByText("Body of Chadi")).toBeNull()
  })
  it("a workshop's reply shows on its public profile's Reviews tab", async () => {
    const shop = db.workshops.find((w) =>
      db.users.some((u) => u.id === w.ownerId && u.onboardingDone)
    )!
    db.reviews = db.reviews.filter((r) => r.targetId !== shop.id)
    db.reviews.push({
      id: "t-w",
      targetType: "workshop",
      targetId: shop.id,
      authorId: "u-omar",
      authorName: "Ali",
      rating: 5,
      body: "Body of Ali",
      createdAt: new Date().toISOString(),
      status: "visible",
    })
    await renderShell(<ReviewsManagerPage targetType="workshop" />, {
      role: "workshop",
      path: "/en/workshop/reviews",
    })
    const row = await item("Ali")
    fireEvent.click(within(row).getByRole("button", { name: "Reply" }))
    fireEvent.change(within(row).getByRole("textbox", { name: "Your reply" }), {
      target: { value: "Thanks for trusting us" },
    })
    fireEvent.click(within(row).getByRole("button", { name: "Post reply" }))
    expect(await within(row).findByText("Thanks for trusting us")).toBeTruthy()
    cleanup()
    await renderShell(
      <Suspense fallback={null}>
        <WorkshopProfilePage
          slug={shop.slug}
          search={workshopProfileSearchSchema.parse({ tab: "reviews" })}
        />
      </Suspense>
    )
    const card = (await screen.findByText("Body of Ali")).closest("li")!
    expect(within(card).getByText("Reply from the owner")).toBeTruthy()
    expect(within(card).getByText("Thanks for trusting us")).toBeTruthy()
  })

  it("a mechanic's reply shows on its public profile's Reviews tab", async () => {
    const mechanic = db.mechanics.find((m) =>
      db.users.some((u) => u.id === m.ownerId && u.onboardingDone)
    )!
    db.reviews = db.reviews.filter((r) => r.targetId !== mechanic.id)
    db.reviews.push({
      id: "t-m",
      targetType: "mechanic",
      targetId: mechanic.id,
      authorId: "u-omar",
      authorName: "Hassan",
      rating: 4,
      body: "Body of Hassan",
      createdAt: new Date().toISOString(),
      status: "visible",
    })
    await renderShell(<ReviewsManagerPage targetType="mechanic" />, {
      role: "mechanic",
      path: "/en/mechanic/reviews",
    })
    const row = await item("Hassan")
    fireEvent.click(within(row).getByRole("button", { name: "Reply" }))
    fireEvent.change(within(row).getByRole("textbox", { name: "Your reply" }), {
      target: { value: "Glad the car runs well" },
    })
    fireEvent.click(within(row).getByRole("button", { name: "Post reply" }))
    expect(await within(row).findByText("Glad the car runs well")).toBeTruthy()
    cleanup()
    await renderShell(
      <Suspense fallback={null}>
        <MechanicProfilePage
          slug={mechanic.slug}
          search={mechanicProfileSearchSchema.parse({ tab: "reviews" })}
        />
      </Suspense>
    )
    const card = (await screen.findByText("Body of Hassan")).closest("li")!
    expect(within(card).getByText("Reply from the owner")).toBeTruthy()
    expect(within(card).getByText("Glad the car runs well")).toBeTruthy()
  })

  it("Report asks first, then marks the review Reported", async () => {
    await open()
    const row = await item("Ali")
    fireEvent.click(
      within(row).getByRole("button", { name: "Report to moderators" })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(db.reviews.find((r) => r.id === "t-1")?.status).toBe("visible")
    fireEvent.click(within(dialog).getByRole("button", { name: "Report" }))
    await waitFor(() =>
      expect(db.reviews.find((r) => r.id === "t-1")?.status).toBe("flagged")
    )
    expect(await within(row).findByText("Reported")).toBeTruthy()
    expect(
      within(row).queryByRole("button", { name: "Report to moderators" })
    ).toBeNull()
  })

  it("shows an error with Retry when the list fails, and recovers", async () => {
    document.cookie = "mock_fail=500; Path=/"
    await open()
    expect(await screen.findByText("Could not load reviews")).toBeTruthy()
    document.cookie = "mock_fail=; Path=/; Max-Age=0"
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Body of Ali")).toBeTruthy()
  })

  it("says so when the business has no reviews", async () => {
    db.reviews = db.reviews.filter((r) => r.targetId !== biz().id)
    await renderShell(<ReviewsManagerPage targetType="dealership" />, {
      role: "dealership",
      path: "/en/dealer/reviews",
    })
    expect(await screen.findByText("No reviews yet")).toBeTruthy()
  })
})
