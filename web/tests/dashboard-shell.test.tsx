import { existsSync } from "node:fs"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { isRedirect } from "@tanstack/react-router"
import { beforeEach, describe, expect, it } from "vitest"

import { keys } from "@/lib/api/query-keys"
import { dashboardPath } from "@/lib/navigation"
import { requireRole } from "@/features/auth/guards"
import { DashboardLayout } from "@/features/dashboard/components/dashboard-layout"
import { DashboardNotFound } from "@/features/dashboard/components/dashboard-not-found"
import { SidebarProvider } from "@/components/ui/sidebar"
import { DashboardTopbar } from "@/features/dashboard/components/dashboard-topbar"
import {
  PageTitleProvider,
  usePageTitle,
} from "@/features/dashboard/components/page-title"
import { navConfig } from "@/features/dashboard/nav-config"
import { db, resetDb } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}

beforeEach(() => {
  resetDb()
  document.cookie = "sidebar_state=; Path=/; Max-Age=0"
})

const sidebarLinks = () =>
  Array.from(
    document.querySelectorAll<HTMLAnchorElement>("[data-sidebar=menu-button]")
  )

describe("dashboard shell", () => {
  it.each([
    ["user", "/en/account", "/en/account/listings"],
    ["dealership", "/en/dealer", "/en/dealer/inventory"],
    ["workshop", "/en/workshop", "/en/workshop/services"],
    ["mechanic", "/en/mechanic", "/en/mechanic/portfolio"],
    ["admin", "/en/admin", "/en/admin/moderation"],
  ] as const)("%s gets its own nav", async (role, path, sample) => {
    await renderShell(<DashboardLayout />, { role, path })
    const hrefs = sidebarLinks().map((a) => a.getAttribute("href"))
    expect(hrefs).toContain(sample)
    for (const item of navConfig[role].flatMap((g) => g.items))
      expect(hrefs).toContain(`${path}${item.path}`)
    expect(
      sidebarLinks().filter((a) => a.getAttribute("aria-current") === "page")
    ).toHaveLength(1)
    expect(document.querySelector("main#main-content")).toBeTruthy()
  })

  it("marks the item whose page is open, also on a sub page", async () => {
    await renderShell(<DashboardLayout />, {
      role: "dealership",
      path: "/en/dealer/inventory/new",
    })
    const current = sidebarLinks().filter(
      (a) => a.getAttribute("aria-current") === "page"
    )
    expect(current.map((a) => a.getAttribute("href"))).toEqual([
      "/en/dealer/inventory",
    ])
  })

  it("groups the admin nav and links with the Arabic prefix", async () => {
    await renderShell(<DashboardLayout />, {
      role: "admin",
      path: "/ar/admin/payments",
      locale: "ar",
    })
    expect(screen.getByText("المراجعة")).toBeTruthy()
    expect(
      sidebarLinks().some(
        (a) => a.getAttribute("href") === "/ar/admin/payments"
      )
    ).toBe(true)
  })

  it("shows live counts in the link name", async () => {
    const { client } = await renderShell(<DashboardLayout />, {
      role: "user",
      path: "/en/account",
    })
    await waitFor(() =>
      expect(client.getQueryState(keys.counts)?.status).toBe("success")
    )
    client.setQueryData(keys.counts, {
      unreadMessages: 3,
      unreadNotifications: 0,
    })
    await screen.findByRole("link", { name: "Messages, 3 new" })
    expect(screen.queryByRole("link", { name: /^Notifications, / })).toBeNull()
  })

  it("collapses to icons and keeps the choice in a cookie", async () => {
    await renderShell(<DashboardLayout />, {
      role: "user",
      path: "/en/account",
    })
    const trigger = screen.getByRole("button", {
      name: "Show or hide the menu",
    })
    fireEvent.click(trigger)
    expect(document.cookie).toContain("sidebar_state=false")
    expect(
      document.querySelector("[data-slot=sidebar]")?.getAttribute("data-state")
    ).toBe("collapsed")
  })

  it("starts collapsed when the cookie says so", async () => {
    document.cookie = "sidebar_state=false; Path=/"
    await renderShell(<DashboardLayout />, {
      role: "user",
      path: "/en/account",
    })
    expect(
      document.querySelector("[data-slot=sidebar]")?.getAttribute("data-state")
    ).toBe("collapsed")
  })

  it("shows the page title set by the page in the topbar", async () => {
    function Page() {
      usePageTitle("Inventory")
      return null
    }
    await renderShell(
      <PageTitleProvider>
        <SidebarProvider>
          <DashboardTopbar role="user" />
          <Page />
        </SidebarProvider>
      </PageTitleProvider>,
      { role: "user", path: "/en/account" }
    )
    expect(screen.getByText("Inventory")).toBeTruthy()
  })

  it("sign out returns to the public home", async () => {
    const { router } = await renderShell(<DashboardLayout />, {
      role: "user",
      path: "/en/account",
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
    await waitFor(() => expect(router.history.location.pathname).toBe("/en"))
  })
})

describe("command menu", () => {
  it("opens with Ctrl+K and navigates to a page", async () => {
    const { router } = await renderShell(<DashboardLayout />, {
      role: "dealership",
      path: "/en/dealer",
    })
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const input = await screen.findByPlaceholderText("Search pages and actions")
    fireEvent.change(input, { target: { value: "analytics" } })
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).queryByText("Inventory")).toBeNull()
    fireEvent.click(within(dialog).getByText("Analytics"))
    await waitFor(() =>
      expect(router.history.location.pathname).toBe("/en/dealer/analytics")
    )
  })

  it("offers Post a listing to people who can post", async () => {
    await renderShell(<DashboardLayout />, {
      role: "user",
      path: "/en/account",
    })
    fireEvent.click(screen.getByRole("button", { name: /Search pages/ }))
    expect(await screen.findByText("Post a listing")).toBeTruthy()
  })

  it("lets the admin search users and opens the matching screen", async () => {
    const { router } = await renderShell(<DashboardLayout />, {
      role: "admin",
      path: "/en/admin",
    })
    const target = db.users.find((u) => u.role === "user")
    if (!target) throw new Error("seed has no user")
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const input = await screen.findByPlaceholderText("Search pages and actions")
    fireEvent.change(input, { target: { value: target.fullName } })
    const dialog = screen.getByRole("dialog")
    const users = await within(dialog).findByRole("group", { name: "Users" })
    const hit = within(users).getByText(target.fullName)
    fireEvent.click(hit)
    await waitFor(() =>
      expect(router.history.location.pathname).toBe("/en/admin/users")
    )
  })
})

