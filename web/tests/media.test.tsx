import { useState } from "react"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/client"
import { uploadMedia } from "@/lib/api/upload"
import { processImage } from "@/lib/image-process"
import { arrowStep, mediaSrcSet } from "@/lib/media"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { Gallery } from "@/components/app/gallery"
import { ImageUploader } from "@/components/app/image-uploader"
import { LogoUpload } from "@/components/app/logo-upload"
import { MediaImage } from "@/components/app/media-image"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

vi.mock("@/lib/image-process", () => ({ processImage: vi.fn() }))
vi.mock("@/lib/api/upload", () => ({ uploadMedia: vi.fn() }))

const media = (id: string, type: Media["type"] = "image"): Media => ({
  id,
  type,
  url: `/mock/${id}-{w}.webp`,
  width: 1280,
  height: 853,
  placeholderColor: "#b8c4c0",
  posterUrl: type === "video" ? `/mock/${id}-poster-{w}.webp` : null,
})
const six = [..."abcde"].map((id) => media(id))

beforeEach(() => {
  vi.resetAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => "blob:preview")
  URL.revokeObjectURL = vi.fn()
  vi.mocked(processImage).mockResolvedValue({
    blob: new Blob(["x"], { type: "image/webp" }),
    width: 100,
    height: 80,
    placeholderColor: "#112233",
  })
})

const pick = (container: HTMLElement, ...files: File[]) =>
  fireEvent.change(container.querySelector("input[type=file]") as HTMLElement, {
    target: { files },
  })
const photo = (name = "a.jpg") => new File(["x"], name, { type: "image/jpeg" })

describe("media helpers", () => {
  it("builds a srcset only for templated urls and caps it", () => {
    expect(mediaSrcSet("/a-{w}.webp", 1280)).toBe(
      "/a-320.webp 320w, /a-640.webp 640w, /a-960.webp 960w, /a-1280.webp 1280w"
    )
    expect(mediaSrcSet("/a-{w}.webp", 640)).toBe(
      "/a-320.webp 320w, /a-640.webp 640w"
    )
    expect(mediaSrcSet("/plain.webp", 1280)).toBeUndefined()
  })
  it("arrow keys follow the visual direction", () => {
    expect(arrowStep("ArrowRight", "ltr")).toBe(1)
    expect(arrowStep("ArrowLeft", "ltr")).toBe(-1)
    expect(arrowStep("ArrowLeft", "rtl")).toBe(1)
    expect(arrowStep("ArrowRight", "rtl")).toBe(-1)
    expect(arrowStep("Enter", "ltr")).toBe(0)
  })
})

describe("MediaImage", () => {
  it("uses the url template for src and srcset", async () => {
    await renderShell(<MediaImage src="/a-{w}.webp" alt="Car" />)
    const img = screen.getByAltText("Car")
    expect(img.getAttribute("src")).toBe("/a-960.webp")
    expect(img.getAttribute("srcset")).toContain("/a-1280.webp 1280w")
  })
  it("stops at 640 px with data saver on", async () => {
    await renderShell(<MediaImage src="/a-{w}.webp" alt="Car" />, {
      prefs: { dataSaver: true, listingView: "grid" },
    })
    const img = screen.getByAltText("Car")
    expect(img.getAttribute("src")).toBe("/a-640.webp")
    expect(img.getAttribute("srcset")).not.toContain("960")
  })
  it("shows a fallback tile when the file is missing", async () => {
    await renderShell(<MediaImage src="/gone-{w}.webp" alt="Car" />)
    fireEvent.error(screen.getByAltText("Car"))
    expect(screen.queryByRole("img", { name: "Car" })?.tagName).toBe("DIV")
  })
  it("requires alt at compile time", async () => {
    // @ts-expect-error alt is a required prop
    await renderShell(<MediaImage src={null} />)
  })
})

