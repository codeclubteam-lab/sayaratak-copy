import { useLocation, useRouter } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"

export function LanguageSwitcher() {
  // The name is the visible text in the target language (`lang` below), so voice control and screen readers agree.
  const { t, locale } = useT()
  const router = useRouter()
  // Parsed locations normalize repeated params into JSON arrays; the history keeps the original URL.
  const href = useLocation({ select: () => router.history.location.href })
  const target = locale === "ar" ? "en" : "ar"
  return (
    <a
      href={localeHref(href, target)}
      hrefLang={target}
      lang={target}
      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-ui font-medium hover:bg-muted md:h-10 md:min-w-10"
    >
      {t(`nav.language_${target}`)}
    </a>
  )
}
