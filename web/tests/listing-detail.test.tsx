import { Suspense, type ReactNode } from "react"
import { QueryClient } from "@tanstack/react-query"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ListingDetailPage } from "@/features/listings/components/listing-detail-page"
import { listingLoader } from "@/features/listings/detail-loader"
import { listingJsonLd } from "@/features/listings/json-ld"
import { sellerHref, similarHref } from "@/features/listings/links"
import { listingTitle } from "@/lib/listing-title"
import { NowProvider } from "@/lib/now"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { Description } from "@/features/listings/components/description"
import { db, resetDb } from "@/mocks/db"
import type { ListingRow } from "@/mocks/types"
import { pick } from "./pick"
import { renderShell } from "./shell-render"
import { useMockFetch } from "./mock-fetch"

const NOW = Date.UTC(2026, 9, 5, 6, 0)
const page = (slug: string): ReactNode => (
  <NowProvider serverNow={NOW}>
    <Suspense fallback={null}>
      <ListingDetailPage slug={slug} />
    </Suspense>
  </NowProvider>
)
const live = (where: (l: ListingRow) => boolean = () => true) =>
  db.listings.find(
    (l) =>
      l.moderation === "approved" &&
      l.status === "available" &&
      l.contact.showPhone &&
      l.contact.whatsapp &&
      l.contact.methods.includes("chat") &&
      where(l)
  )!

// The CopyButton has a status region too, so the banner is found by its slot.
const banner = () =>
  document.querySelector<HTMLElement>('[data-slot="status-banner"]')!

beforeEach(() => {
  resetDb()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe("listing detail, visitor", () => {
  it("shows the built title, facts, specs, seller and the three contact actions", async () => {
    const row = live((l) => l.kind === "vehicle" && !!l.makeId && !!l.modelId)
    await renderShell(page(row.slug))
    const tax = taxonomySchema.parse(db.taxonomy)
    const title = listingTitle(listingSchema.parse(row), tax, "en")
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      title
    )
    expect(screen.getByRole("heading", { name: "Specifications" })).toBeTruthy()
    expect(screen.getAllByText(row.owner.name.en).length).toBeGreaterThan(0)
    // The seller card shows twice (aside and in-flow copy); only the aside has the buttons.
    expect(screen.getAllByRole("button", { name: "Call" }).length).toBe(2) // aside and bar
    expect(screen.getAllByRole("link", { name: "WhatsApp" }).length).toBe(2)
    expect(screen.getAllByRole("button", { name: "Message" }).length).toBe(2)
    expect(document.querySelector("[data-mobile-contact-bar]")).not.toBeNull()
  })

  it("Call reveals the number on the first press and logs one phone_click", async () => {
    const row = live()
    const before = row.stats.phoneClicks
    await renderShell(page(row.slug))
    const [call] = await screen.findAllByRole("button", { name: "Call" })
    fireEvent.click(call!)
    const dial = await screen.findByRole("link", { name: /^Call \+249/ })
    expect(dial.getAttribute("href")).toBe(`tel:${row.contact.phone}`)
    await waitFor(() => expect(row.stats.phoneClicks).toBe(before + 1))
  })

  it("WhatsApp opens wa.me with the listing in the text and logs whatsapp_click", async () => {
    const row = live()
    const before = row.stats.whatsappClicks
    await renderShell(page(row.slug))
    const [link] = await screen.findAllByRole("link", { name: "WhatsApp" })
    expect(link!.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/249/)
    expect(decodeURIComponent(link!.getAttribute("href")!)).toContain(
      "Hello, I saw your listing"
    )
    fireEvent.click(link!)
    await waitFor(() => expect(row.stats.whatsappClicks).toBe(before + 1))
  })

  it("sends one view per browser session", async () => {
    const row = live()
    const before = row.stats.views
    const first = await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    await waitFor(() => expect(row.stats.views).toBe(before + 1))
    expect(sessionStorage.getItem(`viewed:${row.id}`)).toBe("1")
    first.unmount()
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    await new Promise((r) => setTimeout(r, 50))
    expect(row.stats.views).toBe(before + 1)
  })

  it("hides Call when the seller hides the phone and WhatsApp when there is none", async () => {
    const row = live()
    row.contact.showPhone = false
    row.contact.whatsapp = null
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByRole("button", { name: "Call" })).toBeNull()
    expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull()
    expect(screen.getAllByRole("button", { name: "Message" }).length).toBe(2)
  })

  it("mounts no contact bar when no channel is left", async () => {
    const row = live()
    row.contact.showPhone = false
    row.contact.whatsapp = null
    row.contact.methods = ["call"]
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    expect(document.querySelector("[data-mobile-contact-bar]")).toBeNull()
  })

  it.each([
    ["reserved", /^Reserved\./],
    ["sold", /^Sold\./],
    ["rented", /^Rented\./],
  ] as const)("shows a %s banner to everyone", async (status, text) => {
    const row = live()
    row.status = status
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    expect(within(banner()).getByText(text)).toBeTruthy()
  })

  it("shows nothing for an available listing", async () => {
    const row = live()
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    expect(banner().textContent).toBe("")
  })

  it("says the location is approximate for a visitor", async () => {
    const row = live((l) => !!l.location)
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    expect(screen.getByText("Approximate location")).toBeTruthy()
  })

  it("renders in Arabic with the Arabic labels and a right to left safe title", async () => {
    const row = live((l) => l.kind === "vehicle")
    await renderShell(page(row.slug), { locale: "ar" })
    await screen.findByRole("heading", { level: 1 })
    expect(screen.getByRole("heading", { name: "المواصفات" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "اتصال" }).length).toBe(2)
    expect(
      screen.getByRole("heading", { level: 1 }).querySelector("bdi")
    ).not.toBeNull()
  })

  it("a part has no year or mileage in its facts", async () => {
    const row = live((l) => l.kind === "part")
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByText("Mileage")).toBeNull()
    expect(screen.getAllByText("Condition").length).toBeGreaterThan(0)
  })
})

