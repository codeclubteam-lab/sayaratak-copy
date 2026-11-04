import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { detailsSchema } from "@sayaratak/shared/listings/schemas"
import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import { applies, inapplicable } from "@/features/listings/wizard/field-rules"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { wizardSteps } from "@/features/listings/wizard/wizard-steps"
import {
  extraDefaults,
  extraFields,
} from "@sayaratak/shared/schemas/listing-fields"
import { z } from "zod"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

const publish = vi.fn(() => Promise.resolve())
function Harness() {
  const stepId = useRouterState({
    select: (s) =>
      new URLSearchParams(s.location.searchStr).get("step") ?? "type",
  })
  return (
    <ListingWizard
      context="public"
      stepId={stepId}
      steps={wizardSteps}
      defaultValues={wizardDefaults}
      onPublish={publish}
    />
  )
}
const valid = {
  kind: "vehicle",
  vehicleType: "car",
  makeId: "x",
  modelId: "y",
  year: 2018,
  fuel: "petrol",
  transmission: "automatic",
  mileageKm: 90000,
  title: "Toyota Corolla 2018",
  description: "Clean car, one owner, full service history.",
  price: 12_000_000,
}
const open = async (draft: object = valid) => {
  sessionStorage.setItem(
    "sy:draft:listing:new",
    JSON.stringify({
      savedAt: new Date().toISOString(),
      values: { ...wizardDefaults, ...draft },
    })
  )
  const shell = await renderShell(<Harness />, {
    path: "/en/post?step=details",
  })
  await screen.findByLabelText(/^Title/)
  return shell
}
const step = (shell: Awaited<ReturnType<typeof open>>) =>
  new URLSearchParams(shell.router.state.location.searchStr).get("step")
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }))
const section = (title: RegExp | string) =>
  screen.getByText(title).closest("details") as HTMLDetailsElement
const titles = () =>
  [...document.querySelectorAll("details > summary > span:first-of-type")].map(
    (e) => e.textContent
  )
const label = (name: RegExp | string) => screen.queryByLabelText(name)

beforeEach(() => {
  resetDb()
  publish.mockClear()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
})

describe("field rules", () => {
  const car = { kind: "vehicle", vehicleType: "car", intent: "sale" }
  it("used-only fields need a used vehicle", () => {
    expect(applies("previousOwners", { ...car, condition: "used" })).toBe(true)
    expect(applies("previousOwners", { ...car, condition: "new" })).toBe(false)
  })
  it("plate details need a registered vehicle, warranty months a warranty", () => {
    expect(applies("plateType", car)).toBe(false)
    expect(applies("plateType", { ...car, registered: true })).toBe(true)
    expect(applies("warrantyMonths", { ...car, warranty: "none" })).toBe(false)
    expect(applies("warrantyMonths", { ...car, warranty: "dealer" })).toBe(true)
  })
  it("rent terms need a rent listing; delivery is also a part's", () => {
    expect(applies("deposit", car)).toBe(false)
    expect(applies("deposit", { ...car, intent: "rent" })).toBe(true)
    expect(applies("exchange", { ...car, intent: "rent" })).toBe(false)
    expect(applies("delivery", car)).toBe(false)
    expect(applies("delivery", { kind: "part", intent: "sale" })).toBe(true)
  })
  it("a type shows only its own specs", () => {
    const truck = { ...car, vehicleType: "truck" }
    expect(applies("doors", car)).toBe(true)
    expect(applies("doors", truck)).toBe(false)
    expect(applies("axles", truck)).toBe(true)
    expect(applies("strokes", { ...car, vehicleType: "motorcycle" })).toBe(true)
    expect(applies("partBrand", car)).toBe(false)
    expect(applies("partBrand", { kind: "part", intent: "sale" })).toBe(true)
  })
  it("lists what a change leaves behind, with the empty value", () => {
    const left = inapplicable({
      ...wizardDefaults,
      ...car,
      condition: "new",
      previousOwners: 2,
      registered: false,
      plateType: "taxi",
      doors: 4,
    })
    expect(left).toEqual({ previousOwners: null, plateType: null })
  })
})

