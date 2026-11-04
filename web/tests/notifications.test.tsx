import { existsSync } from "node:fs"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationBell } from "@/components/app/notification-bell"
import { NotificationsPage } from "@/features/notifications/components/notifications-page"
import {
  notificationsSearchSchema,
  pruneNotificationsSearch,
} from "@/features/notifications/schemas"
import { dashboardPath } from "@/lib/navigation"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  document.cookie = "mock_fail=; Path=/; Max-Age=0"
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const me = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const mine = () => db.notifications.filter((n) => n.userId === me().id)
const unread = () => mine().filter((n) => !n.readAt)

const openPage = (search = "") =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <NotificationsPage />
    </NowProvider>,
    { role: "user", path: `/en/account/notifications${search}` }
  )
const list = () => screen.findByRole("list", { name: "Notifications" })
const rows = async () => within(await list()).getAllByRole("listitem")
// The first unread row that is a link, with the path it should open.
const unreadLink = async () => {
  const row = (await rows()).find(
    (li) => within(li).queryByText("Unread") && within(li).queryByRole("link")
  )!
  return within(row).getByRole("link")
}

describe("search params", () => {
  it("keep only what differs from the defaults", () => {
    expect(
      pruneNotificationsSearch(notificationsSearchSchema.parse({}))
    ).toEqual({})
    expect(
      pruneNotificationsSearch(
        notificationsSearchSchema.parse({ tab: "unread", page: "3" })
      )
    ).toEqual({ tab: "unread", page: 3 })
    expect(notificationsSearchSchema.parse({ tab: "x", page: "0" })).toEqual({
      tab: "all",
      page: 1,
    })
  })
})

describe("NotificationsPage", () => {
  it("lists the notifications, with the unread ones marked in text", async () => {
    await openPage()
    const items = await rows()
    expect(items).toHaveLength(mine().length)
    expect(items.filter((li) => within(li).queryByText("Unread"))).toHaveLength(
      unread().length
    )
  })

  it("the Unread tab shows only unread rows and writes itself to the URL", async () => {
    const { router } = await openPage()
    await list()
    fireEvent.click(screen.getByRole("tab", { name: "Unread" }))
    await waitFor(async () =>
      expect(await rows()).toHaveLength(unread().length)
    )
    expect(router.state.location.search).toMatchObject({ tab: "unread" })
  })

  it("a click marks the row read and opens its page", async () => {
    const { router } = await openPage()
    const before = unread().length
    const link = await unreadLink()
    const target = link.getAttribute("href")!
    fireEvent.click(link)
    await waitFor(() => expect(unread()).toHaveLength(before - 1))
    expect(router.state.location.pathname).toBe(target)
  })

  it("every page a demo buyer's notification opens has a route file", () => {
    const hrefs = [
      ...new Set(
        mine()
          .map((n) => n.href)
          .filter(Boolean)
      ),
    ]
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      const dir = `src/routes/$locale${href!}`
      expect(
        existsSync(`${dir}.tsx`) || existsSync(`${dir}/index.tsx`),
        href
      ).toBe(true)
    }
  })

  it("a notification without a page is not a link", async () => {
    await openPage()
    const row = (await rows()).find((li) =>
      within(li).queryByText("Announcement")
    )!
    expect(within(row).queryByRole("link")).toBeNull()
  })

  it("a read row stays read after the page is opened again", async () => {
    const first = await openPage()
    const before = unread().length
    fireEvent.click(await unreadLink())
    await waitFor(() => expect(unread()).toHaveLength(before - 1))
    first.unmount()
    await openPage()
    const left = (await rows()).filter((li) => within(li).queryByText("Unread"))
    expect(left).toHaveLength(before - 1)
  })

  it("Mark all as read empties the unread tab", async () => {
    await openPage()
    await list()
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }))
    await waitFor(() => expect(unread()).toHaveLength(0))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mark all as read" })
      ).toHaveProperty("disabled", true)
    )
    fireEvent.click(screen.getByRole("tab", { name: "Unread" }))
    expect(await screen.findByText("You are all caught up")).toBeTruthy()
  })

  it("shows an error with Retry when the list fails, and recovers", async () => {
    document.cookie = "mock_fail=500; Path=/"
    await openPage()
    expect(
      await screen.findByText("Could not load your notifications.")
    ).toBeTruthy()
    document.cookie = "mock_fail=; Path=/; Max-Age=0"
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]!)
    expect(await list()).toBeTruthy()
  })
})

