import { useT } from "@/lib/i18n/use-t"
import { usePrefs } from "@/lib/prefs"
import { ViewsScene } from "./views-scene"

// The real analytics page, captured at 2x without the sidebar, top bar and period select (so nothing in it looks clickable), showing three headline numbers, with screenshot-only polish: softer card shadows, a green area fill and a green contacts palette. It runs off the panel's end and bottom edges. Data saver gets the drawn views scene instead.
export function AnalyticsShot() {
  const { locale } = useT()
  const { dataSaver } = usePrefs()
  if (dataSaver) return <ViewsScene />
  return (
    <img
      src={`/images/auth/analytics-${locale}.webp`}
      alt=""
      loading="lazy"
      decoding="async"
      width={1268}
      height={900}
      className="absolute start-0 -top-22 h-auto w-[88rem] max-w-none rounded-ss-xl ring-1 ring-foreground/5"
    />
  )
}
