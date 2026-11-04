import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { lazyRouteComponent } from "@tanstack/react-router"
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useApiMutation } from "@/lib/api/mutation"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { createI18n } from "@/lib/i18n/create"
import { useT } from "@/lib/i18n/use-t"
import { withProps } from "@/lib/lazy-page"
import { NowProvider, useNow } from "@/lib/now"
import { usePrefs, useSetPrefs } from "@/lib/prefs"
import { useCountdown } from "@/lib/use-countdown"
import { usePageUrl } from "@/lib/use-page-url"
import { renderShell } from "./shell-render"

afterEach(() => vi.useRealTimers())

it("useCountdown ticks down to zero and can restart", () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useCountdown(2))
  act(() => void vi.advanceTimersByTime(1000))
  expect(result.current[0]).toBe(1)
  act(() => void vi.advanceTimersByTime(5000))
  expect(result.current[0]).toBe(0)
  act(() => result.current[1](3))
  expect(result.current[0]).toBe(3)
})

it("usePageUrl reads the address in the browser", () => {
  expect(renderHook(() => usePageUrl()).result.current).toBe(
    window.location.href
  )
})

it("useNow starts on the server clock, then follows the browser's", () => {
  vi.useFakeTimers({ now: 5_000_000 })
  const seen: number[] = []
  function Probe() {
    seen.push(useNow())
    return null
  }
  render(
    <NowProvider serverNow={1000}>
      <Probe />
    </NowProvider>
  )
  expect(seen[0]).toBe(1000)
  expect(seen.at(-1)).toBe(5_000_000)
  act(() => void vi.advanceTimersByTime(60_000))
  expect(seen.at(-1)).toBe(5_060_000)
})

it("useT gives the active locale", () => {
  const wrap = (language: "ar" | "en") =>
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <I18nextProvider i18n={createI18n(language, {})}>
          {children}
        </I18nextProvider>
      )
    }
  expect(
    renderHook(() => useT(), { wrapper: wrap("en") }).result.current.locale
  ).toBe("en")
  expect(
    renderHook(() => useT(), { wrapper: wrap("ar") }).result.current.locale
  ).toBe("ar")
})

it("useSetPrefs updates the context and the cookie the server reads", async () => {
  function Toggle() {
    const { dataSaver } = usePrefs()
    const set = useSetPrefs()
    return (
      <button onClick={() => set({ dataSaver: !dataSaver })}>
        {String(dataSaver)}
      </button>
    )
  }
  await renderShell(<Toggle />)
  fireEvent.click(screen.getByRole("button", { name: "false" }))
  expect(screen.getByRole("button", { name: "true" })).toBeTruthy()
  expect(document.cookie).toContain("data_saver=1")
  expect(document.documentElement.hasAttribute("data-data-saver")).toBe(true)
})

it("useApiMutation invalidates its keys after success", async () => {
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, "invalidateQueries")
  const { result } = renderHook(
    () => useApiMutation(async (n: number) => n * 2, [["a"], ["b"]]),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    }
  )
  await act(() => result.current.mutateAsync(2))
  await waitFor(() => expect(result.current.data).toBe(4))
  expect(spy.mock.calls.map(([f]) => f?.queryKey)).toEqual([["a"], ["b"]])
})

it("withProps binds props and keeps the preload", async () => {
  const Page = lazyRouteComponent(async () => ({
    default: ({ who }: { who: string }) => <p>{who}</p>,
  }))
  const Bound = withProps(Page, { who: "dealer" })
  expect(Bound.preload).toBe(Page.preload)
  await Bound.preload?.()
  render(<Bound />)
  expect(screen.getByText("dealer")).toBeTruthy()
})

describe("focusFirstInvalid", () => {
  it("opens a closed section and focuses the first invalid field once it renders", async () => {
    document.body.innerHTML = `<form><details><summary>More</summary><input id="late" /></details></form>`
    const root = document.querySelector("form")
    focusFirstInvalid(root)
    document.getElementById("late")!.setAttribute("aria-invalid", "true")
    await waitFor(() => expect(document.activeElement?.id).toBe("late"))
    expect(document.querySelector("details")!.open).toBe(true)
  })
})
