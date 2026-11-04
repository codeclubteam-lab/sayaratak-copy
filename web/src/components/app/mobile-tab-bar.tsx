import { useQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"
import { Home, MessageSquare, Plus, Search, UserRound } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import {
  dashboardPath,
  messagesPath,
  localeHref,
  personalHref,
  postPath,
} from "@/lib/navigation"
import { meQuery } from "@/features/auth/me-query"

export function MobileTabBar() {
  const { t, locale } = useT()
  const pathname = useLocation({ select: (location) => location.pathname })
  const { data: me = null } = useQuery(meQuery)
  if (
    /^\/(?:ar|en)\/(?:account|dealer|workshop|mechanic|admin|post|onboarding)(?:\/|$)/.test(
      pathname
    )
  )
    return null
  const base = dashboardPath(me?.role)
  const post = postPath(me?.role)
  const tabs = [
    { key: "nav.home", href: localeHref("/", locale), icon: Home },
    { key: "common.search", href: localeHref("/search", locale), icon: Search },
    ...(post
      ? [{ key: "nav.post", href: localeHref(post, locale), icon: Plus }]
      : []),
    {
      key: "nav.messages",
      href: personalHref(messagesPath(me?.role), locale, me),
      icon: MessageSquare,
    },
    {
      key: "nav.account",
      href: personalHref(base, locale, me),
      icon: UserRound,
    },
  ]
  return (
    <nav
      aria-label={t("nav.mobile_tabs")}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) flex bg-card pb-[env(safe-area-inset-bottom)] [view-transition-name:tab-bar] md:hidden [body:has([data-mobile-contact-bar])_&]:hidden"
    >
      {tabs.map(({ key, href, icon: Icon }) => (
        <a
          key={key}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={`flex h-14 min-w-0 flex-1 press flex-col items-center justify-center gap-1 rounded-lg text-caption font-medium hover:bg-muted ${pathname === href ? "text-primary" : "text-muted-foreground"}`}
        >
          <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
          <span className="max-w-full truncate">{t(key)}</span>
        </a>
      ))}
    </nav>
  )
}
