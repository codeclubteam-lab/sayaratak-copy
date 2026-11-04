import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { wizardSteps } from "@/features/listings/wizard/wizard-steps"
import { toast } from "@/components/ui/toast"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

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
      onPublish={() => Promise.resolve()}
    />
  )
}
const open = (draft?: object) => {
  if (draft)
    sessionStorage.setItem(
      "sy:draft:listing:new",
      JSON.stringify({
        savedAt: new Date().toISOString(),
        values: { ...wizardDefaults, ...draft },
      })
    )
  return renderShell(<Harness />, { path: "/en/post?step=type" })
}
const tile = (name: string) =>
  screen.findByRole<HTMLInputElement>("radio", { name })
const checked = (name: string) =>
  screen.getByRole<HTMLInputElement>("radio", { name }).checked
const step = (shell: Awaited<ReturnType<typeof open>>) =>
  new URLSearchParams(shell.router.state.location.searchStr).get("step")
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }))
const touched = {
  vehicleType: "car",
  title: "Toyota Corolla 2018",
  year: 2018,
  fuel: "petrol",
}

beforeEach(() => {
  resetDb()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
})

describe("TypeStep", () => {
  it("shows six tiles and a vehicle tile reveals For sale | For rent, sale first", async () => {
    await open()
    await tile("Car")
    expect(
      ["Car", "Truck", "Motorcycle", "Tuk-tuk", "Rickshaw", "Spare part"].map(
        (n) => screen.getByRole("radio", { name: n })
      )
    ).toHaveLength(6)
    expect(screen.queryByRole("radio", { name: "For sale" })).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Car" }))
    expect(checked("Car")).toBe(true)
    expect(checked("For sale")).toBe(true)
    fireEvent.click(screen.getByRole("radio", { name: "For rent" }))
    expect(checked("For rent")).toBe(true)
    expect(screen.queryByText("Fits")).toBeNull()
  })

  it("the Spare part tile shows the category and Fits chips and hides the intent", async () => {
    await open()
    fireEvent.click(await tile("Car"))
    fireEvent.click(screen.getByRole("radio", { name: "For rent" }))
    fireEvent.click(screen.getByRole("radio", { name: "Spare part" }))
    expect(screen.getByText("Fits")).toBeTruthy()
    expect(screen.getByText("Part category")).toBeTruthy()
    expect(screen.queryByRole("radio", { name: "For rent" })).toBeNull()
    // A part is always for sale: going back to a vehicle starts on sale.
    fireEvent.click(screen.getByRole("radio", { name: "Truck" }))
    expect(checked("For sale")).toBe(true)
  })

  it("Next with nothing chosen shows the error and stays", async () => {
    const shell = await open()
    await tile("Car")
    next()
    expect(await screen.findByText("This field is required")).toBeTruthy()
    expect(step(shell)).toBe("type")
    fireEvent.click(screen.getByRole("radio", { name: "Truck" }))
    await waitFor(() =>
      expect(screen.queryByText("This field is required")).toBeNull()
    )
    next()
    await waitFor(() => expect(step(shell)).toBe("details"))
  })

  it("a part cannot continue without a category and a compatible type", async () => {
    const shell = await open()
    fireEvent.click(await tile("Spare part"))
    next()
    expect(await screen.findByText("Choose at least one option")).toBeTruthy()
    expect(screen.getByText("This field is required")).toBeTruthy()
    expect(step(shell)).toBe("type")
    const category = db.taxonomy.partCategories[0]!.name.en
    fireEvent.click(screen.getByRole("radio", { name: category }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Cars" }))
    next()
    await waitFor(() => expect(step(shell)).toBe("details"))
  })

  it("changing the type never asks, and says nothing before the details were touched", async () => {
    const add = vi.spyOn(toast, "add")
    await open({ vehicleType: "car" })
    fireEvent.click(await tile("Truck"))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(checked("Truck")).toBe(true)
    expect(add).not.toHaveBeenCalled()
  })

  it("applies at once when details were touched, keeps the title, and Undo brings the cleared fields back", async () => {
    const add = vi.spyOn(toast, "add")
    const shell = await open(touched)
    fireEvent.click(await tile("Spare part"))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    await waitFor(() => expect(checked("Spare part")).toBe(true))
    const options = add.mock.calls[0]![0]
    expect(options.title).toBe(
      "Type changed. Fields that do not apply were cleared."
    )
    expect(options.actionProps!.children).toBe("Undo")
    // The draft, flushed when the page goes, holds the new type and the kept title.
    shell.unmount()
    const stored = () =>
      JSON.parse(sessionStorage.getItem("sy:draft:listing:new")!).values
    expect(stored()).toMatchObject({
      kind: "part",
      vehicleType: null,
      title: "Toyota Corolla 2018",
      year: null,
      fuel: null,
    })
  })

  it("Undo puts the type and the cleared details back", async () => {
    const add = vi.spyOn(toast, "add")
    const shell = await open(touched)
    fireEvent.click(await tile("Spare part"))
    await waitFor(() => expect(checked("Spare part")).toBe(true))
    add.mock.calls[0]![0].actionProps!.onClick!({} as never)
    await waitFor(() => expect(checked("Car")).toBe(true))
    shell.unmount()
    const stored = JSON.parse(sessionStorage.getItem("sy:draft:listing:new")!)
    expect(stored.values).toMatchObject({
      kind: "vehicle",
      vehicleType: "car",
      title: "Toyota Corolla 2018",
      year: 2018,
      fuel: "petrol",
    })
  })

  it("hides a vehicle type the admin turned off", async () => {
    db.taxonomy.vehicleTypes.find((v) => v.id === "rickshaw")!.enabled = false
    await open()
    await tile("Car")
    await waitFor(() =>
      expect(screen.queryByRole("radio", { name: "Rickshaw" })).toBeNull()
    )
    expect(screen.getByRole("radio", { name: "Spare part" })).toBeTruthy()
  })
})
