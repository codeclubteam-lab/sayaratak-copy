import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BackupsPage } from "@/features/admin-backups/components/backups-page"
import { db, resetDb } from "@/mocks/db"
import { toast } from "@/components/ui/toast"
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

describe("BackupsPage", () => {
  it("backs up, then restores that snapshot after the typed word", async () => {
    await renderShell(<BackupsPage />, {
      role: "admin",
      path: "/en/admin/backups",
    })
    fireEvent.click(await screen.findByRole("button", { name: "Back up now" }))
    await waitFor(() => expect(db.backups).toHaveLength(6))
    const backup = db.backups.at(-1)!
    expect(backup.status).toBe("running")
    expect((await screen.findAllByText("Backing up")).length).toBeGreaterThan(0)

    // A change after the backup, which the restore must undo.
    db.settings.listingExpiryDays = 99
    backup.createdAt = new Date(Date.now() - 5000).toISOString()
    const restore = await waitFor(() => {
      const button = screen.getAllByRole("button", {
        name: /^Restore the backup from/,
      })[0]!
      expect(button).toHaveProperty("disabled", false)
      return button
    })
    fireEvent.click(restore)
    const dialog = within(await screen.findByRole("dialog"))
    const word = dialog.getByRole("textbox", {
      name: "Type RESTORE to confirm",
    })
    fireEvent.change(word, { target: { value: "restore" } })
    fireEvent.click(dialog.getByRole("button", { name: "Restore" }))
    expect(
      await dialog.findByText("Type the word exactly as shown")
    ).toBeTruthy()
    fireEvent.change(word, { target: { value: "RESTORE" } })
    fireEvent.click(dialog.getByRole("button", { name: "Restore" }))
    expect(
      await dialog.findByText("Backup restored", {}, { timeout: 4000 })
    ).toBeTruthy()
    expect(db.settings.listingExpiryDays).toBe(30)
    expect(db.backups).toHaveLength(6)
  })

  it("Close during a restore leaves it running and reports by toast", async () => {
    await renderShell(<BackupsPage />, {
      role: "admin",
      path: "/en/admin/backups",
    })
    const add = vi.spyOn(toast, "add")
    db.settings.listingExpiryDays = 99
    const [restore] = await screen.findAllByRole("button", {
      name: /^Restore the backup from/,
    })
    fireEvent.click(restore!)
    const dialog = within(await screen.findByRole("dialog"))
    fireEvent.change(
      dialog.getByRole("textbox", { name: "Type RESTORE to confirm" }),
      { target: { value: "RESTORE" } }
    )
    fireEvent.click(dialog.getByRole("button", { name: "Restore" }))
    expect(await dialog.findByRole("progressbar")).toBeTruthy()
    expect(dialog.queryByRole("button", { name: "Restore" })).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    expect(screen.getByRole("dialog")).toBeTruthy()
    fireEvent.click(dialog.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(
      () => expect(add).toHaveBeenCalledWith({ title: "Backup restored" }),
      { timeout: 4000 }
    )
    expect(db.settings.listingExpiryDays).toBe(30)
  })
})
