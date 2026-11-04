import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PagesAdminPage } from "@/features/admin-pages/components/pages-admin-page"
import { db, resetDb } from "@/mocks/db"
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

const terms = () => db.pages.find((p) => p.slug === "terms")!

describe("PagesAdminPage", () => {
  it("an error in the hidden English tab opens it; a fixed save updates both languages", async () => {
    await renderShell(<PagesAdminPage />, {
      role: "admin",
      path: "/en/admin/pages?page=terms",
    })
    const titleEn = await screen.findByRole("textbox", {
      name: "Title in English",
      hidden: true,
    })
    fireEvent.change(titleEn, { target: { value: "" } })
    fireEvent.change(screen.getByRole("textbox", { name: "Title in Arabic" }), {
      target: { value: "الشروط الجديدة" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save page" }))
    await waitFor(() =>
      expect(
        screen
          .getByRole("tab", { name: "English" })
          .getAttribute("aria-selected")
      ).toBe("true")
    )
    expect(terms().title.ar).not.toBe("الشروط الجديدة")
    fireEvent.change(titleEn, { target: { value: "New terms" } })
    fireEvent.click(screen.getByRole("button", { name: "Save page" }))
    await waitFor(() =>
      expect(terms().title).toEqual({ ar: "الشروط الجديدة", en: "New terms" })
    )
  })
})
