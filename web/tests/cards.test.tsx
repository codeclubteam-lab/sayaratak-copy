import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authGate, closeAuthGate } from "@/features/auth/auth-gate"
import { isOpenNow } from "@/lib/hours"
import { NowProvider } from "@/lib/now"
import { isFeatured, promotionLabel } from "@/lib/promotion"
import type { TFunction } from "i18next"
import {
  dealershipSchema,
  mechanicSchema,
} from "@sayaratak/shared/schemas/profile"
import { listingSchema, type Listing } from "@sayaratak/shared/schemas/listing"
import { DealershipCard } from "@/components/app/dealership-card"
import { FavoriteButton } from "@/components/app/favorite-button"
import { ListingCard } from "@/components/app/listing-card"
import { MechanicCard } from "@/components/app/mechanic-card"
import { PriceText } from "@/components/app/price-text"
import { RatingStars } from "@/components/app/rating-stars"
import { RatingSummary } from "@/components/app/rating-summary"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

// Monday 5 October 2026, 08:00 in Khartoum (UTC+2).
const MON_8AM = Date.UTC(2026, 9, 5, 6, 0)
const hours = Array.from({ length: 7 }, (_, day) => ({
  day,
  closed: day === 0,
  open: "08:00",
  close: "17:00",
}))

const listing = (patch: Partial<Listing> = {}): Listing => ({
  ...listingSchema.parse(db.listings.find((l) => l.kind === "vehicle")),
  status: "available",
  promotions: [],
  ...patch,
})
const withNow = (ui: React.ReactNode, now = MON_8AM) => (
  <NowProvider serverNow={now}>{ui}</NowProvider>
)

// NowProvider swaps in Date.now() after mount, so the test freezes Date and leaves timers alone.
beforeEach(() => {
  resetDb()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(MON_8AM)
})
afterEach(() => {
  closeAuthGate()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("listing title", () => {
  it.each(["en", "ar"] as const)(
    "is built from the taxonomy in the page language (%s), not the seller's typed text",
    async (locale) => {
      const row = db.listings.find(
        (l) => l.kind === "vehicle" && l.makeId && l.modelId && l.year
      )!
      const make = db.taxonomy.makes.find((m) => m.id === row.makeId)!
      const model = db.taxonomy.models.find((m) => m.id === row.modelId)!
      await renderShell(
        withNow(<ListingCard listing={listing({ ...row, title: "typed" })} />),
        { locale }
      )
      expect(
        await screen.findByText(
          `${make.name[locale]} ${model.name[locale]} ${row.year}`
        )
      ).toBeTruthy()
      expect(screen.queryByText("typed")).toBeNull()
    }
  )
})

describe("hours and promotions", () => {
  it("reads opening hours on the Khartoum clock", () => {
    expect(isOpenNow(hours, MON_8AM)).toBe(true)
    expect(isOpenNow(hours, MON_8AM - 60_000)).toBe(false) // 07:59
    expect(isOpenNow(hours, MON_8AM + 9 * 3_600_000)).toBe(false) // 17:00 sharp
    expect(isOpenNow(hours, MON_8AM - 24 * 3_600_000)).toBe(false) // Sunday is closed
  })

  it("is featured only while a Featured promotion runs; a bump leaves no badge", () => {
    const iso = (offset: number) => new Date(MON_8AM + offset).toISOString()
    const run = (type: "featured" | "bump", from: number, to: number) => ({
      type,
      startsAt: iso(from),
      endsAt: iso(to),
    })
    expect(isFeatured([], MON_8AM)).toBe(false)
    expect(isFeatured([run("featured", -1000, 1000)], MON_8AM)).toBe(true)
    expect(isFeatured([run("bump", -1000, 1000)], MON_8AM)).toBe(false)
    expect(isFeatured([run("featured", -2000, -1000)], MON_8AM)).toBe(false)
    expect(isFeatured([run("featured", 1000, 2000)], MON_8AM)).toBe(false)
  })

  it("promotionLabel names the length of a Featured row, never of a bump", () => {
    const t = ((key: string, o?: { count: number }) =>
      o ? `${key}:${o.count}` : key) as unknown as TFunction
    expect(promotionLabel(t, { type: "featured", durationDays: 7 })).toBe(
      "promotion.name_featured, billing.duration_days:7"
    )
    expect(promotionLabel(t, { type: "bump", durationDays: 0 })).toBe(
      "promotion.name_bump"
    )
  })
})

describe("ListingCard", () => {
  it("links the title to the listing and keeps the heart outside the link", async () => {
    const l = listing({ title: "Toyota Hilux 2019", price: 24_500_000 })
    await renderShell(withNow(<ListingCard listing={l} />))
    const link = screen.getByRole("link", { name: "Toyota Hilux 2019" })
    expect(link.getAttribute("href")).toBe(`/en/listing/${l.slug}`)
    const heart = screen.getByRole("button", { name: "Save to favorites" })
    expect(link.contains(heart)).toBe(false)
    expect(heart.getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByText("24,500,000")).toBeTruthy()
  })

  it("badges: Featured, Verified and a status other than available", async () => {
    const l = listing({
      status: "reserved",
      owner: { ...listing().owner, verified: true },
      promotions: [
        {
          type: "featured",
          startsAt: new Date(MON_8AM - 1000).toISOString(),
          endsAt: new Date(MON_8AM + 1000).toISOString(),
        },
      ],
    })
    await renderShell(withNow(<ListingCard listing={l} variant="row" />))
    for (const name of ["Featured", "Verified", "Reserved"])
      expect(screen.getByText(name)).toBeTruthy()
  })

  it("shows no status badge for an available listing", async () => {
    await renderShell(withNow(<ListingCard listing={listing()} />))
    expect(screen.queryByText("Available")).toBeNull()
  })

  it("renders a 90-character Arabic title with the city and relative time in Arabic", async () => {
    const title = "تويوتا هايلكس ".repeat(8).slice(0, 90)
    const l = listing({
      title,
      createdAt: new Date(MON_8AM - 3 * 3_600_000).toISOString(),
    })
    await renderShell(withNow(<ListingCard listing={l} />), { locale: "ar" })
    expect(screen.getByRole("link", { name: title })).toBeTruthy()
    expect(screen.getByText("جنيه")).toBeTruthy()
    expect(screen.getByText(/قبل 3 ساعات|منذ 3 ساعات/)).toBeTruthy()
  })
})

describe("FavoriteButton", () => {
  it("opens the sign in dialog for a visitor and changes nothing", async () => {
    await renderShell(<FavoriteButton listingId="x" />)
    fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }))
    expect(authGate.state.open).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Save to favorites" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("toggles at once for a signed-in user and saves it in the mock DB", async () => {
    const id = db.listings[0]!.id
    await renderShell(<FavoriteButton listingId={id} />, { role: "user" })
    const button = screen.getByRole("button", { name: "Save to favorites" })
    fireEvent.click(button)
    await waitFor(() =>
      expect(button.getAttribute("aria-pressed")).toBe("true")
    )
    await waitFor(() =>
      expect(db.favorites.some((f) => f.listingId === id)).toBe(true)
    )
    fireEvent.click(button)
    await waitFor(() =>
      expect(button.getAttribute("aria-pressed")).toBe("false")
    )
    await waitFor(() =>
      expect(db.favorites.some((f) => f.listingId === id)).toBe(false)
    )
  })
})

