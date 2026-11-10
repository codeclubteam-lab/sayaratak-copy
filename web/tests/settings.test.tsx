import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SettingsPage } from "@/features/settings/components/settings-page"
import {
  deleteAccountSchema,
  passwordFormSchema,
  profileFormSchema,
  profileWithoutEmailFormSchema,
} from "@/features/settings/schemas"
import { db, resetDb } from "@/mocks/db"
import { DEMO_PASSWORD } from "@/mocks/seed/people"
import { dashboardPath } from "@/lib/navigation"
import type { Role } from "@sayaratak/shared/schemas/fields"
import { pick } from "./pick"
import { renderShell } from "./shell-render"
import { authClient } from "./auth-client-fake"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
// jsdom lacks it; input-otp polls it for password-manager badges.
document.elementFromPoint = () => null

beforeEach(() => {
  resetDb()
  document.cookie = "data_saver=; Path=/; Max-Age=0"
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const rowOf = (role: Role) =>
  db.users.find((u) => u.role === role && u.onboardingDone)!
const open = (role: Role = "user") =>
  renderShell(<SettingsPage role={role} />, {
    role,
    path: `/en${dashboardPath(role)}/settings`,
  })
const field = (name: string | RegExp) => screen.findByLabelText(name)
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } })
const save = (name = "Save") =>
  fireEvent.click(screen.getByRole("button", { name }))

describe("settings schemas", () => {
  const base = { fullName: "Omar Hassan", cityId: "", avatarUrl: "" }
  it("needs an email, the phone is optional", () => {
    const first = (v: object) =>
      profileFormSchema.safeParse({ ...base, ...v }).error?.issues[0]
    expect(first({ email: "", phone: "+249912345678" })).toMatchObject({
      path: ["email"],
      message: "validation.required",
    })
    expect(first({ email: "a@b", phone: "" })?.message).toBe("validation.email")
    expect(first({ email: "a@b.co", phone: "" })).toBeUndefined()
  })
  it("allows a missing Facebook email but still validates an entered email", () => {
    const parse = (email: string) =>
      profileWithoutEmailFormSchema.safeParse({ ...base, email, phone: "" })
    expect(parse("").success).toBe(true)
    expect(parse("not-an-email").error?.issues[0]?.message).toBe(
      "validation.email"
    )
    expect(parse("a@example.com").success).toBe(true)
  })
  it("refuses the same password as the new one", () => {
    const parse = (currentPassword: string, newPassword: string) =>
      passwordFormSchema.safeParse({ currentPassword, newPassword })
    expect(parse("Demo1234", "Demo1234").error?.issues[0]?.message).toBe(
      "validation.password_same"
    )
    expect(parse("Demo1234", "Other5678").success).toBe(true)
  })
  it("takes the confirmation word in either language, exactly", () => {
    const ok = (phrase: string) => deleteAccountSchema.safeParse({ phrase })
    expect(ok("DELETE").success).toBe(true)
    expect(ok(" حذف ").success).toBe(true)
    expect(ok("delete").error?.issues[0]?.message).toBe("validation.phrase")
  })
})