describe("listing fields schema", () => {
  const shape = z.object(extraFields)
  const bad = (v: object) => {
    const r = shape.safeParse({ ...extraDefaults, ...v })
    return r.success ? [] : r.error.issues.map((i) => i.message)
  }
  it("an untouched form is valid", () => {
    expect(bad({})).toEqual([])
  })
  it("numbers keep to their range", () => {
    expect(bad({ doors: 1 })).toHaveLength(1)
    expect(bad({ doors: 4 })).toEqual([])
    expect(bad({ horsepower: 5000 })).toEqual(["validation.too_large"])
    expect(bad({ minDriverAge: 17 })).toHaveLength(1)
  })
  it("the chassis number and the license date have a shape", () => {
    expect(bad({ chassisNumber: "ab" })).toEqual(["validation.chassis"])
    expect(bad({ chassisNumber: "JTDKB20U-123" })).toEqual([])
    expect(bad({ licenseValidUntil: "soon" })).toEqual(["validation.date"])
    expect(bad({ licenseValidUntil: "2027-03-15" })).toEqual([])
  })
  it("a feature must be a known one", () => {
    expect(bad({ features: ["abs", "sunroof"] })).toEqual([])
    expect(bad({ features: ["flying"] })).toHaveLength(1)
  })
  it("a part's years must be in order", () => {
    const ctx = { kind: "part", vehicleType: null, intent: "sale" } as const
    const r = detailsSchema(ctx).safeParse({
      ...wizardDefaults,
      title: "Brake pads for Toyota",
      description: "New brake pads, never fitted.",
      price: 50000,
      fitsYearFrom: 2020,
      fitsYearTo: 2010,
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => i.message)).toContain(
      "validation.year_order"
    )
  })
})

describe("required marks", () => {
  it("the wizard marks required fields with an asterisk and writes no (Optional)", async () => {
    await open()
    const year = screen.getByRole("combobox", { name: /^Year/ })
    expect(year.getAttribute("aria-required")).toBe("true")
    expect(document.querySelector(`label[for="${year.id}"]`)?.textContent).toBe(
      "Year *"
    )
    const trim = screen.getByLabelText("Trim or version")
    expect(trim.getAttribute("aria-required")).toBeNull()
    expect(screen.queryByText("(Optional)")).toBeNull()
    expect(screen.getByText("* Required")).toBeTruthy()
  })
})

describe("DetailsStep sections", () => {
  it("a car for sale has its sections, with the optional ones closed", async () => {
    await open()
    expect(titles()).toEqual([
      "Basics",
      "Engine and performance",
      "Size and capacity",
      "Condition and history",
      "Papers and registration",
      "Deal terms",
      "Features and equipment",
      "Title, description and price",
    ])
    expect(section("Basics").open).toBe(true)
    expect(section("Condition and history").open).toBe(false)
    expect(section("Features and equipment").open).toBe(false)
  })

  it("rent adds the rental terms and drops the sale-only deal fields", async () => {
    await open({ ...valid, intent: "rent" })
    expect(titles()).toContain("Rental terms")
    expect(section("Rental terms").open).toBe(true)
    expect(label(/^Deposit/)).toBeTruthy()
    expect(screen.queryByRole("group", { name: "Open to exchange" })).toBeNull()
    expect(
      screen.getByRole("group", { name: "Test drive allowed" })
    ).toBeTruthy()
  })

  it("features follow the type: a truck adds work gear, a motorcycle has only its own", async () => {
    await open({ ...valid, vehicleType: "truck" })
    expect(screen.getByRole("checkbox", { name: "Winch" })).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "Sunroof" })).toBeTruthy()
  })
  it("a motorcycle gets the bike group and no car comfort", async () => {
    await open({ ...valid, vehicleType: "motorcycle" })
    expect(screen.getByRole("checkbox", { name: "Disc brakes" })).toBeTruthy()
    expect(screen.queryByRole("checkbox", { name: "Sunroof" })).toBeNull()
  })

  it("a part has its own sections and no vehicle ones", async () => {
    await open({
      kind: "part",
      vehicleType: null,
      partCategoryId: db.taxonomy.partCategories[0]!.id,
      compatibleTypes: ["car"],
    })
    expect(titles()).toEqual([
      "Basics",
      "What it fits",
      "Part details",
      "Service",
      "Title, description and price",
    ])
    expect(label(/^Brand/)).toBeTruthy()
    expect(label(/^Quantity/)).toBeTruthy()
    expect(label(/^Doors/)).toBeNull()
  })

  it("a closed section says how many of its fields are filled", async () => {
    await open({ ...valid, previousOwners: 2, accidentFree: true })
    expect(
      within(section("Condition and history")).getByText(/^2 of \d+ filled$/)
    ).toBeTruthy()
    expect(within(section("Deal terms")).getByText("Optional")).toBeTruthy()
  })

  it("Expand all opens every section, and Collapse all closes them", async () => {
    await open()
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }))
    expect([...document.querySelectorAll("details")].every((d) => d.open)).toBe(
      true
    )
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }))
    expect([...document.querySelectorAll("details")].some((d) => d.open)).toBe(
      false
    )
  })
})

