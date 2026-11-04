import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react"

import { useT } from "@/lib/i18n/use-t"
import type { Slide } from "@/lib/slide"
import { clamp, isRtl } from "@/lib/utils"
import { HeroCarouselControls } from "./hero-carousel-controls"
import { HeroSlide } from "./hero-slide"

const SWIPE = 50
const IMPRESSION_MS = 1000

// A banner carousel: slides side by side, moved with one translateX. The CSS fill on the active dot is the only timer (it ends, the next slide shows), so nothing here counts seconds except the one-second ad impression. Autoplay holds on mouse hover, keyboard focus inside, a hidden tab and the pause button, and starts paused under reduced motion. Dots, swipe (50 px, vertical scroll still works) and the arrow keys all flip in Arabic.
// `onImpression` fires once per slide after it has been the active one for a second (the caller picks what to count); `onClick` fires on a slide's CTA. `firstHeading` is `h2` where the page already has its own h1.
export function HeroCarousel({
  slides,
  onImpression,
  onClick,
  firstHeading = "h1",
}: {
  slides: Slide[]
  onImpression?: (slide: Slide) => void
  onClick?: (slide: Slide) => void
  firstHeading?: "h1" | "h2"
}) {
  const { t, locale } = useT()
  const rtl = isRtl(locale)
  const count = slides.length
  const [selected, setSelected] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const seen = useRef(new Set<string>())
  const index = clamp(selected, 0, count - 1)
  const slide = slides[index]
  const paused = userPaused || hovered || focused || hidden

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setUserPaused(true)
    const sync = () => setHidden(document.hidden)
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  useEffect(() => {
    if (!slide || hidden || seen.current.has(slide.id)) return
    const timer = setTimeout(() => {
      seen.current.add(slide.id)
      onImpression?.(slide)
    }, IMPRESSION_MS)
    return () => clearTimeout(timer)
  }, [slide, hidden, onImpression])

  const step = (by: number) => setSelected((index + by + count) % count)

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (count < 2 || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return
    e.preventDefault()
    const next =
      (index + ((e.key === "ArrowRight") !== rtl ? 1 : -1) + count) % count
    setSelected(next)
    e.currentTarget.querySelectorAll<HTMLElement>("[data-dot]")[next]?.focus()
  }
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start || count < 2) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(e.clientY - start.y))
      return
    swiped.current = true
    step(dx > 0 === rtl ? 1 : -1)
  }

  if (!slide) return null
  const track: CSSProperties & Record<"--i", number> = { "--i": index }
  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("nav.carousel")}
      data-paused={paused ? "" : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY }
        swiped.current = false
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      onClickCapture={(e) => {
        if (!swiped.current) return
        swiped.current = false
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
      }}
      className="relative touch-pan-y overflow-hidden rounded-xl select-none md:rounded-xl"
    >
      <div
        aria-live={paused ? "polite" : "off"}
        style={track}
        className="flex aspect-[2/1] translate-x-[calc(var(--i)*-100%)] transition-transform duration-(--dur-sheet) ease-(--ease-standard) md:aspect-[3/1] rtl:translate-x-[calc(var(--i)*100%)]"
      >
        {slides.map((s, i) => (
          <HeroSlide
            key={s.id}
            slide={s}
            index={i}
            total={count}
            active={i === index}
            heading={i === 0 ? firstHeading : "h2"}
            onCtaClick={(clicked) => onClick?.(clicked)}
          />
        ))}
      </div>
      {count > 1 && (
        <HeroCarouselControls
          ids={slides.map((s) => s.id)}
          index={index}
          playing={!userPaused}
          onSelect={setSelected}
          onAdvance={() => step(1)}
          onToggle={() => setUserPaused(!userPaused)}
        />
      )}
    </section>
  )
}
