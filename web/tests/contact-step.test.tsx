import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { contactStepSchema } from "@sayaratak/shared/listings/schemas"
import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { wizardSteps } from "@/features/listings/wizard/wizard-steps"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"
import type { User } from "@sayaratak/shared/schemas/user"

vi.mock("@/components/app/map-canvas-impl", () => ({
  MapCanvasImpl: () => null,
}))

const publish = vi.fn((_values: Record<string, unknown>) => Promise.resolve())
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
const media = (id: string): Media => ({
  id,
  type: "image",
  url: `/mock/${id}-{w}.webp`,
  width: 1280,
  height: 853,
  placeholderColor: "#b8c4c0",
  posterUrl: null,
})
// A car whose first three steps are valid, so the contact step may open.
const before = {
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
  media: [..."abc"].map((id) => media(id)),
}
const contact = {
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  phone: "+249912345678",
}
const open = async (draft: object = contact, role?: User["role"]) => {
  sessionStorage.setItem(
    "sy:draft:listing:new",
    JSON.stringify({
      savedAt: new Date().toISOString(),
      values: { ...wizardDefaults, ...before, ...draft },
    })
  )
  const shell = await renderShell(<Harness />, {
    path: "/en/post?step=contact",
    role,
  })
  await screen.findByRole("heading", { name: "Location and contact" })
  return shell
}
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }))
// Contact is followed by the review, whose Publish sends everything.
const publishNow = async () => {
  next()
  await screen.findByRole("heading", { name: "Review and publish" })
  fireEvent.click(screen.getByRole("button", { name: "Publish" }))
}
const sent = async () => {
  await waitFor(() => expect(publish).toHaveBeenCalled())
  return publish.mock.calls[0]![0]
}
const box = (name: string) => screen.getByRole("checkbox", { name })
const phone = () => screen.getByLabelText<HTMLInputElement>(/^Phone number/)

beforeEach(() => {
  resetDb()
  publish.mockClear()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
})
afterEach(() => {
  document.cookie = "city=; Max-Age=0; Path=/"
})

describe("contactStepSchema", () => {
  const ok = {
    ...contact,
    location: null,
    whatsapp: contact.phone,
    showPhone: true,
    methods: ["call", "whatsapp", "chat"],
  }
  const issues = (v: object) => {
    const r = contactStepSchema.safeParse({ ...ok, ...v })
    return r.success ? [] : r.error.issues.map((i) => String(i.path[0]))
  }
  it("a complete step passes, with or without a pin", () => {
    expect(issues({})).toEqual([])
    expect(issues({ location: { lat: 15.5, lng: 32.5 } })).toEqual([])
  })
  it("an empty step lists city, district and phone", () => {
    expect(
      issues({ cityId: "", districtId: "", phone: "", whatsapp: null })
    ).toEqual(
      expect.arrayContaining(["cityId", "districtId", "phone", "whatsapp"])
    )
  })
  it("WhatsApp as a method needs a number; at least one method is needed", () => {
    expect(issues({ whatsapp: null })).toEqual(["whatsapp"])
    expect(issues({ whatsapp: null, methods: ["chat"] })).toEqual([])
    expect(issues({ methods: [] })).toEqual(["methods"])
  })
})