describe("listing detail, owner", () => {
  const owned = (pred: (l: ListingRow) => boolean) => {
    const me = db.users.find((u) => u.role === "user" && u.onboardingDone)!
    return db.listings.find((l) => l.ownerUserId === me.id && pred(l))!
  }

  it("replaces the contact actions with the owner panel and hides report", async () => {
    const row = owned((l) => l.moderation === "approved")
    await renderShell(page(row.slug), { role: "user" })
    await screen.findByRole("heading", { level: 1 })
    expect(screen.getAllByText("Your listing").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Call" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Report" })).toBeNull()
    expect(document.querySelector("[data-mobile-contact-bar]")).toBeNull()
    const edit = screen.getAllByRole("link", { name: "Edit" })[0]!
    expect(edit.getAttribute("href")).toBe(`/en/post?edit=${row.id}`)
    expect(
      screen.getAllByRole("link", { name: "Promote" })[0]!.getAttribute("href")
    ).toBe("/en/account/listings")
  })

  it("explains a pending listing and offers no promotion yet", async () => {
    const row = owned((l) => l.moderation === "pending")
    await renderShell(page(row.slug), { role: "user" })
    await screen.findByRole("heading", { level: 1 })
    expect(within(banner()).getByText(/^Pending review\./)).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Promote" })).toBeNull()
    expect(
      screen.getAllByText("You can promote this listing after it is approved")
        .length
    ).toBeGreaterThan(0)
  })

  it("shows the rejection reason", async () => {
    const row = owned((l) => l.moderation === "rejected")
    await renderShell(page(row.slug), { role: "user" })
    await screen.findByRole("heading", { level: 1 })
    expect(banner().textContent).toContain(row.rejectionReason)
  })

  it("changing the status saves it, shows the banner and keeps it after a refetch", async () => {
    const row = owned(
      (l) =>
        l.moderation === "approved" &&
        l.status === "available" &&
        l.intent === "sale"
    )
    const { client } = await renderShell(page(row.slug), { role: "user" })
    await screen.findByRole("heading", { level: 1 })
    const [select] = screen.getAllByRole("combobox", { name: "Change status" })
    await pick(select!, "Sold")
    await waitFor(() => expect(row.status).toBe("sold"))
    expect(await within(banner()).findByText(/^Sold\./)).toBeTruthy()
    await client.invalidateQueries()
    await waitFor(() =>
      expect(within(banner()).getByText(/^Sold\./)).toBeTruthy()
    )
  })

  it("a dealership edits through its own inventory", async () => {
    const dealer = db.users.find(
      (u) => u.role === "dealership" && u.onboardingDone
    )!
    const row = db.listings.find(
      (l) => l.ownerUserId === dealer.id && l.moderation === "approved"
    )!
    expect(row.owner.id).toBe(dealer.id)
    await renderShell(page(row.slug), { role: "dealership" })
    await screen.findByRole("heading", { level: 1 })
    expect(
      screen.getAllByRole("link", { name: "Edit" })[0]!.getAttribute("href")
    ).toBe(`/en/dealer/inventory/${row.id}/edit`)
  })
})

