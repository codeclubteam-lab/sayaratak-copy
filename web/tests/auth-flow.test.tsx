import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authGate, closeAuthGate } from "@/features/auth/auth-gate"
import { AuthDialog } from "@/features/auth/components/auth-dialog"
import { ForgotFlow } from "@/features/auth/components/forgot-flow"
import { LoginForm } from "@/features/auth/components/login-form"
import { SignupFlow } from "@/features/auth/components/signup-flow"
import { redirectSearch, signInDestination } from "@/features/auth/destination"
import { publicUser } from "@/mocks/lib"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"
import { AUTH_TEST_CODE, authClient } from "./auth-client-fake"

// input-otp measures the page for its caret; jsdom has no layout.
document.elementFromPoint = () => null

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const emailedCode = async () => {
  await screen.findByLabelText("Verification code")
  expect(screen.queryByText(/Your code:/)).toBeNull()
  return AUTH_TEST_CODE
}
const enterCode = (code: string) =>
  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: code },
  })

describe("signInDestination", () => {
  const user = (onboardingDone: boolean) => ({
    ...publicUser(
      db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
    ),
    onboardingDone,
  })
  it("a new account does role selection first and keeps the redirect for the end", () => {
    expect(signInDestination(user(false), "/en/post", "en")).toBe(
      "/en/onboarding/role?redirect=%2Fen%2Fpost"
    )
  })
  it("prefers redirect, then the dashboard, then role selection", () => {
    expect(signInDestination(user(true), "/ar/post", "en")).toBe("/en/post")
    expect(signInDestination(user(true), undefined, "en")).toBe("/en/dealer")
    expect(signInDestination(user(false), undefined, "en")).toBe(
      "/en/onboarding/role"
    )
  })
  it("ignores an unsafe redirect param", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\t/evil.com"])
      expect(redirectSearch.parse({ redirect: bad }).redirect).toBeUndefined()
    expect(redirectSearch.parse({ redirect: "/en/post" }).redirect).toBe(
      "/en/post"
    )
  })
})