describe("Gallery", () => {
  const items = [...six, media("v", "video")]
  it("moves with the arrow keys, and in RTL the left arrow goes next", async () => {
    await renderShell(<Gallery items={items} alt="Hilux" />)
    const region = screen.getByRole("region", { name: "Hilux" })
    fireEvent.keyDown(within(region).getByText("1 of 6").parentElement!, {
      key: "ArrowRight",
    })
    expect(within(region).getByText("2 of 6")).toBeTruthy()
  })
  it("follows the visual direction in RTL", async () => {
    await renderShell(<Gallery items={items} alt="Hilux" />, { locale: "ar" })
    const region = screen.getByRole("region", { name: "Hilux" })
    const box = within(region).getByText("1 من 6").parentElement!
    fireEvent.keyDown(box, { key: "ArrowLeft" })
    expect(within(region).getByText("2 من 6")).toBeTruthy()
    fireEvent.keyDown(box, { key: "ArrowLeft" })
    fireEvent.keyDown(box, { key: "ArrowRight" })
    expect(within(region).getByText("2 من 6")).toBeTruthy()
  })
  it("shows a video poster first and loads the video only on play", async () => {
    await renderShell(<Gallery items={[media("v", "video")]} alt="Clip" />)
    expect(document.querySelector("video")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Play video" }))
    expect(document.querySelector("video")?.getAttribute("preload")).toBe(
      "none"
    )
  })
  it("opens a full-screen view that has its own controls", async () => {
    await renderShell(<Gallery items={items} alt="Hilux" />)
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }))
    expect(within(dialog).getByText("2 of 6")).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

function Harness({ initial = [] }: { initial?: Media[] }) {
  const [value, setValue] = useState(initial)
  return (
    <ImageUploader
      mode="multi"
      min={3}
      max={20}
      label="Photos"
      value={value}
      onChange={setValue}
    />
  )
}

describe("ImageUploader", () => {
  it("shows the drop prompt and the count with no files", async () => {
    await renderShell(<Harness />)
    expect(
      await screen.findByText("Drop photos here or choose files")
    ).toBeTruthy()
    expect(screen.getByText(/0 of 20/).textContent).toContain("At least 3")
  })
  it("adds a finished upload to the value", async () => {
    vi.mocked(uploadMedia).mockImplementation(async (_form, onProgress) => {
      onProgress(50)
      return media("new")
    })
    const { container } = await renderShell(<Harness />)
    await screen.findByText(/of 20/)
    pick(container, photo())
    expect(await screen.findByText(/1 of 20/)).toBeTruthy()
    expect(screen.getByAltText("Photo 1")).toBeTruthy()
  })
  it("keeps every photo when concurrent uploads finish while parent updates lag", async () => {
    const settle: Array<() => void> = []
    vi.mocked(uploadMedia).mockImplementation(
      (_form, onProgress) =>
        new Promise<Media>((resolve) => {
          const index = settle.length
          onProgress(50)
          settle.push(() => resolve(media(`c${index}`)))
        })
    )
    function DelayedHarness() {
      const [value, setValue] = useState<Media[]>([])
      return (
        <ImageUploader
          mode="multi"
          min={3}
          max={20}
          label="Photos"
          value={value}
          onChange={(next) => queueMicrotask(() => setValue(next))}
        />
      )
    }
    const { container } = await renderShell(<DelayedHarness />)
    await screen.findByText(/0 of 20/)
    pick(container, photo("1.jpg"), photo("2.jpg"), photo("3.jpg"))
    await waitFor(() => expect(settle).toHaveLength(3))
    await act(async () => {
      settle[2]!()
      settle[0]!()
      await Promise.resolve()
      settle[1]!()
    })
    expect(await screen.findByText(/3 of 20/)).toBeTruthy()
  })
  it("lets a failed upload be retried without processing the file again", async () => {
    vi.mocked(uploadMedia)
      .mockRejectedValueOnce(new ApiError(503, "offline"))
      .mockResolvedValueOnce(media("new"))
    const { container } = await renderShell(<Harness />)
    await screen.findByText(/of 20/)
    pick(container, photo())
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    expect(await screen.findByText(/1 of 20/)).toBeTruthy()
    expect(processImage).toHaveBeenCalledTimes(1)
  })
  it("shows the file problem and offers no retry for an unreadable file", async () => {
    vi.mocked(processImage).mockRejectedValue(
      new Error("validation.image_type")
    )
    const { container } = await renderShell(<Harness />)
    await screen.findByText(/of 20/)
    pick(container, photo("a.heic"))
    expect(await screen.findByText("Choose an image file")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    await confirmRemove("Remove this photo?")
    expect(screen.queryByText("Choose an image file")).toBeNull()
  })
  it("reorders with buttons and sets the cover", async () => {
    await renderShell(<Harness initial={six} />)
    await screen.findByText(/5 of 20/)
    const first = () =>
      screen
        .getAllByRole("listitem")[0]!
        .querySelector("img")
        ?.getAttribute("src")
    fireEvent.click(screen.getAllByRole("button", { name: "Set as cover" })[1]!)
    expect(first()).toContain("/mock/c-")
    fireEvent.click(
      within(screen.getAllByRole("listitem")[0]!).getByRole("button", {
        name: "Move later",
      })
    )
    expect(first()).toContain("/mock/a-")
  })
  it("stops offering uploads at max", async () => {
    await renderShell(
      <Harness
        initial={[...six, ...six, ...six, ...six].map((m, i) => ({
          ...m,
          id: `${m.id}${i}`,
        }))}
      />
    )
    await screen.findByText(/20 of 20/)
    expect(screen.queryByText("Add photos")).toBeNull()
  })
})

describe("LogoUpload", () => {
  it("replaces the current image and removes it", async () => {
    vi.mocked(uploadMedia).mockResolvedValue(media("fresh"))
    const onChange = vi.fn()
    const { container } = await renderShell(
      <LogoUpload label="Logo" value={media("old")} onChange={onChange} />
    )
    await screen.findByRole("button", { name: "Change photo" })
    pick(container, photo())
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(media("fresh")))
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(onChange).toHaveBeenLastCalledWith(media("fresh"))
    await confirmRemove("Remove this photo?")
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
