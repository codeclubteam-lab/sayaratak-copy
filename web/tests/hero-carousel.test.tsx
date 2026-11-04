import { act, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HeroCarousel } from "@/components/app/hero-carousel"
import { contrastWithWhite, type Slide } from "@/lib/slide"
import { renderShell } from "./shell-render"

const slide = (n: number, over: Partial<Slide> = {}): Slide => ({
  id: `s${n}`,
  kind: "house",
  title: `Slide ${n} title`,
  cta: { label: `Go ${n}`, href: `/en/page-${n}` },
  image: { src: `/mock/s${n}.webp`, alt: "" },
  ...over,
})
const make = (n: number) => Array.from({ length: n }, (_, i) => slide(i + 1))

const track = () => document.querySelector<HTMLElement>("[aria-live]")!
const section = () => document.querySelector("section")!
const dots = () => document.querySelectorAll<HTMLElement>("[data-dot]")
const active = () =>
  Array.from(dots()).findIndex((d) => d.getAttribute("aria-current") === "true")
// jsdom has no PointerEvent: a MouseEvent of the pointer type carries the coordinates.
const pointer = (
  el: Element,
  type: string,
  props: { clientX?: number; clientY?: number; pointerType?: string } = {}
) =>
  fireEvent(
    el,
    Object.assign(
      new MouseEvent(type, { bubbles: true, ...props }),
      props.pointerType ? { pointerType: props.pointerType } : {}
    )
  )
const swipe = (dx: number, dy = 0) => {
  pointer(section(), "pointerdown", { clientX: 200, clientY: 100 })
  pointer(section(), "pointerup", { clientX: 200 + dx, clientY: 100 + dy })
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("HeroCarousel structure", () => {
  it("has one dot per slide whatever the count", async () => {
    const { rerender } = await renderShell(<HeroCarousel slides={make(3)} />)
    expect(dots()).toHaveLength(3)
    expect(screen.getAllByRole("group", { hidden: true })).toHaveLength(3)
    rerender(<HeroCarousel slides={make(5)} />)
    expect(dots()).toHaveLength(5)
  })

  it("shows no dots, pause button or timer for a single slide", async () => {
    await renderShell(<HeroCarousel slides={make(1)} />)
    expect(dots()).toHaveLength(0)
    expect(screen.queryByRole("button")).toBeNull()
    expect(document.querySelector(".carousel-fill")).toBeNull()
  })

  it("renders nothing without slides", async () => {
    await renderShell(<HeroCarousel slides={[]} />)
    expect(document.querySelector("section")).toBeNull()
  })

  it("names the carousel and every slide, hides the inactive ones and keeps their links out of the tab order", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    expect(section().getAttribute("aria-roledescription")).toBe("carousel")
    const groups = screen.getAllByRole("group", { hidden: true })
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
      "1 of 3",
      "2 of 3",
      "3 of 3",
    ])
    expect(groups.map((g) => g.getAttribute("aria-hidden"))).toEqual([
      "false",
      "true",
      "true",
    ])
    expect(groups.map((g) => g.hasAttribute("inert"))).toEqual([
      false,
      true,
      true,
    ])
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })

  it("uses an h1 for the first slide and h2 for the rest, or h2 first on request", async () => {
    const { rerender } = await renderShell(<HeroCarousel slides={make(3)} />)
    const levels = () =>
      screen
        .getAllByRole("heading", { hidden: true })
        .map((h) => h.tagName.toLowerCase())
    expect(levels()).toEqual(["h1", "h2", "h2"])
    rerender(<HeroCarousel slides={make(3)} firstHeading="h2" />)
    expect(levels()).toEqual(["h2", "h2", "h2"])
  })

  it("loads the first image at high priority and the others lazily", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    const imgs = Array.from(document.querySelectorAll("img"))
    expect(imgs.map((i) => i.getAttribute("fetchpriority"))).toEqual([
      "high",
      null,
      null,
    ])
    expect(imgs.map((i) => i.getAttribute("loading"))).toEqual([
      "eager",
      "lazy",
      "lazy",
    ])
  })

  it("replaces only the slide whose image fails with the icon look", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    fireEvent.error(document.querySelectorAll("img")[1]!)
    expect(document.querySelectorAll("img")).toHaveLength(2)
    expect(document.querySelectorAll("svg[stroke-width='1']")).toHaveLength(1)
  })

  it("shows the icon look for a slide without an image", async () => {
    await renderShell(
      <HeroCarousel
        slides={[slide(1, { image: undefined, icon: "truck" }), slide(2)]}
      />
    )
    expect(document.querySelectorAll("img")).toHaveLength(1)
    expect(document.querySelector("svg.lucide-truck")).toBeTruthy()
  })
})

