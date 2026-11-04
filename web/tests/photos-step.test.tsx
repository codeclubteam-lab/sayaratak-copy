import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { photosStepSchema } from "@sayaratak/shared/listings/schemas"
import { AuthDialog } from "@/features/auth/components/auth-dialog"
import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { wizardSteps } from "@/features/listings/wizard/wizard-steps"
import { processImage } from "@/lib/image-process"
import { uploadMedia } from "@/lib/api/upload"
import { processVideo } from "@/lib/video-process"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { resetDb } from "@/mocks/db"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

vi.mock("@/lib/image-process", () => ({ processImage: vi.fn() }))
vi.mock("@/lib/video-process", () => ({ processVideo: vi.fn() }))
vi.mock("@/lib/api/upload", () => ({ uploadMedia: vi.fn() }))
vi.mock("@/components/app/map-canvas-impl", () => ({
  MapCanvasImpl: () => null,
}))

const media = (id: string, type: Media["type"] = "image"): Media => ({
  id,
  type,
  url: `/mock/${id}-{w}.webp`,
  width: 1280,
  height: 853,
  placeholderColor: "#b8c4c0",
  posterUrl: type === "video" ? `/mock/${id}-poster-{w}.webp` : null,
})
const photos = [..."abc"].map((id) => media(id))
const ids = (list: Media[]) => list.map((m) => m.id)

const publish = vi.fn((_values: Record<string, unknown>) => Promise.resolve())
function Harness() {
  const stepId = useRouterState({
    select: (s) =>
      new URLSearchParams(s.location.searchStr).get("step") ?? "type",
  })
  return (
    <ListingWizard
      context="public"
      stepId={stepId}
      steps={wizardSteps}
      defaultValues={wizardDefaults}
      onPublish={publish}
    />
  )
}
// A car whose type and details are valid, so the photos step may open.
const valid = {
  kind: "vehicle",
  vehicleType: "car",
  makeId: "x",
  modelId: "y",
  year: 2018,
  fuel: "petrol",
  transmission: "automatic",
  mileageKm: 90000,
  title: "Toyota Corolla 2018",
  description: "Clean car, one owner, full service history.",
  price: 12_000_000,
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  phone: "+249912345678",
  whatsapp: "+249912345678",
}
const saveDraft = (draft: object) =>
  sessionStorage.setItem(
    "sy:draft:listing:new",
    JSON.stringify({
      savedAt: new Date().toISOString(),
      values: { ...wizardDefaults, ...valid, ...draft },
    })
  )
// Uploads need an account (owner, 2026-11-01), so the step opens signed in.
const open = async (draft: object = {}) => {
  saveDraft(draft)
  await renderShell(<Harness />, {
    path: "/en/post?step=photos",
    role: "user",
  })
  await screen.findByRole("heading", { name: "Add photos" })
  await waitFor(() => expect(input("image/*")).toBeTruthy())
}
const input = (accept: string) =>
  document.querySelector(`input[accept="${accept}"]`) as HTMLElement
const choose = (accept: string, ...files: File[]) =>
  fireEvent.change(input(accept), { target: { files } })
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }))
// Photos come before contact and review: Next twice, then the review's Publish sends everything.
const publishNow = async () => {
  next()
  await screen.findByRole("heading", { name: "Location and contact" })
  next()
  await screen.findByRole("heading", { name: "Review and publish" })
  fireEvent.click(screen.getByRole("button", { name: "Publish" }))
}
const sent = () => ids(publish.mock.calls[0]![0].media as Media[])

beforeEach(() => {
  resetDb()
  publish.mockClear()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => "blob:preview")
  URL.revokeObjectURL = vi.fn()
  vi.mocked(processImage).mockResolvedValue({
    blob: new Blob(["x"], { type: "image/webp" }),
    width: 100,
    height: 80,
    placeholderColor: "#112233",
  })
  vi.mocked(uploadMedia).mockReset()
})

