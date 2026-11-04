import { useState, type ReactNode } from "react"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { markSharedCover, motionAllowed, pageTransition } from "@/lib/motion"
import { MediaImage } from "@/components/app/media-image"
import { ResultsRegion } from "@/components/app/results-region"
import { SubmitButton } from "@/components/app/submit-button"
import { renderShell } from "./shell-render"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  document.documentElement.removeAttribute("data-data-saver")
  vi.restoreAllMocks()
})

describe("motionAllowed", () => {
  it("is true by default and false with data saver or reduced motion", () => {
    expect(motionAllowed()).toBe(true)
    document.documentElement.setAttribute("data-data-saver", "")
    expect(motionAllowed()).toBe(false)
    document.documentElement.removeAttribute("data-data-saver")
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList)
    expect(motionAllowed()).toBe(false)
  })

  it("starts a view transition only when the path changes", () => {
    expect(pageTransition.types({ pathChanged: true })).toEqual(["page"])
    expect(pageTransition.types({ pathChanged: false })).toBe(false)
    document.documentElement.setAttribute("data-data-saver", "")
    expect(pageTransition.types({ pathChanged: true })).toBe(false)
  })
})

describe("markSharedCover", () => {
  const holders = () => document.querySelectorAll("[data-shared-cover]").length
  const photo = () => {
    const el = document.createElement("div")
    document.body.append(el)
    return el
  }
  afterEach(() => (document.body.innerHTML = ""))

  it("keeps the name on one element: the pressed photo takes it from the old holder", () => {
    const cover = photo()
    markSharedCover(cover)
    const card = photo()
    markSharedCover(card)
    expect(holders()).toBe(1)
    expect(cover.style.viewTransitionName).toBe("")
    expect(card.style.viewTransitionName).toBe("listing-cover")
  })

  it("does nothing with data saver on or without a photo", () => {
    document.documentElement.setAttribute("data-data-saver", "")
    markSharedCover(photo())
    markSharedCover(null)
    expect(holders()).toBe(0)
  })
})

// Renders `children(on)` and flips `on` when "go" is pressed, inside the shell's providers.
function Flip({ children }: { children: (on: boolean) => ReactNode }) {
  const [on, setOn] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOn(true)}>
        go
      </button>
      {children(on)}
    </>
  )
}

describe("SubmitButton", () => {
  it("is disabled and busy at once, with the spinner only after 300 ms", async () => {
    await renderShell(
      <Flip>{(on) => <SubmitButton pending={on}>Save</SubmitButton>}</Flip>
    )
    fireEvent.click(screen.getByText("go"))
    const button = screen.getByRole("button", { name: "Save" })
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.hasAttribute("disabled")).toBe(true)
    expect(button.querySelector("svg")).toBeNull()
    await waitFor(() => expect(button.querySelector("svg")).not.toBeNull(), {
      timeout: 1000,
    })
    // The label keeps its place so the button never changes width.
    expect(screen.getByText("Save").className).toContain("opacity-0")
  })

  it("shows Saved with a check for 1.5 s after a successful save", async () => {
    await renderShell(
      <Flip>{(on) => <SubmitButton savedLabel={on}>Save</SubmitButton>}</Flip>
    )
    fireEvent.click(screen.getByText("go"))
    await waitFor(() =>
      expect(screen.getAllByText("Saved").length).toBeGreaterThan(0)
    )
    await wait(1700)
    expect(screen.getByText("Save")).toBeTruthy()
    expect(screen.queryByText("Saved")).toBeNull()
  })

  it("is secondary at rest and primary once its section is dirty", async () => {
    await renderShell(
      <Flip>{(on) => <SubmitButton dirty={on}>Save</SubmitButton>}</Flip>
    )
    const button = screen.getByRole("button", { name: "Save" })
    expect(button.className).toContain("bg-secondary")
    expect(button.className).not.toContain("bg-primary")
    fireEvent.click(screen.getByText("go"))
    await waitFor(() => expect(button.className).toContain("bg-primary"))
  })
})

describe("MediaImage", () => {
  it("fades non-priority images in on load and never fades priority ones", async () => {
    await renderShell(
      <>
        <MediaImage src="/mock/a-{w}.webp" alt="first" />
        <MediaImage src="/mock/b-{w}.webp" alt="second" priority />
      </>
    )
    const [fading, priority] = screen.getAllByRole("img", { hidden: true })
    expect(fading?.hasAttribute("data-fade")).toBe(true)
    expect(fading?.hasAttribute("data-loaded")).toBe(false)
    fireEvent.load(fading!)
    expect(fading?.hasAttribute("data-loaded")).toBe(true)
    expect(priority?.hasAttribute("data-fade")).toBe(false)
  })
})

describe("ResultsRegion", () => {
  it("dims stale results after 150 ms and marks the region busy", async () => {
    await renderShell(
      <Flip>
        {(on) => (
          <ResultsRegion stale={on}>
            <p>cards</p>
          </ResultsRegion>
        )}
      </Flip>
    )
    const region = screen.getByText("cards").parentElement!
    fireEvent.click(screen.getByText("go"))
    expect(region.getAttribute("aria-busy")).toBe("true")
    expect(region.className).not.toContain("opacity-60")
    await waitFor(() => expect(region.className).toContain("opacity-60"), {
      timeout: 1000,
    })
  })
})
