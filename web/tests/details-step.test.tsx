import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { detailsSchema } from "@sayaratak/shared/listings/schemas"
import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { wizardSteps } from "@/features/listings/wizard/wizard-steps"
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
const car = { kind: "vehicle", vehicleType: "car" }
const open = async (draft: object) => {
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
const field = (name: RegExp | string) => screen.queryByLabelText(name)
const select = (name: RegExp) => screen.getByRole("combobox", { name })
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
const step = (shell: Awaited<ReturnType<typeof open>>) =>
  new URLSearchParams(shell.router.state.location.searchStr).get("step")
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } })
const valid = {
  ...car,
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

beforeEach(() => {
  resetDb()
  publish.mockClear()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
})

describe("detailsSchema", () => {
  const ctx = { kind: "vehicle", vehicleType: "car", intent: "sale" } as const
  const keys = (v: object, c: Parameters<typeof detailsSchema>[0] = ctx) => {
    const r = detailsSchema(c).safeParse({ ...wizardDefaults, ...v })
    return r.success ? [] : r.error.issues.map((i) => String(i.path[0]))
  }

  it("a complete car passes", () => {
    expect(keys(valid)).toEqual([])
  })
  it("an empty car lists every required field", () => {
    expect(keys({})).toEqual(
      expect.arrayContaining([
        "title",
        "description",
        "price",
        "makeId",
        "modelId",
        "year",
        "fuel",
        "transmission",
        "mileageKm",
      ])
    )
  })
  it("a typed make and model replace the ids, a new vehicle needs no mileage", () => {
    expect(
      keys({
        ...valid,
        makeId: null,
        modelId: null,
        makeOther: "Hino",
        modelOther: "300",
        condition: "new",
        mileageKm: null,
      })
    ).toEqual([])
  })
  it("a motorcycle needs no transmission, a rent listing needs a period", () => {
    const moto = { ...ctx, vehicleType: "motorcycle" } as const
    expect(keys({ ...valid, transmission: null }, moto)).toEqual([])
    expect(keys(valid, { ...ctx, intent: "rent" })).toEqual(["rentPeriod"])
  })
  it("a part needs only title, description and price", () => {
    const part = { kind: "part", vehicleType: null, intent: "sale" } as const
    expect(keys({}, part).sort()).toEqual(["description", "price", "title"])
  })
})

describe("DetailsStep", () => {
  it.each([
    ["car", ["Transmission", "Engine size", "Doors"], ["Payload", "Axles"]],
    [
      "truck",
      ["Transmission", "Payload", "Engine size", "Axles"],
      ["Doors", "Strokes"],
    ],
    [
      "motorcycle",
      ["Engine size", "Cylinders", "Engine strokes"],
      ["Transmission", "Payload", "Doors"],
    ],
    [
      "rickshaw",
      ["Engine size", "Seats"],
      ["Transmission", "Payload", "Cylinders", "Doors"],
    ],
  ])("%s shows its fields only", async (vehicleType, shown, hidden) => {
    await open({ ...car, vehicleType })
    for (const name of shown) expect(field(new RegExp(`^${name}`))).toBeTruthy()
    for (const name of hidden) expect(field(new RegExp(`^${name}`))).toBeNull()
    expect(field(/^Year/)).toBeTruthy()
    expect(field("Part number")).toBeNull()
  })

  it("a part shows condition, make, model and part number but no vehicle fields", async () => {
    await open({
      kind: "part",
      partCategoryId: db.taxonomy.partCategories[0]!.id,
      compatibleTypes: ["car"],
    })
    expect(field(/^Part number/)).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Used" })).toBeTruthy()
    for (const name of [/^Year/, /^Fuel/, /^Mileage/, /^Color/])
      expect(field(name)).toBeNull()
  })

  it("New hides the mileage and empties it", async () => {
    await open({ ...valid })
    expect((field(/^Mileage/) as HTMLInputElement).value).toBe("90,000")
    fireEvent.click(screen.getByRole("radio", { name: "New" }))
    expect(field(/^Mileage/)).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Used" }))
    expect((field(/^Mileage/) as HTMLInputElement).value).toBe("")
  })

  it("Next on an empty step shows translated errors, focuses the first and stays", async () => {
    const shell = await open(car)
    submit()
    expect(await screen.findByText("Write a longer title")).toBeTruthy()
    expect(screen.getByText("Write a longer description")).toBeTruthy()
    expect(
      screen.getAllByText("This field is required").length
    ).toBeGreaterThan(3)
    expect(document.activeElement).toBe(select(/^Make/))
    expect(step(shell)).toBe("details")
  })

  it("a rent listing asks for the period and shows it in the three words", async () => {
    const shell = await open({ ...valid, intent: "rent" })
    submit()
    expect(await screen.findByText("This field is required")).toBeTruthy()
    await pick(select(/^Price per day/), "per week")
    submit()
    await waitFor(() => expect(step(shell)).toBe("photos"))
  })

  it("a complete step passes", async () => {
    const shell = await open(valid)
    submit()
    await waitFor(() => expect(step(shell)).toBe("photos"))
  })

  it("the title follows make, model and year until it is edited", async () => {
    const make = db.taxonomy.makes.find((m) => m.vehicleTypes.includes("car"))!
    const model = db.taxonomy.models.find((m) => m.makeId === make.id)!
    await open(car)
    await pick(select(/^Make/), make.name.en)
    await pick(select(/^Model/), model.name.en)
    await pick(select(/^Year/), "2018")
    const title = screen.getByLabelText<HTMLInputElement>(/^Title/)
    await waitFor(() =>
      expect(title.value).toBe(`${make.name.en} ${model.name.en} 2018`)
    )
    type(title, "My own title for this car")
    await pick(select(/^Year/), "2019")
    await waitFor(() => expect(select(/^Year/).textContent).toContain("2019"))
    expect(title.value).toBe("My own title for this car")
  })
})
