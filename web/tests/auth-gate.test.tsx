import { useState } from "react"
import { isRedirect } from "@tanstack/react-router"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthDialog } from "@/features/auth/components/auth-dialog"
import { closeAuthGate, useRequireAuth } from "@/features/auth/auth-gate"
import { requireRole, requireUser } from "@/features/auth/guards"
import { publicUser } from "@/mocks/lib"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

function stubViewport(mobile: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal("innerWidth", mobile ? 390 : 1280)
}

function Demo() {
  const requireAuth = useRequireAuth()
  const [runs, setRuns] = useState(0)
  return (
    <>
      <button onClick={() => requireAuth(() => setRuns((n) => n + 1))}>
        gated
      </button>
      <output>runs {runs}</output>
      <AuthDialog />
    </>
  )
}

beforeEach(() => {
  resetDb()
  vi.stubEnv("VITE_DEMO", "true")
  stubViewport(false)
})
afterEach(() => {
  closeAuthGate()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("auth dialog", () => {
  it("opens for a signed-out visitor and replays the action after sign in", async () => {
    await renderShell(<Demo />)
    fireEvent.click(screen.getByRole("button", { name: "gated" }))
    expect(screen.getByRole("dialog", { name: "Log in" })).toBeTruthy()
    expect(screen.getByText("runs 0")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Buyer" }))
    expect(await screen.findByText("runs 1")).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("closes on Escape without running the action", async () => {
    await renderShell(<Demo />)
    fireEvent.click(screen.getByRole("button", { name: "gated" }))
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByText("runs 0")).toBeTruthy()
  })

  it("runs the action at once when signed in", async () => {
    await renderShell(<Demo />, { role: "user" })
    fireEvent.click(screen.getByRole("button", { name: "gated" }))
    expect(screen.getByText("runs 1")).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("is a bottom sheet below md", async () => {
    stubViewport(true)
    await renderShell(<Demo />)
    fireEvent.click(screen.getByRole("button", { name: "gated" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog.getAttribute("data-slot")).toBe("sheet-content")
    expect(dialog.getAttribute("data-side")).toBe("bottom")
  })
})

describe("route guards", () => {
  const user = (role: string) =>
    publicUser(db.users.find((u) => u.role === role && u.onboardingDone)!)
  const guard = (me: ReturnType<typeof user> | null) => ({
    context: { me, locale: "en" as const },
    location: { href: "/en/account?tab=x" },
  })
  const redirectOf = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      if (isRedirect(e)) return e.options.href
      throw e
    }
  }

  it("requireUser sends signed-out visitors to sign in with a return path", () => {
    expect(redirectOf(() => requireUser(guard(null)))).toBe(
      "/en/auth/login?redirect=%2Fen%2Faccount%3Ftab%3Dx"
    )
    expect(requireUser(guard(user("user"))).role).toBe("user")
  })

  it("requireRole sends another role to its own dashboard", () => {
    expect(redirectOf(() => requireRole("admin")(guard(null)))).toContain(
      "/en/auth/login?redirect="
    )
    expect(
      redirectOf(() => requireRole("admin")(guard(user("dealership"))))
    ).toBe("/en/dealer")
    expect(redirectOf(() => requireRole("admin")(guard(user("admin"))))).toBe(
      undefined
    )
  })
})