describe("listing loader", () => {
  const ctx = () => {
    useMockFetch()
    return { queryClient: new QueryClient(), locale: "en" as const }
  }

  it("returns head data and keeps an available listing indexable", async () => {
    const row = live()
    const data = await listingLoader(ctx(), row.slug)
    expect(data.noindex).toBe(false)
    expect(data.slug).toBe(row.slug)
    expect(data.title.length).toBeGreaterThan(0)
    expect(data.description.length).toBeLessThanOrEqual(155)
  })

  it.each(["reserved", "sold", "rented"] as const)(
    "marks a %s listing noindex",
    async (status) => {
      const row = live()
      row.status = status
      expect((await listingLoader(ctx(), row.slug)).noindex).toBe(true)
    }
  )

  it("throws not found for an unknown listing", async () => {
    await expect(listingLoader(ctx(), "nothing-lzzzzz")).rejects.toMatchObject({
      isNotFound: true,
    })
  })

  it("redirects a slug with the wrong words to the canonical one", async () => {
    const row = live()
    await expect(
      listingLoader(ctx(), `wrong-words-${row.id}`)
    ).rejects.toMatchObject({ options: { statusCode: 301 } })
  })

  it("a pending listing is a 404 for a visitor", async () => {
    const row = db.listings.find((l) => l.moderation === "pending")!
    await expect(listingLoader(ctx(), row.slug)).rejects.toMatchObject({
      isNotFound: true,
    })
  })
})

describe("structured data and links", () => {
  const meta = {
    title: "Toyota Hilux 2019",
    description: "d",
    url: "https://x.test/en/listing/a",
    origin: "https://x.test",
  }

  it("a vehicle is a Vehicle with an Offer in SDG", () => {
    const l = listingSchema.parse(live((x) => x.kind === "vehicle"))
    const json = listingJsonLd(l, meta, { make: "Toyota", model: "Hilux" })
    expect(json["@type"]).toBe("Vehicle")
    expect(json).toMatchObject({
      brand: { name: "Toyota" },
      model: "Hilux",
      offers: { priceCurrency: "SDG", price: l.price },
    })
  })

  it("a part is a Product, and a sold listing is SoldOut", () => {
    const l = listingSchema.parse(live((x) => x.kind === "part"))
    const json = listingJsonLd({ ...l, status: "sold" }, meta, {})
    expect(json["@type"]).toBe("Product")
    expect(json.offers.availability).toBe("https://schema.org/SoldOut")
  })

  it("relative image urls become absolute", () => {
    const l = listingSchema.parse(live((x) => x.media.length > 0))
    const json = listingJsonLd(l, meta, {})
    for (const src of json.image ?? [])
      expect(src.startsWith("https://x.test/") || src.startsWith("http")).toBe(
        true
      )
  })

  it("a dealership links to its profile, a private seller to a search on the owner id", () => {
    const dealer = listingSchema.parse(
      db.listings.find((l) => l.owner.type === "dealership")
    )
    expect(sellerHref(dealer)).toBe(`/dealerships/${dealer.owner.profileSlug}`)
    const person = listingSchema.parse(
      db.listings.find((l) => l.owner.type === "user" && l.kind === "vehicle")
    )
    expect(sellerHref(person)).toBe(`/search?seller=${person.owner.id}`)
  })

  it("similar listings link to the preset for the same type and intent", () => {
    const l = listingSchema.parse(
      db.listings.find(
        (x) =>
          x.kind === "vehicle" && x.vehicleType === "car" && x.intent === "sale"
      )
    )
    expect(similarHref(l)).toBe("/vehicles/cars/sale")
  })
})

describe("Description", () => {
  const sizes = (scroll: number, client: number) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
      scroll
    )
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
      client
    )
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
  }
  afterEach(() => vi.restoreAllMocks())

  it("collapses long text behind Read more and expands it", async () => {
    sizes(300, 150)
    await renderShell(<Description text={"line\n".repeat(20)} />)
    const more = await screen.findByRole("button", { name: "Read more" })
    expect(more.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(more)
    const less = screen.getByRole("button", { name: "Show less" })
    expect(less.getAttribute("aria-expanded")).toBe("true")
  })

  it("shows no button when the text fits in six lines", async () => {
    sizes(100, 100)
    await renderShell(<Description text="Short text." />)
    expect(screen.queryByRole("button")).toBeNull()
  })
})
