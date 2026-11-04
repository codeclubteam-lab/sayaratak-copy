import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminCategoriesPage } from "@/features/admin-categories/components/categories-page"
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
  renderShell(<AdminCategoriesPage />, {
    role: "admin",
    path: "/en/admin/categories",
  })

describe("AdminCategoriesPage", () => {
  it("hides a vehicle type only after a confirm", async () => {
    await open()
    fireEvent.click(
      await screen.findByRole("switch", { name: "Shown on the site, Trucks" })
    )
    expect(
      db.taxonomy.vehicleTypes.find((v) => v.id === "truck")?.enabled
    ).toBe(true)
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide" }))
    await waitFor(() =>
      expect(
        db.taxonomy.vehicleTypes.find((v) => v.id === "truck")?.enabled
      ).toBe(false)
    )
  })

  it("keeps the last shown vehicle type on", async () => {
    await open()
    for (const v of db.taxonomy.vehicleTypes.slice(1)) v.enabled = false
    expect(await screen.findByText("Last one shown")).toBeTruthy()
    expect(
      screen.queryByRole("switch", { name: "Shown on the site, Cars" })
    ).toBeNull()
    const res = await handleMock(
      new Request("http://localhost/api/admin/taxonomy/vehicle-types/car", {
        method: "PATCH",
        headers: {
          cookie: "sy_session=u-admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ enabled: false }),
      })
    )
    expect(res.status).toBe(409)
  })

  it("adds a part category with a slug, then refuses to remove one in use", async () => {
    await open()
    fireEvent.click(await screen.findByRole("button", { name: "Add category" }))
    const dialog = await screen.findByRole("dialog", { name: "Add category" })
    fireEvent.change(within(dialog).getByLabelText("Name in Arabic"), {
      target: { value: "إكسسوارات" },
    })
    fireEvent.change(within(dialog).getByLabelText("Name in English"), {
      target: { value: "Accessories" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(db.taxonomy.partCategories.at(-1)?.slug).toBe("accessories-2")
    )

    const used = db.taxonomy.partCategories.find((c) =>
      db.listings.some((l) => l.partCategoryId === c.id)
    )!
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Remove ${used.name.en}`,
      })
    )
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Remove",
      })
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    const res = await handleMock(
      new Request(
        `http://localhost/api/admin/taxonomy/part-categories/${used.id}`,
        {
          method: "DELETE",
          headers: { cookie: "sy_session=u-admin" },
        }
      )
    )
    expect(res.status).toBe(409)
    expect(db.taxonomy.partCategories.some((c) => c.id === used.id)).toBe(true)
  })
})
