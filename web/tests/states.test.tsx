import { act, fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
} from "@tanstack/react-router"
import { I18nextProvider } from "react-i18next"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NotFound } from "@/components/app/not-found"
import { OfflineBanner } from "@/components/app/offline-banner"
import { PageSkeleton } from "@/components/app/page-skeleton"
import { RouteError } from "@/components/app/route-error"
import { siteQuery } from "@/features/pages/queries"
import { ApiError } from "@/lib/api/client"
import { setFailMode } from "@/lib/api/dev-flags"
import { createI18n } from "@/lib/i18n/create"
import enCommon from "@/messages/en/common.json"
import enError from "@/messages/en/error.json"
import { resetDb } from "@/mocks/db"
import { useMockFetch } from "./mock-fetch"
import { renderShell } from "./shell-render"

const errorProps = (error: Error) => ({
  error,
  reset: () => {},
  info: undefined,
})

afterEach(() => {
  setFailMode("none")
  vi.unstubAllGlobals()
})

describe("state pages", () => {
  it("not found links to search and home in the active locale", async () => {
    await renderShell(<NotFound />, { locale: "ar" })
    expect(
      screen.getByRole("heading", { name: "الصفحة غير موجودة" })
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "البحث في الإعلانات" })
        .getAttribute("href")
    ).toBe("/ar/search")
    expect(
      screen
        .getByRole("link", { name: "العودة إلى الرئيسية" })
        .getAttribute("href")
    ).toBe("/ar")
  })

  it("route error retries by invalidating the router", async () => {
    const { router } = await renderShell(
      <RouteError {...errorProps(new ApiError(500, "server_error"))} />
    )
    const invalidate = vi.spyOn(router, "invalidate")
    expect(screen.getByRole("alert")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(invalidate).toHaveBeenCalled()
  })

  it("route error maps 404 to not found and 403 to forbidden", async () => {
    const first = await renderShell(
      <RouteError {...errorProps(new ApiError(404, "not_found"))} />
    )
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy()
    first.unmount()
    await renderShell(
      <RouteError {...errorProps(new ApiError(403, "forbidden"))} />
    )
    expect(
      screen.getByRole("heading", {
        name: "You do not have access to this page",
      })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
  })

  it("offline banner appears and clears with the connection", async () => {
    await renderShell(<OfflineBanner />)
    expect(screen.queryByRole("status")).toBeNull()
    vi.stubGlobal("navigator", { onLine: false })
    act(() => window.dispatchEvent(new Event("offline")))
    expect(screen.getByRole("status").textContent).toContain("offline")
    vi.stubGlobal("navigator", { onLine: true })
    act(() => window.dispatchEvent(new Event("online")))
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("skeleton variants render a labelled busy region", async () => {
    for (const variant of ["grid", "detail", "table"] as const) {
      const { unmount } = await renderShell(<PageSkeleton variant={variant} />)
      expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true")
      expect(screen.getByText("Loading")).toBeTruthy()
      unmount()
    }
  })

  it("router defaults: an injected 500 shows the retry state, retry recovers, a missing item shows not found", async () => {
    resetDb()
    useMockFetch()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const i18n = createI18n("en", { common: enCommon, error: enError })
    const root = createRootRoute({
      component: () => (
        <QueryClientProvider client={client}>
          <I18nextProvider i18n={i18n}>
            <Outlet />
          </I18nextProvider>
        </QueryClientProvider>
      ),
    })
    const page = createRoute({
      getParentRoute: () => root,
      path: "/page",
      loader: () => client.fetchQuery(siteQuery),
      component: () => <p>loaded</p>,
    })
    const missing = createRoute({
      getParentRoute: () => root,
      path: "/missing",
      loader: () => {
        throw notFound()
      },
    })
    const router = createRouter({
      routeTree: root.addChildren([page, missing]),
      history: createMemoryHistory({ initialEntries: ["/page"] }),
      defaultNotFoundComponent: NotFound,
      defaultErrorComponent: RouteError,
    })
    setFailMode("500")
    await router.load()
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole("alert")).toBeTruthy()
    setFailMode("none")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("loaded")).toBeTruthy()
    await act(() => router.navigate({ href: "/missing" }))
    expect(
      await screen.findByRole("link", { name: "Search listings" })
    ).toBeTruthy()
  })
})