describe("HeroCarousel motion and input", () => {
  it("moves with one translate variable and a dot click", async () => {
    await renderShell(<HeroCarousel slides={make(4)} />)
    expect(track().style.getPropertyValue("--i")).toBe("0")
    fireEvent.click(dots()[2]!)
    expect(track().style.getPropertyValue("--i")).toBe("2")
    expect(active()).toBe(2)
    expect(screen.getByRole("link").getAttribute("href")).toBe("/en/page-3")
  })

  it("advances when the active dot's fill ends and wraps at the last slide", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    const end = () =>
      fireEvent.animationEnd(document.querySelector(".carousel-fill")!)
    end()
    expect(active()).toBe(1)
    end()
    end()
    expect(active()).toBe(0)
  })

  it("steps with the arrow keys and focuses the new dot", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    fireEvent.keyDown(dots()[0]!, { key: "ArrowRight" })
    expect(active()).toBe(1)
    expect(document.activeElement).toBe(dots()[1])
    fireEvent.keyDown(dots()[1]!, { key: "ArrowLeft" })
    fireEvent.keyDown(dots()[0]!, { key: "ArrowLeft" })
    expect(active()).toBe(2)
  })

  it("reverses the arrow keys and the translate in Arabic", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />, { locale: "ar" })
    fireEvent.keyDown(dots()[0]!, { key: "ArrowLeft" })
    expect(active()).toBe(1)
    fireEvent.keyDown(dots()[1]!, { key: "ArrowRight" })
    expect(active()).toBe(0)
    expect(track().className).toContain("rtl:translate-x-[calc(var(--i)*100%)]")
  })

  it("swipes at 50 px, ignores less and mostly vertical moves, and reverses in Arabic", async () => {
    const { unmount } = await renderShell(<HeroCarousel slides={make(3)} />)
    swipe(-49)
    expect(active()).toBe(0)
    swipe(-60, 90)
    expect(active()).toBe(0)
    swipe(-50)
    expect(active()).toBe(1)
    swipe(80)
    expect(active()).toBe(0)
    unmount()
    await renderShell(<HeroCarousel slides={make(3)} />, { locale: "ar" })
    swipe(80)
    expect(active()).toBe(1)
    swipe(-80)
    expect(active()).toBe(0)
  })

  it("does not follow the link under a swipe", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    swipe(-80)
    const clicked = fireEvent.click(screen.getByRole("link"))
    expect(clicked).toBe(false)
    expect(fireEvent.click(screen.getByRole("link"))).toBe(true)
  })
})

