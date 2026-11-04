import { isRedirect } from "@tanstack/react-router"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthDialog } from "@/features/auth/components/auth-dialog"
import { closeAuthGate } from "@/features/auth/auth-gate"
import { redirectBanned } from "@/features/auth/guards"
import { useUpdateNotificationPrefs } from "@/features/auth/queries"
import { Header } from "@/components/app/header"
import { keys } from "@/lib/api/query-keys"
import { db, resetDb } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"
import { useMockFetch } from "./mock-fetch"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  vi.stubEnv("VITE_DEMO", "true")
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  closeAuthGate()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const signOut = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Account" }))
  fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }))
}

describe("sign out", () => {
  it("stays on a public page", async () => {
    const { router, client } = await renderShell(<Header />, {
      role: "user",
      path: "/en/vehicles/cars/sale",
    })
    await signOut()
    await waitFor(() => expect(client.getQueryData(keys.me)).toBeNull())
    expect(router.state.location.pathname).toBe("/en/vehicles/cars/sale")
  })
  it("goes home from a protected page", async () => {
    const { router } = await renderShell(<Header />, {
      role: "user",
      path: "/en/account/favorites",
    })
    await signOut()
    await waitFor(() => expect(router.state.location.pathname).toBe("/en"))
  })
})

function Save() {
  const save = useUpdateNotificationPrefs()
  return (
    <>
      <button onClick={() => save.mutate({ billing: false })}>save</button>
      <output>{save.isSuccess ? "saved" : "idle"}</output>
      <AuthDialog />
    </>
  )
}

describe("401 from a mutation", () => {
  it("asks to sign in again, then runs the call again", async () => {
    const { client } = await renderShell(<Save />, { role: "user" })
    const user = publicUser(
      db.users.find((u) => u.role === "user" && u.onboardingDone)!
    )
    useMockFetch() // the session cookie is gone
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    expect(
      await screen.findByText("Your session ended. Sign in again to continue.")
    ).toBeTruthy()
    expect(client.getQueryData(keys.me)).toBeNull()
    useMockFetch(user.id) // sign in sets the cookie
    fireEvent.click(screen.getByRole("button", { name: "Buyer" }))
    expect(await screen.findByText("saved")).toBeTruthy()
  })
  it("does not open for a visitor who was never signed in", async () => {
    await renderShell(<Save />)
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    await waitFor(() => expect(screen.getByText("idle")).toBeTruthy())
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("banned account", () => {
  const me = (banned: boolean) => ({
    ...publicUser(db.users.find((u) => u.onboardingDone)!),
    banned,
  })
  const target = (banned: boolean, pathname: string) => {
    try {
      redirectBanned({ me: me(banned), locale: "en", pathname })
    } catch (e) {
      if (isRedirect(e)) return e.options.href
      throw e
    }
  }
  it("is sent to the suspended page from everywhere else", () => {
    expect(target(true, "/en/account")).toBe("/en/suspended")
    expect(target(true, "/ar/vehicles/cars/sale")).toBe("/en/suspended")
  })
  it("may read the suspended and support pages", () => {
    for (const p of ["/en/suspended", "/en/contact", "/ar/terms"])
      expect(target(true, p)).toBeUndefined()
  })
  it("does not touch other accounts", () => {
    expect(target(false, "/en/account")).toBeUndefined()
  })
})
