import { useEffect } from "react"
import { useRouter } from "@tanstack/react-router"

import type { Locale } from "@sayaratak/shared/schemas/locale"

// Every internal link in the app is a plain anchor, so it also reaches routes built in later phases. This one listener turns a plain click on a same-language link into a client navigation: the header, banner, filters and scroll position survive instead of a full page load. New tab, download, modifier-key and same-page hash clicks stay native, and so does the language switch (another locale prefix), which has to reload the document.
export function ClientLinks({ locale }: { locale: Locale }) {
  const router = useRouter()
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]")
      if (
        !a ||
        (a.target && a.target !== "_self") ||
        a.hasAttribute("download")
      )
        return
      const url = new URL(a.href)
      const base = `/${locale}`
      const internal =
        url.origin === location.origin &&
        (url.pathname === base || url.pathname.startsWith(`${base}/`))
      const samePage =
        url.pathname === location.pathname && url.search === location.search
      if (!internal || samePage) return
      e.preventDefault()
      router.history.push(url.pathname + url.search + url.hash)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [router, locale])
  return null
}