describe("HeroCarousel autoplay holds", () => {
  const paused = () => section().hasAttribute("data-paused")

  it("toggles with the pause button and announces politely only when paused", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    expect(paused()).toBe(false)
    expect(track().getAttribute("aria-live")).toBe("off")
    fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }))
    expect(paused()).toBe(true)
    expect(track().getAttribute("aria-live")).toBe("polite")
    fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }))
    expect(paused()).toBe(false)
    expect(track().getAttribute("aria-live")).toBe("off")
  })

  it("holds on mouse hover but not on touch", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    pointer(section(), "pointerover", { pointerType: "touch" })
    expect(paused()).toBe(false)
    pointer(section(), "pointerover", { pointerType: "mouse" })
    expect(paused()).toBe(true)
    pointer(section(), "pointerout", { pointerType: "mouse" })
    expect(paused()).toBe(false)
  })

  it("holds while the keyboard focus is inside and lets go when it leaves", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    act(() => dots()[1]!.focus())
    vi.spyOn(dots()[1]!, "matches").mockReturnValue(true)
    fireEvent.focus(dots()[1]!)
    expect(paused()).toBe(true)
    fireEvent.blur(dots()[1]!, { relatedTarget: dots()[2]! })
    expect(paused()).toBe(true)
    fireEvent.blur(dots()[2]!, { relatedTarget: document.body })
    expect(paused()).toBe(false)
  })

  it("holds while the tab is hidden and resumes when it shows again", async () => {
    await renderShell(<HeroCarousel slides={make(3)} />)
    const hide = (value: boolean) => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value,
      })
      fireEvent(document, new Event("visibilitychange"))
    }
    hide(true)
    expect(paused()).toBe(true)
    hide(false)
    expect(paused()).toBe(false)
  })

  it("starts paused under reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await renderShell(<HeroCarousel slides={make(3)} />)
    expect(paused()).toBe(true)
    expect(screen.getByRole("button", { name: "Play slideshow" })).toBeTruthy()
  })
})

describe("HeroCarousel ads and callbacks", () => {
  const ads = [
    slide(1),
    slide(2, { kind: "ad", advertiser: "Nile Motors" }),
    slide(3),
  ]

  it("tags an ad, marks its link sponsored and gives house links no rel", async () => {
    await renderShell(<HeroCarousel slides={ads} />)
    const groups = screen.getAllByRole("group", { hidden: true })
    expect(groups.map((g) => g.textContent.includes("Ad"))).toEqual([
      false,
      true,
      false,
    ])
    fireEvent.click(dots()[1]!)
    const link = screen.getByRole("link", { name: /Go 2/ })
    expect(link.getAttribute("rel")).toBe("sponsored noopener")
    expect(link.className).toContain("md:bg-deep-foreground")
    fireEvent.click(dots()[0]!)
    const house = screen.getByRole("link", { name: /Go 1/ })
    expect(house.getAttribute("rel")).toBeNull()
    expect(house.className).toContain("md:border")
  })

  it("calls onClick with the slide on its button", async () => {
    const onClick = vi.fn()
    await renderShell(<HeroCarousel slides={ads} onClick={onClick} />)
    fireEvent.click(dots()[1]!)
    fireEvent.click(screen.getByRole("link", { name: /Go 2/ }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(ads[1])
  })

  it("fires onImpression once after a second on a slide, not on a skipped one", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const onImpression = vi.fn()
    await renderShell(<HeroCarousel slides={ads} onImpression={onImpression} />)
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(onImpression).not.toHaveBeenCalled()
    fireEvent.click(dots()[1]!)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    fireEvent.click(dots()[2]!)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onImpression).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(onImpression).toHaveBeenCalledOnce()
    expect(onImpression).toHaveBeenCalledWith(ads[2])
    fireEvent.click(dots()[1]!)
    fireEvent.click(dots()[2]!)
    fireEvent.click(dots()[1]!)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onImpression).toHaveBeenCalledTimes(2)
    expect(onImpression).toHaveBeenLastCalledWith(ads[1])
  })
})

describe("slide background contrast", () => {
  it("measures white text on a color", () => {
    expect(contrastWithWhite("#ffffff")).toBeCloseTo(1, 1)
    expect(contrastWithWhite("#000")).toBeCloseTo(21, 0)
    expect(contrastWithWhite("rgb(0, 0, 0)")).toBeCloseTo(21, 0)
    expect(contrastWithWhite("oklch(0.27 0.05 163)")).toBeNull()
  })

  it("drops a background below 4.5:1 and keeps a dark one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await renderShell(
      <HeroCarousel
        slides={[
          slide(1, { background: "#f5c542" }),
          slide(2, { background: "#1b4332" }),
          slide(3, { background: "var(--primary)" }),
        ]}
      />
    )
    const groups = screen.getAllByRole("group", { hidden: true })
    expect(groups.map((g) => g.style.getPropertyValue("--slide-bg"))).toEqual([
      "",
      "#1b4332",
      "var(--primary)",
    ])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
