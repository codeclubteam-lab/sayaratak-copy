import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { draftQuery } from "@/features/auth/queries"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import {
  mechanicAboutSchema,
  mechanicExpertiseSchema,
} from "@/features/onboarding/schemas"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
})

let ownerId = ""
const owner = () => db.users.find((u) => u.id === ownerId)!
const draft = () =>
  db.drafts.find((d) => d.id === `${owner().id}:onboarding:mechanic`)?.data

function Harness() {
  const stepId = useRouterState({
    select: (s) => s.location.pathname.split("/").pop() ?? "",
  })
  return <OnboardingStepPage role="mechanic" stepId={stepId} />
}

const about = {
  name: "Hassan Ali",
  phone: "+249912345678",
  whatsapp: "",
  yearsOfExperience: 8,
  bio: "A".repeat(20),
}
const expertise = {
  specializationIds: ["engine", "ac"],
  cityId: "khartoum",
  servedCityIds: ["omdurman"],
}
const open = async (step: string, saved: object = {}) => {
  const u = db.users.find((x) => x.role === "user" && x.onboardingDone)!
  ownerId = u.id
  u.cityId = undefined
  u.phone = undefined
  db.drafts.push({
    id: `${u.id}:onboarding:mechanic`,
    userId: u.id,
    key: "onboarding:mechanic",
    data: { ...saved },
  })
  const shell = await renderShell(<Harness />, {
    role: "user",
    path: `/en/onboarding/mechanic/${step}`,
  })
  await waitFor(() =>
    expect(
      shell.client.getQueryData(draftQuery("onboarding:mechanic").queryKey)
    ).toBeDefined()
  )
  return shell
}
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "Continue" }))
const chip = (name: string) => screen.findByRole("checkbox", { name })

describe("mechanic schemas", () => {
  it("about needs 0 to 60 years and a bio of 20 to 600 characters", () => {
    const parse = (v: object) =>
      mechanicAboutSchema.safeParse({ ...about, ...v })
    expect(parse({}).success).toBe(true)
    expect(parse({ yearsOfExperience: 0 }).success).toBe(true)
    expect(parse({ yearsOfExperience: null }).error?.issues[0]?.message).toBe(
      "validation.required"
    )
    expect(parse({ yearsOfExperience: 61 }).success).toBe(false)
    expect(parse({ bio: "short" }).error?.issues[0]?.message).toBe(
      "validation.desc_min"
    )
    expect(parse({ bio: "A".repeat(601) }).success).toBe(false)
  })

  it("expertise takes 1 to 6 skills and at most 5 other cities", () => {
    const parse = (v: object) =>
      mechanicExpertiseSchema.safeParse({ ...expertise, ...v })
    expect(parse({}).success).toBe(true)
    expect(parse({ specializationIds: [] }).error?.issues[0]?.message).toBe(
      "validation.select_min"
    )
    expect(parse({ specializationIds: "abcdefg".split("") }).success).toBe(
      false
    )
    expect(parse({ servedCityIds: "abcdef".split("") }).success).toBe(false)
    expect(parse({ cityId: "" }).success).toBe(false)
  })

  it("about needs a phone, name, years and bio", () => {
    const ok = {
      name: "Omar",
      phone: "+249912345678",
      whatsapp: "",
      yearsOfExperience: 5,
      bio: "A".repeat(30),
    }
    expect(mechanicAboutSchema.safeParse(ok).success).toBe(true)
    expect(mechanicAboutSchema.safeParse({ ...ok, phone: "12" }).success).toBe(
      false
    )
  })
})

describe("mechanic steps", () => {
  it("about step blocks an empty form, then saves the values", async () => {
    await open("about")
    next()
    await screen.findAllByText("This field is required")
    expect(draft()).toEqual({})
    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), {
      target: { value: about.name },
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), {
      target: { value: about.phone },
    })
    fireEvent.change(
      screen.getByRole("textbox", { name: "Years of experience" }),
      { target: { value: "8" } }
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Short bio" }), {
      target: { value: about.bio },
    })
    expect(screen.getByText("20/600")).toBeTruthy()
    next()
    await waitFor(() => expect(draft()).toMatchObject({ about: { ...about } }))
  })

  it("expertise step caps skills at 6 and lists the other cities without the home city", async () => {
    await open("expertise", { about })
    next()
    await screen.findByText("Choose at least one option")
    for (const s of db.taxonomy.specializations.slice(0, 7))
      fireEvent.click(await chip(s.name.en))
    expect(
      screen.getAllByRole<HTMLInputElement>("checkbox").filter((c) => c.checked)
    ).toHaveLength(6)
    await pick(screen.getByRole("combobox", { name: "Home city" }), "Khartoum")
    expect(screen.queryByRole("checkbox", { name: "Khartoum" })).toBeNull()
    fireEvent.click(await chip("Omdurman"))
    await pick(screen.getByRole("combobox", { name: "Home city" }), "Omdurman")
    expect(screen.queryByRole("checkbox", { name: "Omdurman" })).toBeNull()
    next()
    await waitFor(() =>
      expect(draft()).toMatchObject({
        expertise: { cityId: "omdurman", servedCityIds: [] },
      })
    )
  })
})

describe("mechanic plan step and finish", () => {
  const saved = {
    about,
    expertise,
    plan: { planId: "" },
  }

  it("lists the mechanic plans with the free one preselected", async () => {
    await open("plan", { about, expertise })
    await screen.findByRole("radio", { checked: true })
    const radios = screen.getAllByRole("radio")
    expect(radios).toHaveLength(2)
    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText("Start free")).toBeTruthy()
  })

  it("creates a listed mechanic profile on the free plan", async () => {
    const { router } = await open("plan", saved)
    await screen.findByRole("radio", { checked: true })
    fireEvent.click(screen.getByRole("button", { name: "Create my profile" }))
    await waitFor(
      () => expect(router.state.location.href).toBe("/en/mechanic?welcome=1"),
      { timeout: 12_000 }
    )
    const made = db.mechanics.find((m) => m.name.en === "Hassan Ali")!
    expect(made).toMatchObject({
      status: "active",
      verified: false,
      cityId: "khartoum",
      servedCityIds: ["khartoum", "omdurman"],
      yearsOfExperience: 8,
      specializationIds: ["engine", "ac"],
      bio: { ar: about.bio, en: about.bio },
      phone: "+249912345678",
    })
    expect(owner().role).toBe("mechanic")
    const sub = await (await fetch("/api/me/subscription")).json()
    expect(sub.subscription.planId).toBe("plan-mechanic-basic")
    const listed = await (await fetch("/api/mechanics?q=Hassan")).json()
    expect(
      listed.items.map((m: { name: { en: string } }) => m.name.en)
    ).toContain("Hassan Ali")
  })
})