// 10.11, 11.11 and 12.10: dealer, workshop and mechanic mount the same page; their rows open their own dashboard pages.
describe.each(["dealership", "workshop", "mechanic"] as const)(
  "%s notifications",
  (role) => {
    const base = dashboardPath(role)
    const owner = () =>
      db.users.find((u) => u.role === role && u.onboardingDone)!
    const theirs = () => db.notifications.filter((n) => n.userId === owner().id)

    it("every page a notification opens is a route of the role's dashboard", () => {
      const hrefs = [
        ...new Set(
          theirs()
            .map((n) => n.href)
            .filter(Boolean)
        ),
      ]
      expect(hrefs.length).toBeGreaterThan(0)
      for (const href of hrefs) {
        expect(href!.startsWith(`${base}/`), href).toBe(true)
        const dir = `src/routes/$locale${href!.split("?")[0]}`
        expect(
          existsSync(`${dir}.tsx`) || existsSync(`${dir}/index.tsx`),
          href
        ).toBe(true)
      }
    })

    it("lists the rows; a click marks one read and opens its page", async () => {
      const { router } = await renderShell(
        <NowProvider serverNow={Date.now()}>
          <NotificationsPage />
        </NowProvider>,
        { role, path: `/en${base}/notifications` }
      )
      expect(await rows()).toHaveLength(theirs().length)
      const before = theirs().filter((n) => !n.readAt).length
      const link = await unreadLink()
      const target = link.getAttribute("href")!
      expect(target.startsWith(`/en${base}/`)).toBe(true)
      fireEvent.click(link)
      await waitFor(() =>
        expect(theirs().filter((n) => !n.readAt)).toHaveLength(before - 1)
      )
      expect(router.state.location.pathname).toBe(target.split("?")[0])
    })
  }
)

describe("NotificationPrefsForm", () => {
  it("has one switch per kind, each saving at once", async () => {
    await openPage()
    const names = [
      "Messages",
      "Listing and account updates",
      "Saved search matches",
      "Reviews",
      "Billing",
      "Announcements",
    ]
    for (const name of names)
      expect(
        (await screen.findByRole("switch", { name })).getAttribute(
          "aria-checked"
        )
      ).toBe("true")
    fireEvent.click(screen.getByRole("switch", { name: "Billing" }))
    await waitFor(() => expect(me().prefs.billing).toBe(false))
    expect(
      screen
        .getByRole("switch", { name: "Billing" })
        .getAttribute("aria-checked")
    ).toBe("false")
    expect(me().prefs.messages).toBe(true)
  })

  it("puts the switch back when the save fails", async () => {
    await openPage()
    const toggle = await screen.findByRole("switch", { name: "Reviews" })
    document.cookie = "mock_fail=500; Path=/"
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(toggle.getAttribute("aria-checked")).toBe("true")
    )
    expect(me().prefs.reviews).toBe(true)
  })
})

describe("NotificationBell", () => {
  it("shows the unread count and opens the latest notifications", async () => {
    await renderShell(<NotificationBell />, { role: "user" })
    const bell = await screen.findByRole("button", {
      name: `Notifications, ${unread().length} unread`,
    })
    fireEvent.click(bell)
    const panel = await screen.findByRole("dialog")
    expect(await within(panel).findAllByRole("listitem")).toHaveLength(
      Math.min(8, mine().length)
    )
    expect(
      within(panel).getByRole("link", { name: "See all" }).getAttribute("href")
    ).toBe("/en/account/notifications")
  })

  it("Mark all as read clears the badge", async () => {
    await renderShell(<NotificationBell />, { role: "user" })
    fireEvent.click(
      await screen.findByRole("button", { name: /^Notifications, \d+ unread/ })
    )
    const panel = await screen.findByRole("dialog")
    fireEvent.click(
      within(panel).getByRole("button", { name: "Mark all as read" })
    )
    await waitFor(() => expect(unread()).toHaveLength(0))
    expect(
      await screen.findByRole("button", { name: "Notifications" })
    ).toBeTruthy()
  })

  it("a row closes the panel, marks itself read and opens its page", async () => {
    const { router } = await renderShell(<NotificationBell />, { role: "user" })
    const before = unread().length
    fireEvent.click(
      await screen.findByRole("button", { name: /^Notifications, \d+ unread/ })
    )
    const panel = await screen.findByRole("dialog")
    const link = (await within(panel).findAllByRole("listitem"))
      .filter((li) => within(li).queryByText("Unread"))
      .map((li) => within(li).queryByRole("link"))
      .find(Boolean)!
    const target = link.getAttribute("href")!
    fireEvent.click(link)
    await waitFor(() => expect(unread()).toHaveLength(before - 1))
    expect(router.state.location.pathname).toBe(target)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("asks a signed-out visitor to sign in", async () => {
    await renderShell(<NotificationBell />)
    const link = await screen.findByRole("link", { name: "Notifications" })
    expect(link.getAttribute("href")).toContain("/en/auth/login?redirect=")
  })
})