beforeEach(() => {
  resetDb()
  vi.stubEnv("VITE_DEMO", "true")
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal("innerWidth", 1280)
})
afterEach(() => {
  closeAuthGate()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("LoginForm", () => {
  it("logs in with email and password", async () => {
    const onDone = vi.fn()
    await renderShell(<LoginForm onDone={onDone} />)
    type("Email", "dealer@demo.sy")
    type("Password", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it("stays quiet when an empty field loses focus, and flags it on submit", async () => {
    await renderShell(<LoginForm onDone={vi.fn()} />)
    const email = screen.getByLabelText("Email")
    fireEvent.focus(email)
    fireEvent.blur(email)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText("Enter a valid email address")).toBeNull()
    expect(email.getAttribute("aria-invalid")).not.toBe("true")
    type("Email", "abc")
    fireEvent.blur(email)
    expect(await screen.findByText("Enter a valid email address")).toBeTruthy()
    type("Email", "")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByText("Enter a valid email address")).toBeTruthy()
  })

  it("hides demo shortcuts when VITE_DEMO is off", async () => {
    vi.stubEnv("VITE_DEMO", "false")
    await renderShell(<LoginForm onDone={vi.fn()} />)
    expect(screen.queryByText("Demo accounts")).toBeNull()
  })

  it("says so on a wrong password, clears password, and links to sign up and forgot", async () => {
    await renderShell(<LoginForm onDone={vi.fn()} redirect="/en/post" />)
    type("Email", "dealer@demo.sy")
    type("Password", "wrong1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(
      await screen.findByText("The phone, email or password is not correct")
    ).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe("")
    expect(
      screen.getByRole("link", { name: "Create account" }).getAttribute("href")
    ).toBe("/en/auth/signup?redirect=%2Fen%2Fpost")
    expect(
      screen
        .getByRole("link", { name: "Forgot password?" })
        .getAttribute("href")
    ).toBe("/en/auth/forgot")
  })

  it("shows suspension support link, unverified-email guidance, and rate-limit lockout", async () => {
    const dealer = db.users.find((u) => u.email === "dealer@demo.sy")!
    dealer.banned = true
    await renderShell(<LoginForm onDone={vi.fn()} />)
    type("Email", "dealer@demo.sy")
    type("Password", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByText(/This account is suspended\./)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Contact support" }).getAttribute("href")
    ).toBe("/en/contact")

    dealer.banned = false
    dealer.verifiedEmail = false
    type("Password", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(
      await screen.findByText(
        "Verify your email before logging in. Sign up again to get a new code."
      )
    ).toBeTruthy()

    authClient.signIn.email.mockResolvedValueOnce({
      data: null,
      error: {
        status: 429,
        code: "ACCOUNT_TEMPORARILY_LOCKED",
        retryAfter: 35,
      },
    })
    type("Password", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(
      await screen.findByText("Too many attempts. Try again in 35 seconds.")
    ).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>("Password").disabled).toBe(
      true
    )
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Log in" }).disabled
    ).toBe(true)
  })

  it("retries /me without re-authenticating on LoginForm and clears password on Back", async () => {
    const onDone = vi.fn()
    await renderShell(<LoginForm onDone={onDone} />)
    const realFetch = globalThis.fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/api/v1/me")
        ? Promise.resolve(
            Response.json({ code: "server_error" }, { status: 503 })
          )
        : realFetch(input, init)
    )
    type("Email", "dealer@demo.sy")
    type("Password", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    await screen.findByText(
      "Sign-in succeeded, but we could not load your account. Try again without re-entering your code."
    )
    expect(authClient.signIn.email).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()

    vi.stubGlobal("fetch", realFetch)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(authClient.signIn.email).toHaveBeenCalledOnce()

    cleanup()
    await renderShell(<LoginForm onDone={vi.fn()} />)
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/api/v1/me")
        ? Promise.resolve(
            Response.json({ code: "server_error" }, { status: 503 })
          )
        : realFetch(input, init)
    )
    type("Email", "user@demo.sy")
    type("Password", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    await screen.findByText(
      "Sign-in succeeded, but we could not load your account. Try again without re-entering your code."
    )
    fireEvent.click(screen.getByRole("button", { name: "Back to log in" }))
    expect(
      (await screen.findByLabelText<HTMLInputElement>("Password")).value
    ).toBe("")
  })
})

describe("SignupFlow", () => {
  const fill = (email = "new.person@example.com") => {
    type("Full name", "New Person")
    type("Email", email)
    type("Password", "Passw0rd1")
    type("Confirm password", "Passw0rd1")
  }

  it("needs matching passwords and the terms", async () => {
    await renderShell(<SignupFlow onDone={vi.fn()} />)
    fill()
    type("Confirm password", "Passw0rd2")
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    expect(await screen.findByText("The passwords do not match")).toBeTruthy()
    expect(screen.getByText("Accept the terms to continue")).toBeTruthy()
  })

  it("suggests a strong password, fills both fields and shows it", async () => {
    await renderShell(<SignupFlow onDone={vi.fn()} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest a strong password" })
    )
    const pw = screen.getByLabelText<HTMLInputElement>("Password")
    const confirm = screen.getByLabelText<HTMLInputElement>("Confirm password")
    await waitFor(() => expect(pw.value).toHaveLength(16))
    expect(confirm.value).toBe(pw.value)
    expect(pw.type).toBe("text")
    expect(confirm.type).toBe("text")
    expect(await screen.findByText("Strong")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Copy password" })).toBeTruthy()
  })

  it("creates an unverified account, signs in only after the code, then shows Email verified", async () => {
    const onDone = vi.fn()
    await renderShell(<SignupFlow onDone={onDone} />)
    fill()
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    const code = await emailedCode()
    expect(screen.getByText("new.person@example.com")).toBeTruthy()
    expect(
      db.users.find((u) => u.email === "new.person@example.com")?.verifiedEmail
    ).toBe(false)
    expect(document.cookie).not.toContain("sy_session=")
    enterCode(code)
    expect(
      await screen.findByRole("heading", { name: "Email verified" })
    ).toBeTruthy()
    expect(
      db.users.find((u) => u.email === "new.person@example.com")?.verifiedEmail
    ).toBe(true)
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it("clears a wrong code and keeps the form when changing the email", async () => {
    await renderShell(<SignupFlow onDone={vi.fn()} />)
    fill()
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    const code = await emailedCode()
    enterCode(code === "000000" ? "111111" : "000000")
    expect(await screen.findByText("The code is not correct")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Change email" }))
    expect(screen.getByLabelText<HTMLInputElement>("Full name").value).toBe(
      "New Person"
    )
  })
  it("retries /me without consuming the sign-up code twice", async () => {
    await renderShell(<SignupFlow onDone={vi.fn()} />)
    fill()
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    const code = await emailedCode()
    const fetch = globalThis.fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/api/v1/me")
        ? Promise.resolve(
            Response.json({ code: "server_error" }, { status: 503 })
          )
        : fetch(input, init)
    )
    enterCode(code)
    await screen.findByText(
      "Sign-in succeeded, but we could not load your account. Try again without re-entering your code."
    )
    vi.stubGlobal("fetch", fetch)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("heading", { name: "Email verified" })
    ).toBeTruthy()
    expect(authClient.emailOtp.verifyEmail).toHaveBeenCalledOnce()
  })

  it("refuses an email that already has an account", async () => {
    await renderShell(<SignupFlow onDone={vi.fn()} />)
    fill("dealer@demo.sy")
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    expect(
      await screen.findByText(
        "An account with this email already exists. Log in instead."
      )
    ).toBeTruthy()
  })

  it("shows expired code and resends after cooldown ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await renderShell(<SignupFlow onDone={vi.fn()} />)
      fill()
      fireEvent.click(screen.getByRole("checkbox"))
      fireEvent.click(screen.getByRole("button", { name: "Create account" }))
      await emailedCode()
      authClient.emailOtp.verifyEmail.mockResolvedValueOnce({
        data: null,
        error: { status: 400, code: "OTP_EXPIRED", retryAfter: undefined },
      })
      enterCode("111111")
      expect(
        await screen.findByText("This code has expired. Send a new code.")
      ).toBeTruthy()
      expect(
        screen.getByRole<HTMLButtonElement>("button", {
          name: /Send a new code in/,
        }).disabled
      ).toBe(true)
      for (let i = 0; i < 30; i++)
        await act(() => vi.advanceTimersByTimeAsync(1000))
      fireEvent.click(screen.getByRole("button", { name: "Send a new code" }))
      await waitFor(() =>
        expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
          email: "new.person@example.com",
          type: "email-verification",
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("ForgotFlow", () => {
  it("resets the password with the emailed code", async () => {
    const dealer = db.users.find((u) => u.email === "dealer@demo.sy")!
    await renderShell(<ForgotFlow />)
    type("Email", "dealer@demo.sy")
    fireEvent.click(screen.getByRole("button", { name: "Send code" }))
    enterCode(await emailedCode())
    await screen.findByRole("heading", { name: "Choose a new password" })
    type("New password", "Newpass123")
    type("Confirm password", "Newpass123")
    fireEvent.click(screen.getByRole("button", { name: "Save password" }))
    expect(
      await screen.findByRole("heading", { name: "Password changed" })
    ).toBeTruthy()
    expect(dealer.password).toBe("Newpass123")
    expect(authClient.emailOtp.resetPassword).toHaveBeenCalledWith({
      email: "dealer@demo.sy",
      otp: AUTH_TEST_CODE,
      password: "Newpass123",
    })
    expect(
      screen.getByRole("link", { name: "Log in" }).getAttribute("href")
    ).toBe("/en/auth/login")
  })

  it("handles a wrong reset code, stays generic for unknown emails, and restarts when the reset code expires", async () => {
    await renderShell(<ForgotFlow />)
    type("Email", "nobody@example.com")
    fireEvent.click(screen.getByRole("button", { name: "Send code" }))
    await emailedCode()
    enterCode("000000")
    expect(await screen.findByText("The code is not correct")).toBeTruthy()
    enterCode(AUTH_TEST_CODE)
    await screen.findByRole("heading", { name: "Choose a new password" })
    authClient.emailOtp.resetPassword.mockResolvedValueOnce({
      data: null,
      error: { status: 400, code: "OTP_EXPIRED", retryAfter: undefined },
    })
    type("New password", "Newpass123")
    type("Confirm password", "Newpass123")
    fireEvent.click(screen.getByRole("button", { name: "Save password" }))
    expect(
      await screen.findByRole("heading", { name: "Reset your password" })
    ).toBeTruthy()
  })
})

describe("AuthDialog", () => {
  it("shows the gate reason and returns focus to the trigger on close", async () => {
    await renderShell(
      <>
        <button
          onClick={() =>
            authGate.setState(() => ({
              open: true,
              reason: "auth.reason_message",
              pending: null,
            }))
          }
        >
          trigger
        </button>
        <AuthDialog />
      </>
    )
    const trigger = screen.getByRole("button", { name: "trigger" })
    trigger.focus()
    fireEvent.click(trigger)
    expect(await screen.findByRole("dialog", { name: "Log in" })).toBeTruthy()
    expect(screen.getByText("Sign in to send a message")).toBeTruthy()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it("swaps to sign up in place", async () => {
    await renderShell(<AuthDialog />)
    authGate.setState(() => ({ open: true, pending: null }))
    await screen.findByRole("dialog", { name: "Log in" })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    expect(
      await screen.findByRole("dialog", { name: "Create your account" })
    ).toBeTruthy()
  })
})
