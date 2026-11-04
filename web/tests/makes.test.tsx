import { fireEvent, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { MakeGrid } from "@/features/home/components/make-grid"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

describe("MakeGrid", () => {
  it("shows the sixteen leading makes, each linking to its results with a count", async () => {
    await renderShell(<MakeGrid />)
    const region = await screen.findByRole("region", { name: "Popular makes" })
    const tiles = await within(region).findAllByRole("link")
    expect(tiles).toHaveLength(16)
    expect(tiles[0]!.getAttribute("href")).toContain("toyota")
    expect(tiles[0]!.textContent).toMatch(/^Toyota\d+$/)
  })

  it("opens every make A to Z with its count in a dialog", async () => {
    await renderShell(<MakeGrid />)
    await screen.findByRole("link", { name: /Toyota/ })
    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    const dialog = await screen.findByRole("dialog", { name: "All makes" })
    const tiles = within(dialog).getAllByRole("link")
    expect(tiles).toHaveLength(db.taxonomy.makes.length)
    const names = db.taxonomy.makes
      .map((m) => m.name.en)
      .sort((a, b) => a.localeCompare(b, "en"))
    expect(tiles.map((a) => a.textContent.replace(/\d.*$/, ""))).toEqual(names)
    expect(tiles[0]!.textContent).toMatch(/\d+ listings?$/)
  })
})
