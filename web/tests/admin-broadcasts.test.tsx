import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BroadcastsPage } from "@/features/admin-broadcasts/components/broadcasts-page"
import { NowProvider } from "@/lib/now"
import { businessOf } from "@/mocks/lib"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const open = () =>
  renderShell(
    <NowProvider serverNow={Date.now()}>
      <BroadcastsPage />
    </NowProvider>,
    { role: "admin", path: "/en/admin/broadcasts" }
  )
const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name }), {
    target: { value },
  })
const got = (userId: string) =>
  db.notifications.filter(
    (n) => n.userId === userId && n.title.en === "Oil sale"
  )

describe("BroadcastsPage", () => {
  it("verified only reaches verified dealerships in both languages, not users or unverified ones", async () => {
    await open()
    type("Title in Arabic", "تخفيض الزيت")
    type("Title in English", "Oil sale")
    type("Message in Arabic", "خصم هذا الأسبوع")
    type("Message in English", "Discount this week")
    for (const role of ["Workshops", "Mechanics"])
      fireEvent.click(screen.getByRole("checkbox", { name: role }))
    fireEvent.click(screen.getByRole("switch", { name: "Verified only" }))
    const users = screen.getByRole("checkbox", { name: "Users" })
    expect(users.getAttribute("aria-disabled")).toBe("true")
    expect(users.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(screen.getByRole("button", { name: "Send notification" }))
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Send notification" })
    )
    const dealers = db.users.filter((u) => u.role === "dealership")
    const verified = dealers.find((u) => businessOf(u)?.row?.verified)!
    const unverified = dealers.find((u) => !businessOf(u)?.row?.verified)!
    // Queued first; the bells ring a moment later and the list follows it to "Sent".
    await screen.findAllByText("Queued")
    await waitFor(() => expect(got(verified.id)).toHaveLength(1), {
      timeout: 4000,
    })
    await waitFor(
      () =>
        expect(
          within(screen.getByRole("table")).getByText("Sent", { exact: true })
        ).toBeTruthy(),
      { timeout: 6000 }
    )
    expect(got(verified.id)[0]?.title).toEqual({
      ar: "تخفيض الزيت",
      en: "Oil sale",
    })
    expect(got(unverified.id)).toHaveLength(0)
    expect(got("u-user")).toHaveLength(0)
    await waitFor(() =>
      expect(screen.getByRole("table").textContent).toContain("Oil sale")
    )
  })

  it("the city narrows the audience; the estimate matches what is sent", async () => {
    const city = db.users.find((u) => u.role === "user" && u.cityId)!.cityId!
    const ask = (path: string, body?: unknown) =>
      handleMock(
        new Request(`http://localhost/api${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            cookie: "sy_session=u-admin",
            "content-type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        })
      ).then((r) => r.json())
    const est = await ask(
      `/admin/broadcasts/estimate?roles=user&cityId=${city}`
    )
    const all = await ask("/admin/broadcasts/estimate?roles=user")
    expect(est.count).toBeGreaterThan(0)
    expect(est.count).toBeLessThan(all.count)
    const sent = await ask("/admin/broadcasts", {
      roles: ["user"],
      cityId: city,
      verifiedOnly: false,
      title: { ar: "أ", en: "Oil sale" },
      body: { ar: "ب", en: "b" },
      href: "/search",
    })
    expect(sent).toMatchObject({ status: "queued", recipients: 0 })
    await new Promise((done) => setTimeout(done, 1800))
    const history = await ask("/admin/broadcasts")
    expect(history.items[0]).toMatchObject({
      status: "sent",
      recipients: est.count,
    })
    const outside = db.users.find(
      (u) => u.role === "user" && u.cityId !== city
    )!
    expect(got(outside.id)).toHaveLength(0)
  })
})