describe("SettingsPage", () => {
  it("shows five sections, with the notifications link to the role's page", async () => {
    await open()
    for (const name of [
      "Profile",
      "Sign in and security",
      "Preferences",
      "Notification settings",
      "Delete account",
    ])
      expect(await screen.findByRole("heading", { name })).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Go to notifications" })
        .getAttribute("href")
    ).toBe("/en/account/notifications")
  })

  it.each(["dealership", "workshop", "mechanic"] as const)(
    "gives the %s the same five sections, linked to its own notifications",
    async (role) => {
      await open(role)
      expect(
        await screen.findByRole("heading", { name: "Delete account" })
      ).toBeTruthy()
      expect(
        screen
          .getByRole("link", { name: "Go to notifications" })
          .getAttribute("href")
      ).toBe(`/en${dashboardPath(role)}/notifications`)
    }
  )

  it("gives the admin an account page without the delete section", async () => {
    await open("admin")
    expect(await screen.findByRole("heading", { name: "Account" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Delete account" })).toBeNull()
    expect(
      screen
        .getByRole("link", { name: "Go to notifications" })
        .getAttribute("href")
    ).toBe("/en/admin/notifications")
  })

  it("saves the admin's name, password and data saver", async () => {
    await open("admin")
    type(await field("Full name *"), "Admin Saved")
    save()
    await waitFor(() => expect(rowOf("admin").fullName).toBe("Admin Saved"))
    const password = rowOf("admin").password!
    type(await field("Current password"), password)
    type(await field("New password"), "Fresh1234")
    save("Change password")
    await waitFor(() => expect(rowOf("admin").password).toBe("Fresh1234"))
    const toggle = await screen.findByRole("switch", { name: "Data saver" })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(toggle.getAttribute("aria-checked")).toBe("true")
    )
  })

  it("saves the name and confirms in place", async () => {
    await open()
    type(await field("Full name *"), "Omar Saved")
    save()
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0)
    expect(rowOf("user").fullName).toBe("Omar Saved")
  })

  it("keeps the old name when it is too short", async () => {
    const before = rowOf("user").fullName
    await open()
    type(await field("Full name *"), "O")
    save()
    expect(await screen.findByText(/at least 2/i)).toBeTruthy()
    expect(rowOf("user").fullName).toBe(before)
  })

  it("saves a new phone without a code and leaves it unverified", async () => {
    await open()
    type(await field("Phone number"), "922222222")
    save()
    await waitFor(() => expect(rowOf("user").phone).toBe("+249922222222"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(rowOf("user").verifiedPhone).toBe(false)
  })

  it("leaves the email alone when the code dialog is cancelled", async () => {
    const before = rowOf("user").email
    await open()
    type(await field("Email *"), "new-email@example.com")
    save()
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(rowOf("user").email).toBe(before)
    expect(authClient.emailOtp.requestEmailChange).toHaveBeenCalledWith({
      newEmail: "new-email@example.com",
    })
  })

  it("still needs a code to save a new email", async () => {
    const before = rowOf("user").email
    await open()
    type(await field("Email *"), "verified-new@example.com")
    save()
    const dialog = await screen.findByRole("dialog")
    type(within(dialog).getByLabelText("Verification code"), "111111")
    expect(
      await within(dialog).findByText("The code is not correct")
    ).toBeTruthy()
    expect(rowOf("user").email).toBe(before)
    type(within(dialog).getByLabelText("Verification code"), "123456")
    await waitFor(() =>
      expect(rowOf("user").email).toBe("verified-new@example.com")
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("leaves a missing Facebook email empty and saves unrelated profile edits", async () => {
    rowOf("user").email = undefined
    rowOf("user").password = null
    await open()
    const email = await field(/^Email/)
    expect(email).toHaveProperty("value", "")
    expect(email.getAttribute("aria-required")).not.toBe("true")
    type(await field("Full name *"), "Facebook Person")
    save()
    await waitFor(() => expect(rowOf("user").fullName).toBe("Facebook Person"))
    expect(authClient.emailOtp.requestEmailChange).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("shows a number another account has under its field, with no code dialog, and saves nothing", async () => {
    const other = db.users.find((u) => u.phone && u.id !== rowOf("user").id)!
    await open()
    const name = rowOf("user").fullName
    type(await field(/Full name/), "Someone Else")
    type(await field("Phone number"), other.phone!.slice(4))
    save()
    expect(
      await screen.findByText(
        "Another account already uses this phone number or email"
      )
    ).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(rowOf("user").fullName).toBe(name)
  })

  it("changes the password after the right current one", async () => {
    await open()
    type(await field("Current password"), "Wrong0000")
    type(await field("New password"), "Fresh1234")
    save("Change password")
    expect(
      await screen.findByText("The current password is not correct")
    ).toBeTruthy()
    expect(rowOf("user").password).toBe(DEMO_PASSWORD)
    type(await field("Current password"), DEMO_PASSWORD)
    save("Change password")
    await waitFor(() => expect(rowOf("user").password).toBe("Fresh1234"))
  })

  it("lets an account without a password create one, with no current password", async () => {
    rowOf("user").password = null
    await open()
    await screen.findByRole("button", { name: "Create password" })
    expect(screen.queryByLabelText("Current password")).toBeNull()
    type(await field("New password"), "Fresh1234")
    save("Create password")
    await waitFor(() => expect(rowOf("user").password).toBe("Fresh1234"))
    expect(await screen.findByLabelText("Current password")).toBeTruthy()
  })

  it("turns data saver on at once", async () => {
    await open()
    const toggle = await screen.findByRole("switch", { name: "Data saver" })
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(toggle.getAttribute("aria-checked")).toBe("true")
    )
    expect(document.cookie).toContain("data_saver=1")
  })

  it("remembers a new language on the account and reloads the page in it", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    await open()
    await pick(screen.getByRole("combobox", { name: "Language" }), "العربية")
    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(rowOf("user").locale).toBe("ar")
    expect(String(assign.mock.lastCall?.[0])).toContain("/ar/account/settings")
    vi.unstubAllGlobals()
  })

  it("deletes only after the word is typed", async () => {
    const id = rowOf("user").id
    await open()
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete my account" })
    )
    const dialog = await screen.findByRole("alertdialog")
    const word = within(dialog).getByLabelText("Type DELETE to confirm")
    type(word, "nope")
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" })
    )
    expect(
      await within(dialog).findByText("Type the confirmation word exactly")
    ).toBeTruthy()
    expect(db.users.some((u) => u.id === id)).toBe(true)
    type(word, "DELETE")
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete account" })
    )
    await waitFor(() => expect(db.users.some((u) => u.id === id)).toBe(false))
  })
})
