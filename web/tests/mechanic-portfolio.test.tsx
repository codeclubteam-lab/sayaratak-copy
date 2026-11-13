import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PortfolioPage } from "@/features/mechanic-portfolio/components/portfolio-page"
import { processImage } from "@/lib/image-process"
import { uploadMedia } from "@/lib/api/upload"
import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { mechanicSchema } from "@sayaratak/shared/schemas/profile"
import { renderShell } from "./shell-render"

vi.mock("@/lib/image-process", () => ({ processImage: vi.fn() }))
vi.mock("@/lib/api/upload", () => ({ uploadMedia: vi.fn() }))

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}
document.elementFromPoint = () => null

beforeEach(() => {
  resetDb()
  URL.createObjectURL = vi.fn(() => "blob:preview")
  URL.revokeObjectURL = vi.fn()
  vi.mocked(processImage).mockResolvedValue({
    blob: new Blob(["x"], { type: "image/webp" }),
    width: 100,
    height: 80,
    placeholderColor: "#112233",
  })
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const owner = () =>
  db.users.find((u) => u.role === "mechanic" && u.onboardingDone)!
const mechanic = () => db.mechanics.find((m) => m.ownerId === owner().id)!
const ids = () => mechanic().portfolio.map((p) => p.id)
const open = () =>
  renderShell(<PortfolioPage />, {
    role: "mechanic",
    path: "/en/mechanic/portfolio",
  })
const publicPortfolio = async () =>
  mechanicSchema.parse(
    await (
      await handleMock(new Request(`http://x/api/mechanics/${mechanic().slug}`))
    ).json()
  ).portfolio

describe("PortfolioPage", () => {
  it("adds a photo with a caption, then edits the caption; the public page shows both", async () => {
    mechanic().portfolio = mechanic().portfolio.slice(0, 2)
    const media: Media = {
      id: "up_job",
      type: "image",
      url: "/api/uploads/up_job?w={w}",
      width: 100,
      height: 80,
      placeholderColor: "#112233",
      posterUrl: null,
    }
    db.uploads.set(media.id, {
      id: media.id,
      name: "job.webp",
      type: "image/webp",
      bytes: new ArrayBuffer(1),
      media,
    })
    vi.mocked(uploadMedia).mockResolvedValue(media)
    await open()
    fireEvent.click(await screen.findByRole("button", { name: "Add work" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    expect(
      await within(dialog).findAllByText("This field is required")
    ).toHaveLength(2)
    await waitFor(() =>
      expect(dialog.querySelector('input[type="file"]')).toBeTruthy()
    )
    fireEvent.change(dialog.querySelector('input[type="file"]')!, {
      target: { files: [new File(["x"], "job.jpg", { type: "image/jpeg" })] },
    })
    fireEvent.change(within(dialog).getByLabelText(/Caption/), {
      target: { value: "Gearbox rebuild" },
    })
    await within(dialog).findByAltText("Photo of the finished job")
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(mechanic().portfolio.at(-1)).toMatchObject({
        url: media.url,
        caption: "Gearbox rebuild",
      })
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Actions for Gearbox rebuild" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }))
    const edit = await screen.findByRole("dialog")
    const newMedia: Media = {
      id: "up_new_job",
      type: "image",
      url: "/api/uploads/up_new_job?w={w}",
      width: 120,
      height: 90,
      placeholderColor: "#334455",
      posterUrl: null,
    }
    db.uploads.set(newMedia.id, {
      id: newMedia.id,
      name: "new_job.webp",
      type: "image/webp",
      bytes: new ArrayBuffer(1),
      media: newMedia,
    })
    vi.mocked(uploadMedia).mockResolvedValue(newMedia)
    fireEvent.change(edit.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["y"], "new_job.jpg", { type: "image/jpeg" })],
      },
    })
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(2))
    fireEvent.change(within(edit).getByLabelText(/Caption/), {
      target: { value: "Gearbox rebuilt" },
    })
    fireEvent.click(within(edit).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(mechanic().portfolio.at(-1)).toMatchObject({
        url: newMedia.url,
        caption: "Gearbox rebuilt",
      })
    )
    expect((await publicPortfolio()).at(-1)).toMatchObject({
      url: newMedia.url,
      caption: "Gearbox rebuilt",
    })
  })

  it("moves an item later at once and keeps focus on its arrow", async () => {
    const [a, b] = mechanic().portfolio
    await open()
    const later = await screen.findByRole("button", {
      name: `Move ${a!.caption} later`,
    })
    later.focus()
    fireEvent.click(later)
    await waitFor(() => expect(ids().slice(0, 2)).toEqual([b!.id, a!.id]))
    expect(document.activeElement?.getAttribute("data-move")).toBe(`${a!.id}:1`)
    expect((await publicPortfolio()).map((p) => p.id).slice(0, 2)).toEqual([
      b!.id,
      a!.id,
    ])
  })

  it("deletes only after the confirm", async () => {
    const [a] = mechanic().portfolio
    await open()
    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: `Actions for ${a!.caption}`,
        })
      )[0]!
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(ids()).toContain(a!.id)
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(ids()).not.toContain(a!.id))
  })

  it("on Basic, five photos hide Add and offer the plans", async () => {
    const m = mechanic()
    db.subscriptions.find(
      (s) => s.userId === m.ownerId && s.status === "active"
    )!.planId = "plan-mechanic-basic"
    m.portfolio = Array.from({ length: 5 }, (_, i) => ({
      ...m.portfolio[0]!,
      id: `pf-x${i}`,
      caption: `Job ${i}`,
    }))
    await open()
    expect(
      await screen.findByText("You reached the limit of your plan")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "See plans" }).getAttribute("href")
    ).toBe("/en/mechanic/billing")
    expect(screen.queryByRole("button", { name: "Add work" })).toBeNull()
  })

  it("shows the empty state with Add work", async () => {
    mechanic().portfolio = []
    await open()
    expect(await screen.findByText("No work yet")).toBeTruthy()
    expect(
      screen.getByText("Photos of finished jobs build trust.")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add work" })).toBeTruthy()
  })
})
