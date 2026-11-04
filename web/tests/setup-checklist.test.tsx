import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { keys } from "@/lib/api/query-keys"
import { AccountMenu } from "@/components/app/account-menu"
import {
  SetupChecklist,
  setupDismissed,
} from "@/features/onboarding/components/setup-checklist"
import { setupItems } from "@/features/onboarding/setup-items"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  setupDismissed.setState(() => false)
})

const ownerOf = (role: "dealership" | "workshop" | "mechanic") =>
  db.users.find((u) => u.role === role && u.onboardingDone)!.id
const dealer = () =>
  db.dealerships.find((b) => b.ownerId === ownerOf("dealership"))!
const workshop = () =>
  db.workshops.find((b) => b.ownerId === ownerOf("workshop"))!
const mechanic = () =>
  db.mechanics.find((b) => b.ownerId === ownerOf("mechanic"))!
const todo = (b: Parameters<typeof setupItems>[0], pending = false) =>
  setupItems(b, pending)
    .filter((i) => !i.done)
    .map((i) => i.key)

describe("setupItems", () => {
  it("asks each role for its own items and links them into its dashboard", () => {
    const rows = [
      [dealer(), "/dealer/"],
      [workshop(), "/workshop/"],
      [mechanic(), "/mechanic/"],
    ] as const
    for (const [row, prefix] of rows) {
      const items = setupItems(row, false)
      expect(items.at(-1)?.key).toBe("dashboard.setup_verification")
      expect(items.every((i) => i.href.startsWith(prefix))).toBe(true)
    }
  })

  it("counts an item only once the profile has it", () => {
    const shop = { ...workshop(), verified: false }
    expect(todo({ ...shop, logoUrl: "", services: [], images: [] })).toEqual(
      expect.arrayContaining([
        "dashboard.setup_logo",
        "dashboard.setup_services",
        "dashboard.setup_photos",
        "dashboard.setup_verification",
      ])
    )
    const done = {
      ...shop,
      logoUrl: "x",
      description: { ar: "x", en: "x" },
      hours: shop.hours.map((h) => ({ ...h, closed: false })),
      services: Array.from({ length: 3 }, (_, i) => ({
        id: `s${i}`,
        name: "x",
        description: "",
        templateId: null,
      })),
      images: Array.from({ length: 3 }, () => shop.images[0]!),
    }
    expect(todo(done)).toEqual(["dashboard.setup_verification"])
    expect(todo(done, true)).toEqual([])
    expect(todo({ ...done, verified: true })).toEqual([])
  })
})

describe("SetupChecklist", () => {
  it("links open items, follows the profile on the next visit and hides at 100 percent", async () => {
    const shop = workshop()
    Object.assign(shop, {
      logoUrl: "",
      description: { ar: "x", en: "x" },
      services: [],
      images: [],
      verified: false,
    })
    const { client } = await renderShell(<SetupChecklist />, {
      role: "workshop",
    })
    const logo = await screen.findByRole("link", { name: /Add a logo/ })
    expect(logo.getAttribute("href")).toBe("/en/workshop/profile")
    const done = () => screen.getByRole("meter").getAttribute("aria-valuenow")
    const before = done()
    shop.logoUrl = "x"
    await act(() => client.invalidateQueries())
    await waitFor(() => expect(Number(done())).toBe(Number(before) + 1))
    expect(screen.queryByRole("link", { name: /Add a logo/ })).toBeNull()
    Object.assign(shop, {
      services: Array.from({ length: 3 }, (_, i) => ({
        id: `s${i}`,
        name: "x",
        description: "",
        templateId: null,
      })),
      images: Array.from({ length: 3 }, (_, i) => ({
        ...db.workshops.find((w) => w.images.length)!.images[0]!,
        id: `i${i}`,
      })),
    })
    db.verifications.push({
      id: "vr-test",
      targetType: "workshop",
      targetId: shop.id,
      ownerId: shop.ownerId,
      documents: [],
      status: "pending",
      createdAt: new Date().toISOString(),
    })
    await act(() => client.invalidateQueries())
    await waitFor(() => expect(screen.queryByRole("heading")).toBeNull())
    // A rejected request opens the item again.
    Object.assign(db.verifications.at(-1)!, {
      status: "rejected",
      rejectionReason: "The document is not readable",
    })
    await act(() => client.invalidateQueries())
    const again = await screen.findByRole("link", {
      name: /Request verification again/,
    })
    expect(again.textContent).toContain("Reason: The document is not readable")
    expect(again.getAttribute("href")).toBe("/en/workshop/verification")
  })

  it("stays hidden for the session once dismissed", async () => {
    await renderShell(<SetupChecklist />, { role: "workshop" })
    await screen.findByRole("heading", {
      name: "Finish setting up your profile",
    })
    fireEvent.click(screen.getByRole("button", { name: "Hide for now" }))
    expect(screen.queryByRole("heading")).toBeNull()
    expect(setupDismissed.state).toBe(true)
  })
})

describe("finish setup in the account menu", () => {
  it("adds a first menu item that resumes onboarding only while it is open", async () => {
    const { client } = await renderShell(<AccountMenu />, { role: "user" })
    fireEvent.click(screen.getByRole("button", { name: "Account" }))
    await screen.findByRole("menuitem", { name: "Dashboard" })
    expect(
      screen.queryByRole("menuitem", { name: /Finish setting up/ })
    ).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    const me = client.getQueryData<{ onboardingDone: boolean }>(keys.me)!
    await act(async () => {
      client.setQueryData(keys.me, { ...me, onboardingDone: false })
    })
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Account, Finish setting up your account",
      })
    )
    const item = await screen.findByRole("menuitem", {
      name: "Finish setting up your account",
    })
    expect(item.getAttribute("href")).toBe("/en/onboarding")
    expect(screen.getAllByRole("menuitem")[0]).toBe(item)
  })
})