describe("ContactStep", () => {
  it("Next with an empty step shows the errors and stays", async () => {
    await open({})
    next()
    expect(await screen.findAllByText("This field is required")).toHaveLength(2)
    expect(publish).not.toHaveBeenCalled()
  })

  it("district options depend on the city", async () => {
    await open({})
    const district = () => screen.getByRole("combobox", { name: /District/ })
    expect(district().hasAttribute("disabled")).toBe(true)
    await pick(screen.getByRole("combobox", { name: /City/ }), "Khartoum")
    await waitFor(() => expect(district().hasAttribute("disabled")).toBe(false))
    fireEvent.pointerDown(district(), { button: 0, pointerType: "mouse" })
    fireEvent.mouseDown(district(), { button: 0 })
    expect(await screen.findByRole("option", { name: "Riyadh" })).toBeTruthy()
    expect(screen.queryByRole("option", { name: "Mahdia" })).toBeNull()
  })

  it("the pin is optional: the listing is sent with a null location", async () => {
    await open()
    await publishNow()
    expect((await sent()).location).toBeNull()
  })

  it("the WhatsApp number follows the phone until the box is cleared", async () => {
    await open()
    fireEvent.change(phone(), { target: { value: "912000111" } })
    fireEvent.blur(phone())
    await publishNow()
    const values = await sent()
    expect(values.phone).toBe("+249912000111")
    expect(values.whatsapp).toBe("+249912000111")
  })

  it("another WhatsApp number can be typed; leaving it empty is an error", async () => {
    await open()
    fireEvent.click(box("Use the same number on WhatsApp"))
    const whatsapp = await screen.findByLabelText(/^WhatsApp number/)
    fireEvent.change(whatsapp, { target: { value: "" } })
    next()
    expect(await screen.findAllByText("This field is required")).toHaveLength(1)
    fireEvent.change(whatsapp, { target: { value: "923000222" } })
    fireEvent.blur(whatsapp)
    await publishNow()
    expect((await sent()).whatsapp).toBe("+249923000222")
  })

  it("hiding the phone removes Call, disables it and says WhatsApp shows the number", async () => {
    await open()
    expect(box("Call").getAttribute("aria-checked")).toBe("true")
    fireEvent.click(
      screen.getByRole("switch", { name: "Show my phone number" })
    )
    await waitFor(() =>
      expect(box("Call").getAttribute("aria-checked")).toBe("false")
    )
    expect(box("Call").hasAttribute("data-disabled")).toBe(true)
    expect(
      screen.getByText("Buyers who use WhatsApp will see your number there")
    ).toBeTruthy()
    await publishNow()
    const values = await sent()
    expect(values.showPhone).toBe(false)
    expect(values.methods).toEqual(["whatsapp", "chat"])
  })

  it("hiding the phone when Call was the only method leaves Messages", async () => {
    await open({ ...contact, methods: ["call"] })
    fireEvent.click(
      screen.getByRole("switch", { name: "Show my phone number" })
    )
    await publishNow()
    expect((await sent()).methods).toEqual(["chat"])
  })

  it("unchecking every method is an error", async () => {
    await open({ ...contact, methods: ["chat"] })
    fireEvent.click(box("Message"))
    next()
    expect(await screen.findByText("Choose at least one option")).toBeTruthy()
    expect(publish).not.toHaveBeenCalled()
  })

  it("a signed-in person gets their city and phone", async () => {
    await open({}, "user")
    await waitFor(() => expect(phone().value).toBe("912345601"))
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /City/ }).textContent
      ).toContain("Khartoum")
    )
  })

  it("a signed-out visitor gets the city cookie", async () => {
    document.cookie = "city=omdurman; Path=/"
    await open({})
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /City/ }).textContent
      ).toContain("Omdurman")
    )
  })

  it("a dealer starts with the dealership details collapsed and can edit them", async () => {
    await open({}, "dealership")
    const same = () => box("Use dealership contact details")
    await waitFor(() =>
      expect(same().getAttribute("aria-checked")).toBe("true")
    )
    expect(screen.queryByLabelText(/^Phone number/)).toBeNull()
    const own = db.dealerships.find((d) => d.ownerId === "u-dealer")!
    // Opening the fields changes nothing: the dealership's details are still what is sent.
    fireEvent.click(same())
    expect(await screen.findByLabelText(/^Phone number/)).toBeTruthy()
    await publishNow()
    const values = await sent()
    expect(values.phone).toBe(own.phones[0])
    expect(values.districtId).toBe(own.districtId)
  })
})
