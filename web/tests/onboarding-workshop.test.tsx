import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { draftQuery } from "@/features/auth/queries"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import {
  workshopHoursServicesSchema,
  workshopLocationSchema,
} from "@/features/onboarding/schemas"
import { defaultWeeklyHours } from "@/lib/hours"
import { db, resetDb } from "@/mocks/db"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
})

let ownerId = ""
const owner = () => db.users.find((u) => u.id === ownerId)!
const draft = () =>
  db.drafts.find((d) => d.id === `${owner().id}:onboarding:workshop`)?.data

function Harness() {
  const stepId = useRouterState({
    select: (s) => s.location.pathname.split("/").pop() ?? "",
  })
  return <OnboardingStepPage role="workshop" stepId={stepId} />
}

const districtOf = (cityId: string) =>
  db.taxonomy.districts.find((d) => d.cityId === cityId)!.id
const business = { name: "Nile Garage", description: "A".repeat(20) }
const place = {
  cityId: "khartoum",
  districtId: "",
  address: "Street 15",
  location: null,
  phone: "+249912345678",
  whatsapp: "",
}
const open = async (step: string, saved: object = {}) => {
  const u = db.users.find((x) => x.role === "user" && x.onboardingDone)!
  ownerId = u.id
  u.cityId = undefined
  u.phone = undefined
  db.drafts.push({
    id: `${u.id}:onboarding:workshop`,
    userId: u.id,
    key: "onboarding:workshop",
    data: { ...saved },
  })
  const shell = await renderShell(<Harness />, {
    role: "user",
    path: `/en/onboarding/workshop/${step}`,
  })
  await waitFor(() =>
    expect(
      shell.client.getQueryData(draftQuery("onboarding:workshop").queryKey)
    ).toBeDefined()
  )
  // The step body is a lazy chunk.
  await waitFor(() =>
    expect(document.querySelector("form > div")?.childElementCount).toBeTruthy()
  )
  return shell
}
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "Continue" }))
const chip = (name: string) => screen.findByRole("checkbox", { name })

describe("workshop schemas", () => {
  it("location takes one phone and an empty WhatsApp", () => {
    const ok = { ...place, districtId: "d1" }
    expect(workshopLocationSchema.safeParse(ok).success).toBe(true)
    expect(
      workshopLocationSchema.safeParse({ ...ok, phone: "12" }).success
    ).toBe(false)
  })

  it("services need one to ten rows and a price above zero", () => {
    const row = { name: "Oil change", priceFrom: null, templateId: null }
    const hours = defaultWeeklyHours
    const parse = (services: unknown[]) =>
      workshopHoursServicesSchema.safeParse({ hours, services })
    expect(parse([row]).success).toBe(true)
    expect(parse([]).error?.issues[0]?.message).toBe("validation.select_min")
    expect(parse(Array(11).fill(row)).success).toBe(false)
    expect(parse([{ ...row, name: " " }]).success).toBe(false)
    expect(parse([{ ...row, priceFrom: 0 }]).error?.issues[0]?.message).toBe(
      "validation.price_min"
    )
  })
})

describe("workshop steps", () => {
  it("business step uses workshop labels", async () => {
    await open("business")
    expect(screen.getByRole("textbox", { name: "Workshop name" })).toBeTruthy()
    expect(
      screen.getByRole("textbox", { name: "About the workshop" })
    ).toBeTruthy()
  })

  it("location step has one required phone", async () => {
    await open("location")
    expect(screen.getByRole("textbox", { name: "Phone number" })).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Add a phone number" })
    ).toBeNull()
    next()
    await screen.findAllByText("This field is required")
    expect(draft()).toEqual({})
  })

  it("requires a service, then adds a template and a custom one", async () => {
    await open("hours-services")
    next()
    await screen.findByText("Choose at least one option")
    expect(draft()).toEqual({})
    fireEvent.click(await chip("Oil change"))
    fireEvent.click(
      screen.getByRole("button", { name: "Add a custom service" })
    )
    const names = screen.getAllByRole("textbox", { name: /^Service \d name$/ })
    expect(names.map((n) => (n as HTMLInputElement).value)).toEqual([
      "Oil change",
      "",
    ])
    fireEvent.change(names[1]!, { target: { value: "Wheel wash" } })
    fireEvent.change(
      screen.getAllByRole("textbox", { name: /Price from/ })[0]!,
      {
        target: { value: "25000" },
      }
    )
    next()
    await waitFor(() =>
      expect(draft()).toMatchObject({
        "hours-services": {
          services: [
            { name: "Oil change", priceFrom: 25000, templateId: "oil-change" },
            { name: "Wheel wash", priceFrom: null, templateId: null },
          ],
        },
      })
    )
  })

  it("unticking a template removes its row and a custom row stays", async () => {
    await open("hours-services")
    fireEvent.click(await chip("Brakes"))
    fireEvent.click(
      screen.getByRole("button", { name: "Add a custom service" })
    )
    fireEvent.click(await chip("Brakes"))
    const names = screen.getAllByRole("textbox", { name: /^Service \d name$/ })
    expect(names).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Remove service 1" }))
    // The page behind the dialog is hidden from role queries, and the row is still there.
    expect(
      screen.getAllByRole("textbox", {
        name: /^Service \d name$/,
        hidden: true,
      })
    ).toHaveLength(1)
    await confirmRemove("Remove service 1?")
    expect(
      screen.queryByRole("textbox", { name: /^Service \d name$/ })
    ).toBeNull()
  })

  it("stops at ten services", async () => {
    await open("hours-services")
    for (const t of db.taxonomy.serviceTemplates.slice(0, 9))
      fireEvent.click(await chip(t.name.en))
    fireEvent.click(
      screen.getByRole("button", { name: "Add a custom service" })
    )
    expect(
      screen.queryByRole("button", { name: "Add a custom service" })
    ).toBeNull()
  })
})

describe("workshop plan step and finish", () => {
  const saved = {
    business,
    location: { ...place, districtId: districtOf("khartoum") },
    "hours-services": {
      hours: defaultWeeklyHours,
      services: [
        { name: "Oil change", priceFrom: 25000, templateId: "oil-change" },
        { name: "Brakes", priceFrom: null, templateId: null },
      ],
    },
  }

  it("lists the workshop plans with the free one preselected", async () => {
    await open("plan", saved)
    await screen.findByRole("radio", { checked: true })
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(2)
    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText("Start free")).toBeTruthy()
  })

  it("creates a visible workshop with its services on the free plan", async () => {
    const { router } = await open("plan", saved)
    await screen.findByRole("radio", { checked: true })
    fireEvent.click(screen.getByRole("button", { name: "Create my workshop" }))
    await waitFor(
      () => expect(router.state.location.href).toBe("/en/workshop?welcome=1"),
      { timeout: 12_000 }
    )
    const made = db.workshops.find((w) => w.name.en === "Nile Garage")!
    expect(made).toMatchObject({
      status: "active",
      verified: false,
      phone: "+249912345678",
      services: [{ name: "Oil change", priceFrom: 25000 }, { name: "Brakes" }],
    })
    expect(made.services[1]?.priceFrom).toBeUndefined()
    expect(owner().role).toBe("workshop")
    const sub = await (await fetch("/api/me/subscription")).json()
    expect(sub.subscription.planId).toBe("plan-workshop-basic")
    expect(sub.subscription.price).toBe(0)
    const listed = await (await fetch("/api/workshops?q=Nile")).json()
    expect(
      listed.items.map((w: { name: { en: string } }) => w.name.en)
    ).toContain("Nile Garage")
  })
})