describe("requireRole", () => {
  const guard = (done: boolean) => ({
    context: {
      me: publicUser({
        ...db.users.find((u) => u.role === "dealership" && u.onboardingDone)!,
        onboardingDone: done,
      }),
      locale: "en" as const,
    },
    location: { href: "/en/dealer?x=1" },
  })
  it("sends an unfinished account to onboarding and back", () => {
    try {
      requireRole("dealership")(guard(false))
      throw new Error("no redirect")
    } catch (e) {
      if (!isRedirect(e)) throw e
      expect(e.options.href).toBe(
        "/en/onboarding/role?redirect=%2Fen%2Fdealer%3Fx%3D1"
      )
    }
  })
  it("sends another role to its own dashboard", () => {
    try {
      requireRole("user")(guard(true))
      throw new Error("no redirect")
    } catch (e) {
      if (!isRedirect(e)) throw e
      expect(e.options.href).toBe("/en/dealer")
    }
  })
})

describe("dashboard not found", () => {
  it("names the problem and links back to the overview of the role", async () => {
    await renderShell(<DashboardNotFound />, {
      role: "user",
      path: "/en/account/nope",
    })
    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" })
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Back to overview" })
        .getAttribute("href")
    ).toBe("/en/account")
  })
})

describe("workshop routes", () => {
  it("every sidebar link and the not-found splat have a route file", () => {
    const base = "src/routes/$locale/workshop"
    for (const { path } of navConfig.workshop.flatMap((g) => g.items)) {
      const dir = `${base}${path}`
      expect(
        existsSync(`${dir}.tsx`) || existsSync(`${dir}/index.tsx`),
        path
      ).toBe(true)
    }
    expect(existsSync(`${base}/$.tsx`)).toBe(true)
  })
  it("sends a dealership away from /workshop to its own dashboard", () => {
    const dealer = db.users.find(
      (u) => u.role === "dealership" && u.onboardingDone
    )!
    try {
      requireRole("workshop")({
        context: { me: publicUser(dealer), locale: "en" as const },
        location: { href: "/en/workshop/services" },
      })
      throw new Error("no redirect")
    } catch (e) {
      if (!isRedirect(e)) throw e
      expect(e.options.href).toBe("/en/dealer")
    }
  })
})

describe("mechanic routes", () => {
  it("every sidebar link and the not-found splat have a route file", () => {
    const base = "src/routes/$locale/mechanic"
    for (const { path } of navConfig.mechanic.flatMap((g) => g.items)) {
      const dir = `${base}${path}`
      expect(
        existsSync(`${dir}.tsx`) || existsSync(`${dir}/index.tsx`),
        path
      ).toBe(true)
    }
    expect(existsSync(`${base}/$.tsx`)).toBe(true)
  })
  it("sends a workshop away from /mechanic to its own dashboard", () => {
    const workshop = db.users.find(
      (u) => u.role === "workshop" && u.onboardingDone
    )!
    try {
      requireRole("mechanic")({
        context: { me: publicUser(workshop), locale: "en" as const },
        location: { href: "/en/mechanic/portfolio" },
      })
      throw new Error("no redirect")
    } catch (e) {
      if (!isRedirect(e)) throw e
      expect(e.options.href).toBe("/en/workshop")
    }
  })
})

describe("admin routes", () => {
  it("every sidebar link, the account page and the not-found splat have a route file", () => {
    const base = "src/routes/$locale/admin"
    for (const { path } of navConfig.admin.flatMap((g) => g.items)) {
      const dir = `${base}${path}`
      expect(
        existsSync(`${dir}.tsx`) || existsSync(`${dir}/index.tsx`),
        path
      ).toBe(true)
    }
    expect(existsSync(`${base}/account.tsx`)).toBe(true)
    expect(existsSync(`${base}/$.tsx`)).toBe(true)
  })
  it.each(["user", "dealership", "workshop", "mechanic"] as const)(
    "sends a %s away from /admin to its own dashboard",
    (role) => {
      const row = db.users.find((u) => u.role === role && u.onboardingDone)!
      try {
        requireRole("admin")({
          context: { me: publicUser(row), locale: "en" as const },
          location: { href: "/en/admin/users" },
        })
        throw new Error("no redirect")
      } catch (e) {
        if (!isRedirect(e)) throw e
        expect(e.options.href).toBe(`/en${dashboardPath(role)}`)
      }
    }
  )
})