describe("DetailsStep fields", () => {
  it("body type offers the types of a car", async () => {
    await open()
    await pick(
      screen.getByRole("combobox", { name: /^Body type/ }),
      "Hatchback"
    )
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /^Body type/ }).textContent
      ).toContain("Hatchback")
    )
  })

  it("yes, no, and Clear on a yes/no field", async () => {
    await open({ ...valid, condition: "used" })
    const group = screen.getByRole("group", { name: "Free of accidents" })
    fireEvent.click(within(group).getByRole("radio", { name: "Yes" }))
    fireEvent.click(await within(group).findByRole("button", { name: "Clear" }))
    await waitFor(() =>
      expect(within(group).queryByRole("button", { name: "Clear" })).toBeNull()
    )
    expect(
      within(group).getByRole<HTMLInputElement>("radio", { name: "Yes" })
        .checked
    ).toBe(false)
  })

  it("not registered empties and hides the plate fields", async () => {
    await open({
      ...valid,
      registered: true,
      plateType: "taxi",
    })
    expect(label(/^Plate type/)).toBeTruthy()
    const group = screen.getByRole("group", { name: "Registered" })
    fireEvent.click(within(group).getByRole("radio", { name: "No" }))
    await waitFor(() => expect(label(/^Plate type/)).toBeNull())
    fireEvent.click(within(group).getByRole("radio", { name: "Yes" }))
    expect(
      screen.getByRole("combobox", { name: /^Plate type/ }).textContent
    ).not.toContain("Taxi")
  })

  it("a warranty of None hides its length", async () => {
    await open({ ...valid, warranty: "dealer", warrantyMonths: 12 })
    expect(label(/^Warranty length/)).toBeTruthy()
    await pick(screen.getByRole("combobox", { name: /^Warranty$/ }), "None")
    await waitFor(() => expect(label(/^Warranty length/)).toBeNull())
  })

  it("a feature chip adds to the list and the count follows", async () => {
    await open()
    fireEvent.click(screen.getByRole("checkbox", { name: "Sunroof" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Bluetooth" }))
    await waitFor(() =>
      expect(
        within(section("Features and equipment")).getByText(/^2 of \d+ filled$/)
      ).toBeTruthy()
    )
  })

  it("an error in a closed section opens it and focuses the field", async () => {
    const shell = await open({ ...valid, previousOwners: 99 })
    expect(section("Condition and history").open).toBe(false)
    next()
    await waitFor(() =>
      expect(section("Condition and history").open).toBe(true)
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(label(/^Previous owners/))
    )
    expect(step(shell)).toBe("details")
  })

  it("a car with forty fields filled still passes", async () => {
    const shell = await open({
      ...valid,
      bodyType: "sedan",
      trim: "XLE",
      color: "white",
      colorInterior: "beige",
      origin: "japan",
      cylinders: 4,
      horsepower: 132,
      driveType: "fwd",
      doors: 4,
      seats: 5,
      previousOwners: 1,
      accidentFree: true,
      paint: "original",
      serviceHistory: "full",
      warranty: "dealer",
      warrantyMonths: 12,
      customsCleared: true,
      registered: true,
      plateType: "private",
      plateCityId: "khartoum",
      licenseValidUntil: "2027-03-15",
      insurance: "comprehensive",
      chassisNumber: "JTDKB20U123456",
      exchange: true,
      financing: false,
      testDrive: true,
      inspectionReport: true,
      features: ["abs", "sunroof", "bluetooth", "alloy_wheels"],
    })
    next()
    await waitFor(() => expect(step(shell)).toBe("photos"))
  })
})
