import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { draftQuery } from "@/features/auth/queries"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import { reachableIndex } from "@/features/onboarding/draft"
import { flows } from "@/features/onboarding/flows"
import {
  dealerBusinessSchema,
  dealerLocationSchema,
  hoursStepSchema,
} from "@/features/onboarding/schemas"
import { defaultWeeklyHours } from "@/lib/hours"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
})

// The account is found by role once; after finishing, its role is no longer "user".
let ownerId = ""
const owner = () => db.users.find((u) => u.id === ownerId)!
const draft = () =>
  db.drafts.find((d) => d.id === `${owner().id}:onboarding:dealership`)?.data

function Harness() {
  const stepId = useRouterState({
    select: (s) => s.location.pathname.split("/").pop() ?? "",
  })
  return <OnboardingStepPage role="dealership" stepId={stepId} />
}

const business = { name: "Desert Motors", description: "Too short" }
const place = {
  cityId: "khartoum",
  districtId: "",
  address: "Street 15",
  location: null,
  phones: [{ value: "+249912345678" }],
  whatsapp: "",
}
// An account with no city or phone, signed in to a dealership flow that already holds `saved`.
const open = async (step: string, saved: object = {}) => {
  const u = db.users.find((x) => x.role === "user" && x.onboardingDone)!
  ownerId = u.id
  u.cityId = undefined
  u.phone = undefined
  db.drafts.push({
    id: `${u.id}:onboarding:dealership`,
    userId: u.id,
    key: "onboarding:dealership",
    data: { ...saved },
  })
  const shell = await renderShell(<Harness />, {
    role: "user",
    path: `/en/onboarding/dealership/${step}`,
  })
  await waitFor(() =>
    expect(
      shell.client.getQueryData(draftQuery("onboarding:dealership").queryKey)
    ).toBeDefined()
  )
  // The step body is a lazy chunk.
  await waitFor(() =>
    expect(document.querySelector("form > div")?.childElementCount).toBeTruthy()
  )
  return shell
}
// What the billing page would read: the newest subscription of the signed-in account.
const planOnFile = async () =>
  (
    (await (await fetch("/api/me/subscription")).json()) as {
      subscription: { planId: string }
    }
  ).subscription.planId
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "Continue" }))
const change = (name: string | RegExp, value: string, role = "textbox") =>
  fireEvent.change(screen.getByRole(role, { name }), { target: { value } })
const districtOf = (cityId: string) =>
  db.taxonomy.districts.find((d) => d.cityId === cityId)!.id

describe("dealership schemas", () => {
  it("business needs a name and a description of 20 characters", () => {
    expect(dealerBusinessSchema.safeParse(business).success).toBe(false)
    const long = { ...business, description: "A".repeat(20) }
    expect(dealerBusinessSchema.safeParse(long).success).toBe(true)
    expect(
      dealerBusinessSchema.safeParse({ ...long, name: " " }).error?.issues[0]
        ?.message
    ).toBe("validation.required")
  })

  it("location needs a district, 1 to 3 phones and takes an empty WhatsApp", () => {
    const ok = { ...place, districtId: "d1" }
    expect(dealerLocationSchema.safeParse(ok).success).toBe(true)
    expect(dealerLocationSchema.safeParse(place).success).toBe(false)
    expect(
      dealerLocationSchema.safeParse({ ...ok, phones: [] }).error?.issues[0]
        ?.message
    ).toBe("validation.phone_min")
    expect(
      dealerLocationSchema.safeParse({
        ...ok,
        phones: Array.from({ length: 4 }, () => ({ value: "+249912345678" })),
      }).success
    ).toBe(false)
  })

  it("hours reject an opening time after the closing time", () => {
    const hours = defaultWeeklyHours.map((h) =>
      h.day === 6 ? { ...h, open: "19:00" } : h
    )
    expect(hoursStepSchema.safeParse({ hours }).error?.issues[0]?.message).toBe(
      "validation.hours_order"
    )
    expect(
      hoursStepSchema.safeParse({ hours: defaultWeeklyHours }).success
    ).toBe(true)
  })

  it("a step opens only after the earlier ones are saved", () => {
    const steps = flows.dealership
    expect(reachableIndex(steps, {})).toBe(0)
    expect(reachableIndex(steps, { business })).toBe(0)
    const long = { ...business, description: "A".repeat(20) }
    expect(reachableIndex(steps, { business: long })).toBe(1)
  })
})

describe("business step", () => {
  it("counts characters and blocks a short description", async () => {
    await open("business")
    change("Dealership name", "Desert Motors")
    change("About the dealership", "Short")
    expect(screen.getByText("5/1000")).toBeTruthy()
    next()
    await screen.findByText("Write a longer description")
    expect(draft()).toEqual({})
  })

  it("saves and moves on to the location step with its fields mounted", async () => {
    const { router } = await open("business")
    change("Dealership name", "Desert Motors")
    change("About the dealership", "Used cars, trucks and spare parts.")
    next()
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/en/onboarding/dealership/location"
      )
    )
    await screen.findByRole("textbox", { name: "Street address" })
    expect(draft()).toMatchObject({
      business: { name: "Desert Motors" },
    })
  })
})

