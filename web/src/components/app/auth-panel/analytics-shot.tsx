import { useT } from "@/lib/i18n/use-t"
import { usePrefs } from "@/lib/prefs"
import { ViewsScene } from "./views-scene"

// The real analytics page, captured at 2x without the sidebar, top bar and period select (so nothing in it looks clickable), showing three headline numbers. The static images use blue chart colors and preserve green success figures. It runs off the panel's end and bottom edges. Data saver gets the drawn views scene instead.
export function AnalyticsShot() {
  const { locale } = useT()
  const { dataSaver } = usePrefs()
  if (dataSaver) return <ViewsScene />
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={`/images/auth/analytics-${locale}.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        width={1268}
        height={900}
        className="-mt-16 h-auto w-[72rem] max-w-none md:-mt-22 md:w-[88rem]"
      />
    </div>
  )
}
