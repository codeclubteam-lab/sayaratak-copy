import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { usePrefs } from "@/lib/prefs"

// The logo file is a 250 x 250 canvas with the artwork in a band about twice as wide as it is tall, so a 2:1 box with `object-cover` shows just the artwork.
export function BrandLogo() {
  const { t, locale } = useT()
  const { dataSaver } = usePrefs()
  const image = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (image.current?.complete) setLoaded(image.current.naturalWidth > 0)
  }, [])
  return (
    <Link
      to="/$locale"
      params={{ locale }}
      preload={dataSaver ? false : "intent"}
      className="relative flex h-12 w-24 shrink-0 items-center rounded-lg"
    >
      <span
        className={`text-title font-semibold text-primary ${loaded ? "invisible" : ""}`}
      >
        {t("nav.brand")}
      </span>
      <span className="sr-only">{t("nav.home")}</span>
      <img
        ref={image}
        src="/sayaratak-logo.svg"
        width={96}
        height={48}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${loaded ? "" : "invisible"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </Link>
  )
}
