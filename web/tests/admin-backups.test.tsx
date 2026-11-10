import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BackupsPage } from "@/features/admin-backups/components/backups-page"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
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
  it("lists backup IDs, starts a backup, and shows the CLI restore note without a Restore button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await renderShell(<BackupsPage />, {
      role: "admin",
      path: "/en/admin/backups",
    })
    expect(await screen.findByText("bun run db:restore <id>")).toBeTruthy()
    expect(
      (await screen.findAllByText(db.backups[0]!.id)).length
    ).toBeGreaterThan(0)
    const [copy] = screen.getAllByRole("button", {
      name: `Copy backup ID ${db.backups[0]!.id}`,
    })
    expect(copy).toBeTruthy()
    fireEvent.click(copy!)
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(db.backups[0]!.id)
    )
    expect(screen.queryByRole("button", { name: /^Restore/ })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Back up now" }))
    await waitFor(() => expect(db.backups).toHaveLength(6))
    const backup = db.backups.at(-1)!
    expect(backup.status).toBe("running")
    expect((await screen.findAllByText("Backing up")).length).toBeGreaterThan(0)
    expect(screen.getAllByText(backup.id).length).toBeGreaterThan(0)
  })

  it("saves schedule changes and still renders restoring status rows", async () => {
    db.backups[0] = { ...db.backups[0]!, status: "restoring" }
    await renderShell(<BackupsPage />, {
      role: "admin",
      path: "/en/admin/backups",
    })
    expect((await screen.findAllByText("Restoring")).length).toBeGreaterThan(0)
    await pick(screen.getByLabelText(/Automatic backups/), "Weekly")
    await waitFor(() => expect(db.settings.backupSchedule).toBe("weekly"))
  })
})
