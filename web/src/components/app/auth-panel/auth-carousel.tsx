import { useEffect, useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { HeroCarouselControls } from "../hero-carousel-controls"
import { AnalyticsShot } from "./analytics-shot"
import { InboxScene } from "./inbox-scene"
import { ListingScene } from "./listing-scene"
import { PlanScene } from "./plan-scene"

const slides = [
  { id: "views", Scene: AnalyticsShot },
  { id: "plan", Scene: PlanScene },
  { id: "listing", Scene: ListingScene },
  { id: "inbox", Scene: InboxScene },
]

// The auth side panel: four slides (a headline and a picture of the product: the real analytics page, then three drawn scenes) that cross fade. Autoplay works as the home hero's: the active dot's CSS fill is the timer, it holds on hover, keyboard focus, a hidden tab and the pause button, and starts paused under reduced motion. The scenes are pictures (aria-hidden, no buttons), so nothing in them reads as clickable.
export function AuthCarousel() {
  const { t } = useT()
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const paused = userPaused || hovered || focused || hidden

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setUserPaused(true)
    const sync = () => setHidden(document.hidden)
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  const fade = (active: boolean) =>
    `col-start-1 row-start-1 transition-opacity duration-(--dur-sheet) ease-(--ease-standard) ${active ? "opacity-100" : "opacity-0"}`
  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("auth.panel_label")}
      data-paused={paused ? "" : undefined}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        aria-live={paused ? "polite" : "off"}
        className="grid ps-12 pe-12 pt-24"
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={t("auth.slide_label", {
              number: i + 1,
              total: slides.length,
            })}
            aria-hidden={i !== index}
            className={`${fade(i === index)} flex max-w-lg flex-col gap-4`}
          >
            <p className="text-title font-semibold">
              {t(`auth.slide_${s.id}_title`)}
            </p>
            <p className="text-body text-muted-foreground">
              {t(`auth.slide_${s.id}_text`)}
            </p>
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className="relative ms-12 mt-12 min-h-0 flex-1 overflow-hidden rounded-xl"
      >
        {slides.map((s, i) => (
          <div key={s.id} className={`absolute inset-0 ${fade(i === index)}`}>
            <s.Scene />
          </div>
        ))}
      </div>
      <HeroCarouselControls
        ids={slides.map((s) => s.id)}
        index={index}
        playing={!userPaused}
        onSelect={setIndex}
        onAdvance={() => setIndex((index + 1) % slides.length)}
        onToggle={() => setUserPaused(!userPaused)}
        className="my-8 ms-12 self-start bg-foreground/70"
      />
    </section>
  )
}