describe("location step", () => {
  it("shows an error for each missing field", async () => {
    await open("location")
    next()
    await screen.findAllByText("This field is required")
    expect(draft()).toEqual({})
  })

  it("saves the place, the phones and a WhatsApp number copied from the first phone", async () => {
    const { router } = await open("location")
    const city = screen.getByRole("combobox", { name: "City" })
    await pick(city, "Khartoum")
    await pick(
      screen.getByRole("combobox", { name: "District" }),
      db.taxonomy.districts.find((d) => d.id === districtOf("khartoum"))!.name
        .en
    )
    change("Street address", "Street 15")
    const phone = screen.getByRole("textbox", { name: "Phone number 1" })
    fireEvent.change(phone, { target: { value: "912345678" } })
    fireEvent.blur(phone)
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Same as first phone" })
    )
    next()
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/en/onboarding/dealership/hours"
      )
    )
    expect(draft()).toMatchObject({
      location: {
        cityId: "khartoum",
        districtId: districtOf("khartoum"),
        address: "Street 15",
        phones: [{ value: "+249912345678" }],
        whatsapp: "+249912345678",
      },
    })
  })

  it("adds a second phone and keeps the saved values after a reload", async () => {
    await open("location", {
      location: {
        ...place,
        districtId: districtOf("khartoum"),
        whatsapp: "+249912345678",
      },
    })
    expect(
      screen.getByRole("textbox", { name: "Street address" })
    ).toHaveProperty("value", "Street 15")
    expect(
      screen
        .getByRole("checkbox", { name: "Same as first phone" })
        .getAttribute("aria-checked")
    ).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Add a phone number" }))
    expect(screen.getByRole("textbox", { name: "Phone number 2" })).toBeTruthy()
  })
})

describe("hours step", () => {
  it("starts on Saturday to Thursday 8 to 18 and blocks an opening time after closing", async () => {
    await open("hours")
    expect(screen.getByLabelText("Opens, Saturday")).toHaveProperty(
      "value",
      "08:00"
    )
    expect(screen.getByLabelText("Closes, Saturday")).toHaveProperty(
      "value",
      "18:00"
    )
    expect(
      screen
        .getByRole("group", { name: "Friday" })
        .querySelector('[role="checkbox"]')
        ?.getAttribute("aria-checked")
    ).toBe("true")
    fireEvent.change(screen.getByLabelText("Opens, Saturday"), {
      target: { value: "19:00" },
    })
    next()
    await screen.findByText("Opening time must be before closing time")
    expect(draft()).toEqual({})
  })
})

describe("plan step and finish", () => {
  const long = { ...business, description: "A".repeat(20) }
  const saved = {
    business: long,
    location: { ...place, districtId: districtOf("khartoum") },
    hours: { hours: defaultWeeklyHours },
  }

  it("preselects the free plan and lists the dealership plans", async () => {
    await open("plan", saved)
    await screen.findByRole("radio", { checked: true })
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(3)
    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText("Start free")).toBeTruthy()
    expect(screen.getByText(/Paid plans start once your transfer/)).toBeTruthy()
  })

  it("creates a visible dealership on the free plan and lands on the dealer dashboard", async () => {
    const { router } = await open("plan", saved)
    await screen.findByRole("radio", { checked: true })
    fireEvent.click(
      screen.getByRole("button", { name: "Create my dealership" })
    )
    await waitFor(
      () => expect(router.state.location.href).toBe("/en/dealer?welcome=1"),
      { timeout: 12_000 }
    )
    const made = db.dealerships.find((d) => d.name.en === "Desert Motors")!
    expect(made).toMatchObject({
      status: "active",
      verified: false,
      cityId: "khartoum",
      address: "Street 15",
      phones: ["+249912345678"],
    })
    expect(owner().role).toBe("dealership")
    expect(await planOnFile()).toBe("plan-dealer-starter")
    const listed = await (await fetch("/api/dealerships?q=Desert")).json()
    expect(
      listed.items.map((d: { name: { en: string } }) => d.name.en)
    ).toContain("Desert Motors")
  })

  it("a chosen paid plan goes to its checkout, starts on the free plan and waits on the account", async () => {
    const { router } = await open("plan", saved)
    fireEvent.click(await screen.findByRole("radio", { name: /Growth/ }))
    fireEvent.click(
      screen.getByRole("button", { name: "Create my dealership" })
    )
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/en/dealer/billing/checkout?item=plan%3Aplan-dealer-growth"
      )
    )
    expect(draft()).toMatchObject({ plan: { planId: "plan-dealer-growth" } })
    expect(await planOnFile()).toBe("plan-dealer-starter")
    expect(owner().chosenPlanId).toBe("plan-dealer-growth")
  })
})
