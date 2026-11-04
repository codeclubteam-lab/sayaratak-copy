import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { draftQuery } from "@/features/auth/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import { userOnboardingSchema } from "@/features/onboarding/schemas"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
})

// The user `renderShell` signs in, with no city yet. Onboarding is un-finished only after the render, because `renderShell` picks a finished account.
const fresh = () => {
  const u = db.users.find((x) => x.role === "user" && x.onboardingDone)!
  u.cityId = undefined
  u.interests = []
  return u
}
const open = async (draft?: object) => {
  const u = fresh()
  if (draft)
    db.drafts.push({
      id: `${u.id}:onboarding:user`,
      userId: u.id,
      key: "onboarding:user",
      data: { ...draft },
    })
  const shell = await renderShell(
    <OnboardingStepPage role="user" stepId="details" />,
    { role: "user", path: "/en/onboarding/user/details" }
  )
  u.onboardingDone = false
  await waitFor(() =>
    expect(
      shell.client.getQueryData(draftQuery("onboarding:user").queryKey)
    ).toBeDefined()
  )
  await waitFor(() =>
    expect(shell.client.getQueryData(taxonomyQuery.queryKey)).toBeDefined()
  )
  return { ...shell, user: u }
}
const city = () => screen.getByRole("combobox")
const finish = () =>
  fireEvent.click(screen.getByRole("button", { name: "Start using Sayaratak" }))

describe("userOnboardingSchema", () => {
  const ok = { cityId: "khartoum", interests: [] }
  it("needs a city", () => {
    expect(userOnboardingSchema.safeParse(ok).success).toBe(true)
    const bad = userOnboardingSchema.safeParse({ ...ok, cityId: "" })
    expect(bad.error?.issues.map((i) => i.message)).toEqual([
      "validation.required",
    ])
  })
  it("rejects unknown interests", () => {
    expect(
      userOnboardingSchema.safeParse({ ...ok, interests: ["boats"] }).success
    ).toBe(false)
  })
})

describe("UserDetailsStep", () => {
  it("does not ask the name again and counts the role page as step 1", async () => {
    await open()
    expect(screen.queryByRole("textbox", { name: /Full name/ })).toBeNull()
    expect(screen.getByText("Step 2 of 2")).toBeTruthy()
  })

  it("keeps Finish from going through without a city", async () => {
    const { user } = await open()
    finish()
    await screen.findByText("This field is required")
    expect(user.onboardingDone).toBe(false)
    expect(db.drafts.some((d) => d.key === "onboarding:user")).toBe(false)
  })

  it("finishes with only a city and lands on the account", async () => {
    const { router, user } = await open()
    await pick(city(), "Khartoum")
    finish()
    await waitFor(() =>
      expect(router.state.location.href).toBe("/en/account?welcome=1")
    )
    expect(user.cityId).toBe("khartoum")
    expect(user.onboardingDone).toBe(true)
    expect(user.interests).toEqual([])
  })

  it("stores the chosen interests and an uploaded photo", async () => {
    const { router, user } = await open({
      details: { avatarId: "up-1" },
    })
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy()
    await pick(city(), "Khartoum")
    fireEvent.click(screen.getByRole("checkbox", { name: "Tuk-tuks" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Parts" }))
    finish()
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/account")
    )
    expect(user.interests).toEqual(["tuk_tuks", "parts"])
    expect(user.avatarUrl).toContain("/uploads/up-1")
  })
})
