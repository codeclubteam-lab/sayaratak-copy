import { Suspense } from "react"
import {
  defaultParseSearch,
  defaultStringifySearch,
} from "@tanstack/react-router"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { FilterForm } from "@/components/app/filter-form"
import { ListingDetailPage } from "@/features/listings/components/listing-detail-page"
import { listingJsonLd } from "@/features/listings/json-ld"
import { applyDraft, toDraft } from "@/features/search/filters"
import {
  flagKeys,
  fullSearch,
  routeSearchSchema,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"
import { useActiveFilters } from "@/features/search/use-active-filters"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { extraDefaults } from "@sayaratak/shared/schemas/listing-fields"
import { db, resetDb } from "@/mocks/db"
import { matches } from "@/mocks/search"
import type { ListingRow } from "@/mocks/types"
import { NowProvider } from "@/lib/now"
import { renderShell } from "./shell-render"

vi.mock("@/components/app/map-canvas-impl", () => ({
  MapCanvasImpl: () => null,
}))

beforeEach(() => resetDb())

const found = (p: Partial<SearchParams>) => {
  const params = fullSearch(p)
  return db.listings.filter((l) => matches(l, params))
}
const all = found({})

describe("seeded values for the new fields", () => {
  it("every kind of value exists, so each filter has something to find", () => {
    expect(found({ body: ["sedan"] }).length).toBeGreaterThan(0)
    expect(found({ drive: ["awd"] }).length).toBeGreaterThan(0)
    expect(found({ madeIn: ["japan"] }).length).toBeGreaterThan(0)
    expect(
      found({ intent: "rent", driver: ["included"] }).length
    ).toBeGreaterThan(0)
    expect(
      found({ kind: "part", partType: ["genuine"] }).length
    ).toBeGreaterThan(0)
    expect(found({ kind: "part", fitsYear: 2012 }).length).toBeGreaterThan(0)
    expect(found({ features: ["abs", "bluetooth"] }).length).toBeGreaterThan(0)
    for (const k of flagKeys) {
      const kind = k === "installation" ? "part" : "vehicle"
      const intent = k === "insuranceIncluded" ? "rent" : undefined
      expect(
        found({ [k]: true, kind, intent }).length,
        `flag ${k}`
      ).toBeGreaterThan(0)
    }
  })
})

describe("mock search on the new filters", () => {
  it("a list keeps listings with any chosen value", () => {
    const both = found({ body: ["sedan", "suv"] })
    expect(both.length).toBeGreaterThan(found({ body: ["sedan"] }).length)
    for (const l of both) expect(["sedan", "suv"]).toContain(l.bodyType)
    expect(both.length).toBeLessThan(all.length)
  })

  it("features need every chosen one", () => {
    const one = found({ features: ["abs"] })
    const two = found({ features: ["abs", "sunroof"] })
    expect(two.length).toBeLessThanOrEqual(one.length)
    for (const l of two)
      expect(l.features).toEqual(expect.arrayContaining(["abs", "sunroof"]))
  })

  it("seats, first owner, warranty and customs read the listing's own field", () => {
    for (const l of found({ seatsMin: 7 }))
      expect(l.seats).toBeGreaterThanOrEqual(7)
    for (const l of found({ firstOwner: true }))
      expect(l.previousOwners).toBe(0)
    for (const l of found({ warranty: true }))
      expect(["dealer", "manufacturer"]).toContain(l.warranty)
    for (const l of found({ customs: true }))
      expect(l.customsCleared).toBe(true)
  })

  it("fits a year: inside the range of a part", () => {
    for (const l of found({ kind: "part", fitsYear: 2012 })) {
      expect(l.fitsYearFrom ?? 0).toBeLessThanOrEqual(2012)
      expect(l.fitsYearTo ?? 9999).toBeGreaterThanOrEqual(2012)
    }
  })
})

describe("URL and draft", () => {
  const p = {
    body: ["sedan"],
    drive: ["fwd", "awd"],
    madeIn: ["japan"],
    features: ["abs", "sunroof"],
    seatsMin: 5,
    customs: true,
    accidentFree: true,
  }
  it("round-trips through the address bar", () => {
    const text = defaultStringifySearch(p)
    const back = routeSearchSchema.parse(defaultParseSearch(text))
    expect(back).toMatchObject(p)
  })
  it("a bad value is dropped, not an error", () => {
    const s = routeSearchSchema.parse({
      seatsMin: "many",
      customs: "yes",
      body: 3,
    })
    expect(s.seatsMin).toBeUndefined()
    expect(s.customs).toBeUndefined()
    expect(s.body).toBeUndefined()
  })
  it("the filter draft writes back what it read", () => {
    const params = fullSearch(p)
    const back = applyDraft(params, toDraft(params), undefined)
    expect(back).toMatchObject(p)
    expect(back.warranty).toBeUndefined()
  })
  it("clearing a flag in the draft removes it from the params", () => {
    const params = fullSearch(p)
    const draft = { ...toDraft(params), flags: [] }
    const back = applyDraft(params, draft, undefined)
    expect(back.customs).toBeUndefined()
    expect(back.accidentFree).toBeUndefined()
  })
})

function Chips({ params }: { params: SearchParams }) {
  const chips = useActiveFilters(params)
  return (
    <ul>
      {chips.map((c) => (
        <li key={c.id}>{c.label}</li>
      ))}
    </ul>
  )
}

describe("active chips", () => {
  it("one chip per value, flag and number", async () => {
    await renderShell(
      <Chips
        params={fullSearch({
          body: ["sedan", "suv"],
          features: ["abs"],
          seatsMin: 5,
          customs: true,
          madeIn: ["other"],
        })}
      />
    )
    for (const text of [
      "Sedan",
      "SUV",
      "ABS brakes",
      "5+ seats",
      "Customs paid",
      "Other",
    ])
      expect(await screen.findByText(text)).toBeTruthy()
  })
})

describe("FilterForm, more filters", () => {
  const open = async (params: Partial<SearchParams>) => {
    const onApply = vi.fn()
    await renderShell(
      <FilterForm
        params={fullSearch(params)}
        variant="sheet"
        onApply={onApply}
      />
    )
    return onApply
  }
  it("is closed until a value is set, and says how many are", async () => {
    await open({})
    expect(
      (
        screen
          .getByText("More filters")
          .closest("details") as HTMLDetailsElement
      ).open
    ).toBe(false)
  })
  it("opens on its own when the URL has one, with the count", async () => {
    await open({ customs: true, body: ["sedan"] })
    const section = screen.getByText("More filters").closest("details")!
    expect(section.open).toBe(true)
    expect(within(section).getByText("2")).toBeTruthy()
  })
  it("blocks: category, price and make start open, the rest closed, and one with a value opens with its count", async () => {
    await open({})
    const block = (title: string) =>
      screen.getByText(title, { selector: "summary span" }).closest("details")!
    for (const title of ["Category", "Price", "Make and model"])
      expect(block(title).open).toBe(true)
    for (const title of ["Year and mileage", "Fuel and transmission"])
      expect(block(title).open).toBe(false)
    cleanup()
    await open({ fuel: ["petrol", "diesel"], minYear: 2015 })
    const fuel = block("Fuel and transmission")
    expect(fuel.open).toBe(true)
    expect(within(fuel).getByText("2")).toBeTruthy()
    expect(within(block("Year and mileage")).getByText("1")).toBeTruthy()
  })
  it("chips and flags are written to the params on submit", async () => {
    const onApply = await open({})
    fireEvent.click(screen.getByRole("checkbox", { name: "Sedan" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Customs paid" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Sunroof" }))
    fireEvent.click(screen.getByRole("button", { name: /^Show|Apply/ }))
    await waitFor(() => expect(onApply).toHaveBeenCalled())
    expect(onApply.mock.calls[0]![0]).toMatchObject({
      body: ["sedan"],
      customs: true,
      features: ["sunroof"],
    })
  })
  it("rent hides the sale-only flags; a part shows its own", async () => {
    await open({ intent: "rent" })
    expect(
      screen.queryByRole("checkbox", { name: "Open to exchange" })
    ).toBeNull()
    expect(
      screen.getByRole("checkbox", { name: "Insurance included" })
    ).toBeTruthy()
  })
  it("a part search has part type and fits-year, no vehicle features", async () => {
    await open({ kind: "part" })
    expect(screen.getByRole("checkbox", { name: "Genuine" })).toBeTruthy()
    expect(screen.getByLabelText("Fits year")).toBeTruthy()
    expect(screen.queryByRole("checkbox", { name: "Sunroof" })).toBeNull()
    expect(
      screen.getByRole("checkbox", { name: "Installation available" })
    ).toBeTruthy()
  })
})

const page = (slug: string) => (
  <NowProvider serverNow={Date.UTC(2026, 9, 5, 6, 0)}>
    <Suspense fallback={null}>
      <ListingDetailPage slug={slug} />
    </Suspense>
  </NowProvider>
)
const car = () =>
  db.listings.find(
    (l) =>
      l.moderation === "approved" &&
      l.kind === "vehicle" &&
      l.vehicleType === "car" &&
      l.intent === "sale" &&
      !!l.makeId
  ) as ListingRow

describe("listing detail, new fields", () => {
  it("shows set fields in groups and features as chips", async () => {
    const row = car()
    Object.assign(row, {
      ...extraDefaults,
      bodyType: "sedan",
      doors: 4,
      seats: 5,
      driveType: "awd",
      accidentFree: true,
      previousOwners: 0,
      warranty: "dealer",
      warrantyMonths: 12,
      customsCleared: true,
      licenseValidUntil: "2027-03-15",
      features: ["abs", "sunroof", "bluetooth"],
    })
    await renderShell(page(row.slug))
    expect(await screen.findByText("Body type")).toBeTruthy()
    expect(screen.getByText("Sedan")).toBeTruthy()
    expect(screen.getByText("Doors")).toBeTruthy()
    expect(screen.getByText("All-wheel drive (AWD)")).toBeTruthy()
    expect(screen.getByText("First owner")).toBeTruthy()
    expect(screen.getByText("Dealer warranty, 12 months")).toBeTruthy()
    expect(screen.getByText("Free of accidents")).toBeTruthy()
    for (const g of [
      "Condition and history",
      "Papers and registration",
      "Size and capacity",
    ])
      expect(screen.getByRole("heading", { name: g })).toBeTruthy()
    expect(
      screen.getByRole("heading", { name: "Features and equipment" })
    ).toBeTruthy()
    for (const f of ["ABS brakes", "Sunroof", "Bluetooth"])
      expect(screen.getByText(f).tagName).toBe("LI")
  })

  it("leaves out empty fields and the groups that have none", async () => {
    const row = car()
    Object.assign(row, { ...extraDefaults })
    await renderShell(page(row.slug))
    await screen.findByRole("heading", { name: "Specifications" })
    for (const g of [
      "Deal terms",
      "Papers and registration",
      "Features and equipment",
    ])
      expect(screen.queryByRole("heading", { name: g })).toBeNull()
    expect(screen.queryByText("Doors")).toBeNull()
  })

  it("a rent listing shows the minimum period in the right unit", async () => {
    const row = db.listings.find(
      (l) =>
        l.moderation === "approved" &&
        l.intent === "rent" &&
        l.kind === "vehicle"
    ) as ListingRow
    Object.assign(row, {
      rentPeriod: "week",
      minRent: 2,
      deposit: 200000,
      driver: "included",
    })
    await renderShell(page(row.slug))
    expect(await screen.findByText("2 weeks")).toBeTruthy()
    expect(screen.getByText("With a driver")).toBeTruthy()
  })
})

describe("structured data for the new fields", () => {
  const meta = {
    title: "t",
    description: "d",
    url: "https://x.test/en/listing/a",
    origin: "https://x.test",
  }
  it("a vehicle carries body type, doors, seats, drive and engine", () => {
    const l = listingSchema.parse({
      ...car(),
      bodyType: "suv",
      doors: 5,
      seats: 7,
      driveType: "four_wd",
      engineCc: 2700,
    })
    expect(listingJsonLd(l, meta, {})).toMatchObject({
      bodyType: "suv",
      numberOfDoors: 5,
      vehicleSeatingCapacity: 7,
      driveWheelConfiguration: "https://schema.org/FourWheelDriveConfiguration",
      vehicleEngine: { engineDisplacement: { value: 2700, unitCode: "CMQ" } },
    })
  })
})