describe("photosStepSchema", () => {
  const messages = (list: Media[]) => {
    const r = photosStepSchema.safeParse({ media: list })
    return r.success ? [] : r.error.issues.map((i) => i.message)
  }
  it("needs three photos; a video does not count", () => {
    expect(messages([...photos, media("v", "video")])).toEqual([])
    expect(messages([media("a"), media("b"), media("v", "video")])).toEqual([
      "validation.media_min",
    ])
  })
  it("allows 20 photos and one video at most", () => {
    const many = (n: number) => [...Array(n)].map((_, i) => media(`p${i}`))
    expect(messages(many(20))).toEqual([])
    expect(messages(many(21))).toEqual(["validation.media_max"])
    expect(
      messages([...photos, media("v1", "video"), media("v2", "video")])
    ).toEqual(["validation.video_max"])
  })
})

describe("PhotosStep", () => {
  it("signed out, asks for sign in instead of offering uploads", async () => {
    saveDraft({})
    await renderShell(
      <>
        <Harness />
        <AuthDialog />
      </>,
      { path: "/en/post?step=photos" }
    )
    await screen.findByText(
      "Sign in to add photos. What you have entered so far stays."
    )
    expect(input("image/*")).toBeNull()
    next()
    expect(await screen.findByText("Add at least 3 photos")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("Sign in to add photos")
    expect(uploadMedia).not.toHaveBeenCalled()
  })

  it("Next with fewer than three photos shows the error and stays", async () => {
    await open({ media: [media("a"), media("b")] })
    next()
    expect(await screen.findByText("Add at least 3 photos")).toBeTruthy()
    expect(publish).not.toHaveBeenCalled()
  })

  it("an uploaded photo is added after the photos and before the video", async () => {
    vi.mocked(uploadMedia).mockResolvedValue(media("c"))
    await open({ media: [media("a"), media("b"), media("v", "video")] })
    choose("image/*", new File(["x"], "c.jpg", { type: "image/jpeg" }))
    await waitFor(() => expect(uploadMedia).toHaveBeenCalled())
    await screen.findByText("3 of 20")
    await publishNow()
    await waitFor(() => expect(publish).toHaveBeenCalled())
    expect(sent()).toEqual(["a", "b", "c", "v"])
  })

  it("an uploaded video goes last and stays out of the photo count", async () => {
    vi.mocked(processVideo).mockResolvedValue({
      file: new File(["x"], "v.mp4", { type: "video/mp4" }),
      poster: new Blob(["x"]),
      width: 1280,
      height: 720,
      placeholderColor: "#000000",
    })
    vi.mocked(uploadMedia).mockResolvedValue(media("v", "video"))
    await open({ media: photos })
    choose("video/*", new File(["x"], "v.mp4", { type: "video/mp4" }))
    await waitFor(() => expect(uploadMedia).toHaveBeenCalled())
    await screen.findByRole("button", { name: "Play video" })
    expect(screen.getByText("3 of 20")).toBeTruthy()
    await publishNow()
    await waitFor(() => expect(publish).toHaveBeenCalled())
    expect(sent()).toEqual(["a", "b", "c", "v"])
  })

  it("Set as cover moves a photo first and the video stays last", async () => {
    await open({ media: [...photos, media("v", "video")] })
    fireEvent.click(screen.getAllByRole("button", { name: "Set as cover" })[1]!)
    await publishNow()
    await waitFor(() => expect(publish).toHaveBeenCalled())
    expect(sent()).toEqual(["c", "a", "b", "v"])
  })

  it("removing the video leaves the photos", async () => {
    await open({ media: [...photos, media("v", "video")] })
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" }).at(-1)!)
    await confirmRemove("Remove this video?")
    await publishNow()
    await waitFor(() => expect(publish).toHaveBeenCalled())
    expect(sent()).toEqual(["a", "b", "c"])
  })

  it("shows the tips for a vehicle", async () => {
    await open({ media: photos })
    expect(screen.getByText("The odometer showing the mileage")).toBeTruthy()
  })

  it("shows part tips, not the odometer, for a part", async () => {
    await open({
      kind: "part",
      vehicleType: null,
      partCategoryId: "x",
      compatibleTypes: ["car"],
      media: photos,
    })
    expect(screen.getByText("Any label or part number")).toBeTruthy()
    expect(screen.queryByText("The odometer showing the mileage")).toBeNull()
  })
})
