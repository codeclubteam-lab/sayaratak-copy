import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RecoveryEmailNotice } from "@/features/auth/components/recovery-email-notice"
import { SocialSignIn } from "@/features/auth/components/social-sign-in"
import { db, resetDb } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"
import { authClient } from "./auth-client-fake"
import { renderShell } from "./shell-render"

beforeEach(resetDb)
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("social redirect", () => {
  it("returns to the gated page including its filters, and hides Facebook when unconfigured", async () => {
    vi.stubEnv("VITE_FEATURE_FACEBOOK", "false")
    await renderShell(<SocialSignIn />, { path: "/en/search?q=toyota&page=2" })
    expect(
      screen.queryByRole("button", { name: "Continue with Facebook" })
    ).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    )
    await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledOnce())
    const body = authClient.signIn.social.mock.lastCall?.[0]
    const url = new URL(body!.callbackURL)
    expect(body?.provider).toBe("google")
    expect(body?.errorCallbackURL).toBe(body?.callbackURL)
    expect(url.pathname).toBe("/en/auth/callback")
    expect(url.searchParams.get("redirect")).toBe("/en/search?q=toyota&page=2")
    expect(screen.queryByRole("dialog")).toBeNull()
  })
  it("preserves a safe page-mode redirect in Arabic when Facebook is enabled", async () => {
    vi.stubEnv("VITE_FEATURE_FACEBOOK", "true")
    await renderShell(<SocialSignIn redirect="/ar/post?step=photos" />, {
      locale: "ar",
      path: "/ar/auth/signup",
    })
    fireEvent.click(
      screen.getByRole("button", { name: "المتابعة باستخدام Facebook" })
    )
    await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledOnce())
    const url = new URL(authClient.signIn.social.mock.lastCall![0].callbackURL)
    expect(url.pathname).toBe("/ar/auth/callback")
    expect(url.searchParams.get("redirect")).toBe("/ar/post?step=photos")
  })
  it("drops an external redirect and reports a provider callback error without raw text", async () => {
    await renderShell(<SocialSignIn redirect="//evil.example" />, {
      path: "/en/auth/login?error=access_denied&error_description=secret-provider-text",
    })
    expect(
      await screen.findByText(
        "Social sign-in did not finish. Try again or use your email and password."
      )
    ).toBeTruthy()
    expect(screen.queryByText("secret-provider-text")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    )
    await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledOnce())
    expect(
      new URL(
        authClient.signIn.social.mock.lastCall![0].callbackURL
      ).searchParams.has("redirect")
    ).toBe(false)
  })
  it("shows a client failure inline", async () => {
    authClient.signIn.social.mockRejectedValueOnce(new TypeError("offline"))
    await renderShell(<SocialSignIn />)
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" })
    )
    expect(await screen.findByRole("alert")).toBeTruthy()
  })
})

describe("Facebook recovery email", () => {
  const user = () =>
    publicUser(db.users.find((u) => u.role === "user" && u.onboardingDone)!)
  it("offers settings for an account without email and can be dismissed", async () => {
    const me = { ...user(), email: undefined }
    await renderShell(<RecoveryEmailNotice me={me} />)
    expect(
      screen.getByText("Add an email to recover your account")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Add an email" }).getAttribute("href")
    ).toBe("/en/account/settings")
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("alert")).toBeNull()
  })
  it("stays hidden when an email exists", async () => {
    await renderShell(<RecoveryEmailNotice me={user()} />)
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
