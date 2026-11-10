import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DevPanelHost } from "@/components/app/dev-panel-host"
import { authGate, closeAuthGate } from "@/features/auth/auth-gate"
import {
  getFailMode,
  getLatency,
  setFailMode,
  setLatency,
} from "@/lib/api/dev-flags"
import { resetDb } from "@/mocks/db"
import { useMockFetch } from "./mock-fetch"
import { pick } from "./pick"

const invalidate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }))

const open = () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DevPanelHost />
    </QueryClientProvider>
  )
  fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true })
}

beforeEach(() => {
  resetDb()
  closeAuthGate()
  invalidate.mockClear()
  setFailMode("none")
  setLatency(null)
  useMockFetch()
})

describe("dev panel", () => {
  it("opens with Ctrl+Shift+D and closes with it again", async () => {
    open()
    // The first open compiles the lazy module while other test files run.
    expect(
      await screen.findByLabelText("Dev panel", undefined, { timeout: 5000 })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Expire session/ })).toBeNull()
    expect(
      screen.queryByRole("button", { name: /Ban signed-in account/ })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Reset data" })).toBeNull()
    fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true })
    expect(screen.queryByLabelText("Dev panel")).toBeNull()
  })
  it("failure selector sets the cookie the mock router reads and re-runs loaders", async () => {
    open()
    await pick(await screen.findByLabelText("Failure"), "500")
    expect(getFailMode()).toBe("500")
    expect(invalidate).toHaveBeenCalled()
    expect(
      (await fetch("/api/taxonomy", { headers: { cookie: document.cookie } }))
        .status
    ).toBe(500)
  })
  it("latency slider stores milliseconds and the default button clears it", async () => {
    open()
    fireEvent.change(await screen.findByLabelText(/Latency/), {
      target: { value: "1500" },
    })
    expect(getLatency()).toBe(1500)
    fireEvent.click(screen.getByText("Use default"))
    expect(getLatency()).toBeNull()
  })
  it("switches the signed-in account", async () => {
    open()
    await pick(await screen.findByLabelText(/Signed in as/), "Dealership")
    await waitFor(() => expect(invalidate).toHaveBeenCalled())
  })
  it("opens the full login flow for admin instead of skipping its email code", async () => {
    open()
    await pick(await screen.findByLabelText(/Signed in as/), "Admin")
    await waitFor(() => expect(authGate.state.open).toBe(true))
  })
})
