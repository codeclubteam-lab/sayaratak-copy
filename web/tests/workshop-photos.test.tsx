import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PhotosPage } from "@/features/workshop-photos/components/photos-page"
import { toast } from "@/components/ui/toast"
import { processImage } from "@/lib/image-process"
import { uploadMedia } from "@/lib/api/upload"
import { db, resetDb } from "@/mocks/db"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

vi.mock("@/lib/image-process", () => ({ processImage: vi.fn() }))
vi.mock("@/lib/api/upload", () => ({ uploadMedia: vi.fn() }))

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
})

const workshop = () => {
  const owner = db.users.find((u) => u.role === "workshop" && u.onboardingDone)!
  return db.workshops.find((w) => w.ownerId === owner.id)!
}
const ids = () => workshop().images.map((i) => i.id)
const open = () =>
  renderShell(<PhotosPage />, { role: "workshop", path: "/en/workshop/photos" })
const tile = (n: number) =>
  screen.getByAltText(`Photo ${n}`).closest<HTMLElement>("[draggable]")!

describe("PhotosPage", () => {
  it("moves a photo to first and saves the order", async () => {
    const add = vi.spyOn(toast, "add")
    const [a, b, ...rest] = ids()
    await open()
    await screen.findByAltText("Photo 2")
    expect(within(tile(1)).getByText("First")).toBeTruthy()
    fireEvent.click(
      within(tile(2)).getByRole("button", { name: "Move to first" })
    )
    await waitFor(() => expect(ids()).toEqual([b, a, ...rest]))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ title: "Photos updated" })
    )
  })

  it("removes a photo only after the confirm", async () => {
    const [a, ...rest] = ids()
    await open()
    await screen.findByAltText("Photo 1")
    fireEvent.click(within(tile(1)).getByRole("button", { name: "Remove" }))
    expect(ids()[0]).toBe(a)
    await confirmRemove("Remove this photo?")
    await waitFor(() => expect(ids()).toEqual(rest))
  })

  it("adds an uploaded photo at the end", async () => {
    const before = ids()
    const media: Media = {
      id: "up_new",
      type: "image",
      url: "/api/uploads/up_new?w={w}",
      width: 100,
      height: 80,
      placeholderColor: "#112233",
      posterUrl: null,
    }
    db.uploads.set(media.id, {
      id: media.id,
      name: "new.webp",
      type: "image/webp",
      bytes: new ArrayBuffer(1),
      media,
    })
    vi.mocked(uploadMedia).mockResolvedValue(media)
    const { container } = await open()
    await screen.findByAltText("Photo 1")
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["x"], "new.jpg", { type: "image/jpeg" })] },
    })
    await waitFor(() => expect(ids()).toEqual([...before, "up_new"]))
  })

  it("on Basic, the uploader takes one photo and the plans are offered", async () => {
    const w = workshop()
    db.subscriptions.find(
      (s) => s.userId === w.ownerId && s.status === "active"
    )!.planId = "plan-workshop-basic"
    w.images = w.images.slice(0, 1)
    await open()
    expect(await screen.findByText(/Your plan includes 1 photo/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "See plans" })).toBeTruthy()
    expect(screen.getByText("1 of 1")).toBeTruthy()
  })
})
