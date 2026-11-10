import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SocialCallbackPage } from "@/features/auth/components/social-callback-page"
import * as api from "@/lib/api/client"
import { takeSignIn } from "@/lib/sign-in-flag"
import { resetDb, db } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  takeSignIn()
})
afterEach(() => vi.restoreAllMocks())

describe("social callback", () => {
  it("arms the once-per-sign-in reminder only after /me succeeds, then returns to the original page", async () => {
    const { router } = await renderShell(
      <SocialCallbackPage redirect="/en/search?q=toyota&page=2" />,
      { role: "user", path: "/en/auth/callback" }
    )
    await waitFor(() =>
      expect(router.state.location.href).toBe("/en/search?q=toyota&page=2")
    )
    expect(takeSignIn()).toBe(true)
    expect(takeSignIn()).toBe(false)
  })
  it("does not arm reminders for a failed provider callback", async () => {
    await renderShell(
      <SocialCallbackPage error="access_denied" redirect="/en/post" />,
      { role: "user", path: "/en/auth/callback" }
    )
    expect(
      screen.getByText(
        "Social sign-in did not finish. Try again or use your email and password."
      )
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Back to log in" }).getAttribute("href")
    ).toBe("/en/auth/login?redirect=%2Fen%2Fpost")
    expect(takeSignIn()).toBe(false)
  })
  it("returns a callback without a session to login, without marking a successful sign-in", async () => {
    const { router } = await renderShell(<SocialCallbackPage />, {
      path: "/en/auth/callback",
    })
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/en/auth/login?error=oauth_failed"
      )
    )
    expect(takeSignIn()).toBe(false)
  })
  it("retries a failed /me read without restarting the provider redirect", async () => {
    const read = vi
      .spyOn(api, "apiFetch")
      .mockRejectedValueOnce(new api.ApiError(503, "server_error"))
    const { router } = await renderShell(<SocialCallbackPage />, {
      role: "user",
      path: "/en/auth/callback",
    })
    await screen.findByText(
      "Sign-in succeeded, but we could not load your account. Try again without re-entering your code."
    )
    expect(takeSignIn()).toBe(false)
    expect(router.state.location.pathname).toBe("/en/auth/callback")
    read.mockRestore()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/account")
    )
    expect(takeSignIn()).toBe(true)
  })
  it("sends a new social account through onboarding, retaining a safe return path", async () => {
    const user = publicUser(
      db.users.find((u) => u.role === "user" && u.onboardingDone)!
    )
    vi.spyOn(api, "apiFetch").mockResolvedValueOnce({
      ...user,
      onboardingDone: false,
    })
    const { router } = await renderShell(
      <SocialCallbackPage redirect="/ar/post" />,
      { role: "user", locale: "ar", path: "/ar/auth/callback" }
    )
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        "/ar/onboarding/role?redirect=%2Far%2Fpost"
      )
    )
    expect(takeSignIn()).toBe(true)
  })
})
