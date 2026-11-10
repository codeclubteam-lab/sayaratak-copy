import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "@/features/auth/components/login-form"
import { keys } from "@/lib/api/query-keys"
import { resetDb } from "@/mocks/db"
import { AUTH_TEST_CODE, authClient } from "./auth-client-fake"
import { renderShell } from "./shell-render"

document.elementFromPoint = () => null
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
beforeEach(() => {
  resetDb()
  vi.stubEnv("VITE_DEMO", "true")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function openAdmin() {
  const onDone = vi.fn()
  const view = await renderShell(<LoginForm onDone={onDone} />)
  type("Email", "admin@demo.sy")
  type("Password", "Demo1234")
  fireEvent.click(screen.getByRole("button", { name: "Log in" }))
  await screen.findByRole("heading", { name: "Confirm your admin sign-in" })
  await waitFor(() =>
    expect(authClient.twoFactor.sendOtp).toHaveBeenCalledOnce()
  )
  return { ...view, onDone }
}

describe("admin second step", () => {
  it("does not authenticate or finish before the email code, then reads the shared User", async () => {
    const { client, onDone } = await openAdmin()
    expect(client.getQueryData(keys.me)).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
    expect(authClient.twoFactor.sendOtp).toHaveBeenCalledWith({
      trustDevice: false,
    })
    expect(screen.queryByRole("checkbox")).toBeNull()
    type("Verification code", "000000")
    await screen.findByText("The code is not correct")
    expect(
      screen.getByLabelText<HTMLInputElement>("Verification code").value
    ).toBe("")
    expect(client.getQueryData(keys.me)).toBeNull()
    type("Verification code", AUTH_TEST_CODE)
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(authClient.twoFactor.verifyOtp).toHaveBeenLastCalledWith({
      code: AUTH_TEST_CODE,
      trustDevice: false,
    })
    expect(client.getQueryData(keys.me)).toMatchObject({
      role: "admin",
      hasPassword: true,
      onboardingDone: true,
    })
  })
  it("retries only /me after an accepted, consumed admin code", async () => {
    const { client, onDone } = await openAdmin()
    const fetch = globalThis.fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/api/me")
        ? Promise.resolve(
            Response.json({ code: "server_error" }, { status: 503 })
          )
        : fetch(input, init)
    )
    type("Verification code", AUTH_TEST_CODE)
    expect(
      await screen.findByText(
        "Sign-in succeeded, but we could not load your account. Try again without re-entering your code."
      )
    ).toBeTruthy()
    expect(authClient.twoFactor.verifyOtp).toHaveBeenCalledOnce()
    expect(client.getQueryData(keys.me)).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
    vi.stubGlobal("fetch", fetch)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(client.getQueryData(keys.me)).toMatchObject({ role: "admin" })
    expect(authClient.twoFactor.verifyOtp).toHaveBeenCalledOnce()
  })
  it("locks code entry and resends for a throttled verification", async () => {
    authClient.twoFactor.verifyOtp.mockResolvedValueOnce({
      data: null,
      error: { status: 429, code: "too_many_attempts", retryAfter: 42 },
    })
    const { onDone, client } = await openAdmin()
    type("Verification code", "000000")
    await screen.findByText("Too many attempts. Try again in 42 seconds.")
    expect(
      screen.getByLabelText<HTMLInputElement>("Verification code").disabled
    ).toBe(true)
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Send a new code/ })
        .disabled
    ).toBe(true)
    expect(client.getQueryData(keys.me)).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
  })
  it("shows a failed send, without pretending the admin is signed in", async () => {
    authClient.twoFactor.sendOtp.mockRejectedValueOnce(new TypeError("offline"))
    const { onDone, client } = await openAdmin()
    expect(
      await screen.findByText(
        "Could not send the code. Check your connection and try again."
      )
    ).toBeTruthy()
    expect(client.getQueryData(keys.me)).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Back to log in" }))
    expect(
      await screen.findByLabelText<HTMLInputElement>("Password")
    ).toHaveProperty("value", "")
  })
  it("routes the admin demo shortcut through the same code step", async () => {
    const onDone = vi.fn()
    await renderShell(<LoginForm onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "Admin" }))
    expect(
      await screen.findByRole("heading", { name: "Confirm your admin sign-in" })
    ).toBeTruthy()
    expect(onDone).not.toHaveBeenCalled()
  })
  it("uses Arabic copy with an LTR email and numeric code", async () => {
    await renderShell(<LoginForm onDone={vi.fn()} />, { locale: "ar" })
    type("البريد الإلكتروني", "admin@demo.sy")
    type("كلمة المرور", "Demo1234")
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول" }))
    expect(
      await screen.findByRole("heading", { name: "تأكيد دخول المشرف" })
    ).toBeTruthy()
    expect(screen.getByText("admin@demo.sy").getAttribute("dir")).toBe("ltr")
    expect(screen.getByLabelText("رمز التحقق").getAttribute("inputmode")).toBe(
      "numeric"
    )
  })
})
