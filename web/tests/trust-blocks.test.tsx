import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authGate, closeAuthGate } from "@/features/auth/auth-gate"
import { reportSchema } from "@sayaratak/shared/listings/schemas"
import { messageSchema } from "@/features/messaging/schemas"
import { reviewSchema } from "@/features/reviews/schemas"
import { ContactActions } from "@/components/app/contact-actions"
import { MessageComposer } from "@/components/app/message-composer"
import { ReportDialog } from "@/components/app/report-dialog"
import { ReviewsSection } from "@/components/app/reviews-section"
import { SafetyTips } from "@/components/app/safety-tips"
import { ShareMenu } from "@/components/app/share-menu"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

const listing = () => db.listings.find((l) => l.kind === "vehicle")!
const target = () => ({
  type: "listing" as const,
  id: listing().id,
  title: listing().title,
})
const contact = () => (
  <ContactActions
    target={target()}
    phone="+249912345678"
    whatsapp="+249912345678"
  />
)

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  closeAuthGate()
  vi.unstubAllGlobals()
})

describe("schemas", () => {
  it("message needs text, report 'other' needs details, review needs a rating", () => {
    expect(messageSchema.safeParse({ body: "  " }).success).toBe(false)
    expect(reportSchema.safeParse({ reason: "scam" }).success).toBe(true)
    expect(reportSchema.safeParse({ reason: "other" }).success).toBe(false)
    expect(reviewSchema.safeParse({ rating: 0 }).success).toBe(false)
    expect(reviewSchema.safeParse({ rating: 4, body: "short" }).success).toBe(
      false
    )
    expect(reviewSchema.safeParse({ rating: 4 }).success).toBe(true)
  })
})

describe("ContactActions", () => {
  it("reveals the number on the first tap, dials on the second, and logs phone_click", async () => {
    await renderShell(contact())
    const before = listing().stats.phoneClicks
    fireEvent.click(screen.getByRole("button", { name: "Call" }))
    const link = await screen.findByRole("link", { name: /Call/ })
    expect(link.getAttribute("href")).toBe("tel:+249912345678")
    await waitFor(() => expect(listing().stats.phoneClicks).toBe(before + 1))
  })

  it("WhatsApp opens wa.me with the number and text, and logs whatsapp_click", async () => {
    await renderShell(contact())
    const before = listing().stats.whatsappClicks
    const link = screen.getByRole("link", { name: "WhatsApp" })
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/249912345678\?text=/
    )
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      listing().title
    )
    fireEvent.click(link)
    await waitFor(() => expect(listing().stats.whatsappClicks).toBe(before + 1))
  })

  it("does not render what the seller turned off", async () => {
    await renderShell(
      <ContactActions
        target={target()}
        phone="+249912345678"
        whatsapp={null}
        showPhone={false}
        methods={["call", "whatsapp", "chat"]}
      />
    )
    expect(screen.queryByRole("button", { name: "Call" })).toBeNull()
    expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull()
    expect(screen.getByRole("button", { name: "Message" })).toBeTruthy()
  })
})

describe("MessageComposer", () => {
  it("opens the sign in gate for a visitor", async () => {
    await renderShell(<MessageComposer subject={target()} />)
    fireEvent.click(screen.getByRole("button", { name: "Message" }))
    expect(authGate.state.open).toBe(true)
  })

  it("starts a thread with the first message", async () => {
    await renderShell(<MessageComposer subject={target()} />, { role: "user" })
    const threads = db.threads.length
    fireEvent.click(screen.getByRole("button", { name: "Message" }))
    fireEvent.click(await screen.findByRole("button", { name: "Send" }))
    expect(await screen.findByText("This field is required")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "Is it still available?" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(db.threads.length).toBe(threads + 1))
  })
})

describe("ReportDialog", () => {
  it("needs a reason, and details for 'Other', then files the report", async () => {
    await renderShell(<ReportDialog listingId={listing().id} />, {
      role: "user",
    })
    const reports = db.reports.length
    fireEvent.click(screen.getByRole("button", { name: "Report" }))
    fireEvent.click(await screen.findByRole("button", { name: "Send report" }))
    expect(await screen.findByText("This field is required")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "Other" }))
    fireEvent.click(screen.getByRole("button", { name: "Send report" }))
    expect(await screen.findByText("Add some details")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "Scam or fraud" }))
    fireEvent.click(screen.getByRole("button", { name: "Send report" }))
    await waitFor(() => expect(db.reports.length).toBe(reports + 1))
  })
})

describe("ReviewsSection", () => {
  const dealer = () => db.dealerships[0]!
  const section = (ownerId = dealer().ownerId) => (
    <ReviewsSection
      targetType="dealership"
      targetId={dealer().id}
      ownerId={ownerId}
      rating={dealer().rating}
    />
  )

  it("hides the write button from the owner", async () => {
    await renderShell(section(), { role: "dealership" })
    await screen.findByRole("heading", { name: "Reviews" })
    expect(screen.queryByRole("button", { name: "Write a review" })).toBeNull()
  })

  it("posts a review, then offers edit instead of write", async () => {
    await renderShell(section(), { role: "user" })
    const before = db.reviews.length
    fireEvent.click(screen.getByRole("button", { name: "Write a review" }))
    fireEvent.click(await screen.findByRole("button", { name: "Post review" }))
    expect(await screen.findByText("Choose a rating")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: "5 out of 5 stars" }))
    fireEvent.change(screen.getByLabelText(/Your review/), {
      target: { value: "Fast and honest service." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Post review" }))
    await waitFor(() => expect(db.reviews.length).toBe(before + 1))
    expect(
      await screen.findByRole("button", { name: "Edit your review" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Write a review" })).toBeNull()
  })
})

describe("ShareMenu", () => {
  it("copies the link and logs a share event", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    await renderShell(<ShareMenu listing={listing()} title="x" />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy link" }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/listing/${listing().id}$`))
      )
    )
    await waitFor(() =>
      expect(
        db.events.some((e) => e.targetId === listing().id && e.counts.share > 0)
      ).toBe(true)
    )
  })

  it("puts the title, price and short link in the WhatsApp text", async () => {
    await renderShell(<ShareMenu listing={listing()} title="x" />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    const href = (
      await screen.findByRole("menuitem", { name: "WhatsApp" })
    ).getAttribute("href")
    const text = new URL(href ?? "").searchParams.get("text") ?? ""
    expect(text).toMatch(/^x · [\d,]+ /)
    expect(text).toMatch(new RegExp(`\\n.*/listing/${listing().id}$`))
  })
})

describe("SafetyTips", () => {
  it("lists four tips", async () => {
    await renderShell(<SafetyTips />)
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
  })
})
