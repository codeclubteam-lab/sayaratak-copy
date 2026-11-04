import { PauseIcon, PlayIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"

const ring =
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-deep-foreground"

// One dot per slide (28 x 24 px hit area) and the pause button, on a dark chip so they read over any photo. The active dot is a pill whose fill is the autoplay timer: its `animationend` moves on (see `carousel-fill` in styles.css).
export function HeroCarouselControls({
  ids,
  index,
  playing,
  onSelect,
  onAdvance,
  onToggle,
  className = "absolute end-3 top-3 z-20 md:end-4 md:top-4",
}: {
  ids: string[]
  index: number
  playing: boolean
  onSelect: (index: number) => void
  onAdvance: () => void
  onToggle: () => void
  // Where the chip sits; the default is the hero's top end corner.
  className?: string
}) {
  const { t } = useT()
  return (
    <div
      className={cn(
        "flex items-center rounded-full bg-deep/70 px-1 text-deep-foreground",
        className
      )}
    >
      {ids.map((id, i) => (
        <button
          key={id}
          type="button"
          data-dot=""
          aria-label={t("nav.go_to_slide", { number: i + 1 })}
          aria-current={i === index ? "true" : undefined}
          onClick={() => onSelect(i)}
          className={cn("grid size-11 place-items-center rounded-full", ring)}
        >
          <span
            className={cn(
              "relative block h-2 overflow-hidden rounded-full",
              i === index
                ? "w-6 bg-deep-foreground/40"
                : "w-2 bg-deep-foreground/70"
            )}
          >
            {i === index && (
              <span className="carousel-fill" onAnimationEnd={onAdvance} />
            )}
          </span>
        </button>
      ))}
      <button
        type="button"
        aria-label={t(playing ? "nav.carousel_pause" : "nav.carousel_play")}
        onClick={onToggle}
        className={cn("grid size-11 place-items-center rounded-full", ring)}
      >
        {playing ? (
          <PauseIcon aria-hidden className="size-3.5 fill-current" />
        ) : (
          <PlayIcon aria-hidden className="size-3.5 fill-current" />
        )}
      </button>
    </div>
  )
}