describe("PriceText", () => {
  it("adds the rent period at caption size", async () => {
    await renderShell(<PriceText price={50_000} period="day" />)
    expect(screen.getByText("50,000")).toBeTruthy()
    expect(screen.getByText("SDG")).toBeTruthy()
    expect(screen.getByText("per day")).toBeTruthy()
  })
})

describe("provider cards", () => {
  it("shows the open now text and the city name for a dealership", async () => {
    const d = dealershipSchema.parse({
      ...db.dealerships[0],
      inventoryCount: 0,
      hours,
    })
    await renderShell(withNow(<DealershipCard dealership={d} />))
    expect(
      screen.getByRole("link", { name: d.name.en }).getAttribute("href")
    ).toBe(`/en/dealerships/${d.slug}`)
    expect(screen.getByText("Open now")).toBeTruthy()
    const city = db.taxonomy.cities.find((c) => c.id === d.cityId)!
    expect(await screen.findByText(city.name.en)).toBeTruthy()
  })

  it.each(["en", "ar"] as const)(
    "shows the business name and description in %s",
    async (locale) => {
      const d = dealershipSchema.parse({
        ...db.dealerships[1],
        inventoryCount: 0,
      })
      await renderShell(withNow(<DealershipCard dealership={d} />), { locale })
      expect(screen.getByRole("link", { name: d.name[locale] })).toBeTruthy()
      expect(screen.getByText(d.description[locale])).toBeTruthy()
    }
  )

  it("shows availability, not hours, for a mechanic", async () => {
    const m = mechanicSchema.parse({ ...db.mechanics[0], available: false })
    await renderShell(<MechanicCard mechanic={m} />)
    expect(screen.getByText("Unavailable")).toBeTruthy()
    expect(screen.queryByText("Open now")).toBeNull()
  })
})

describe("ratings", () => {
  it("picks a rating from the radio group", async () => {
    const onChange = vi.fn()
    await renderShell(
      <RatingStars value={2} onChange={onChange} label="Your rating" />
    )
    const group = screen.getByRole("group", { name: "Your rating" })
    expect(within(group).getAllByRole("radio")).toHaveLength(5)
    expect(
      within(group).getByLabelText<HTMLInputElement>("2 out of 5 stars").checked
    ).toBe(true)
    fireEvent.click(within(group).getByLabelText("5 out of 5 stars"))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  // Native radios sharing one name: the browser moves between them with the arrow keys and Tab stops once, on the checked one.
  it("is one keyboard stop whose arrows pick the rating", async () => {
    const onChange = vi.fn()
    await renderShell(
      <RatingStars value={3} onChange={onChange} label="Your rating" />
    )
    const radios = within(
      screen.getByRole("group", { name: "Your rating" })
    ).getAllByRole<HTMLInputElement>("radio")
    expect(new Set(radios.map((r) => r.name)).size).toBe(1)
    expect(radios.every((r) => r.tabIndex === 0)).toBe(true)
    radios[2]!.focus()
    expect(document.activeElement).toBe(radios[2])
    fireEvent.click(radios[3]!)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it("labels each histogram row and handles zero reviews", async () => {
    await renderShell(
      <RatingSummary avg={4.2} count={50} histogram={[2, 3, 5, 15, 25]} />
    )
    expect(screen.getByLabelText("5 stars: 25")).toBeTruthy()
    expect(screen.getByLabelText("1 star: 2")).toBeTruthy()
    expect(screen.getByText("50 reviews")).toBeTruthy()
  })

  it("says so when there are no reviews", async () => {
    await renderShell(<RatingSummary avg={0} count={0} />)
    expect(screen.getByText("No reviews yet")).toBeTruthy()
  })
})
