import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { RoleForm } from "@/features/onboarding/components/role-form"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(resetDb)

const user = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const saved = (key: string) =>
  db.drafts.find((d) => d.id === `${user().id}:${key}`)?.data

describe("RoleForm", () => {
  it("selects the individual option and continues in one click", async () => {
    const { router } = await renderShell(<RoleForm />, { role: "user" })
    expect(
      screen.getByRole<HTMLInputElement>("radio", {
        name: /Buy, sell or rent vehicles/,
      }).checked
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/onboarding/user/details")
    )
    expect(saved("onboarding:role")).toEqual({ role: "user" })
  })

  it("carries the redirect into the flow", async () => {
    const { router } = await renderShell(<RoleForm redirect="/en/post" />, {
      role: "user",
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/en/onboarding/user/details?redirect=%2Fen%2Fpost"
      )
    )
  })

  it("sends each role to its own flow and keeps another role's draft", async () => {
    db.drafts.push({
      id: `${user().id}:onboarding:dealership`,
      userId: user().id,
      key: "onboarding:dealership",
      data: { business: { name: "Kept" } },
    })
    const { router } = await renderShell(<RoleForm />, { role: "user" })
    fireEvent.click(screen.getByRole("radio", { name: /Workshop/ }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/en/onboarding/workshop/business"
      )
    )
    expect(saved("onboarding:role")).toEqual({ role: "workshop" })
    expect(saved("onboarding:dealership")).toEqual({
      business: { name: "Kept" },
    })
  })

  it("restores the saved choice when coming back", async () => {
    db.drafts.push({
      id: `${user().id}:onboarding:role`,
      userId: user().id,
      key: "onboarding:role",
      data: { role: "mechanic" },
    })
    await renderShell(<RoleForm />, { role: "user" })
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>("radio", { name: /Mechanic/ })
          .checked
      ).toBe(true)
    )
  })
})
