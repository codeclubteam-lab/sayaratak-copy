import { useQuery } from "@tanstack/react-query"
import { Heart, MessageSquare, Search } from "lucide-react"

import { useSentinel } from "@/hooks/use-sentinel"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  messagesPath,
  localeHref,
  personalHref,
  postPath,
} from "@/lib/navigation"
import { meQuery } from "@/features/auth/me-query"
import { AccountMenu } from "./account-menu"
import { BrandLogo } from "./brand-logo"
import { DataSaverToggle } from "./data-saver-toggle"
import { LanguageSwitcher } from "./language-switcher"
import { MobileMenu } from "./mobile-menu"
import { NotificationBell } from "./notification-bell"
import { PrimaryNav } from "./primary-nav"
import { ShellLink } from "./shell-link"

export function Header() {
  const { t, locale } = useT()
  const { data: me = null } = useQuery(meQuery)
  const [sentinel, scrolled] = useSentinel<HTMLDivElement>()
  const post = postPath(me?.role)
  const messages = messagesPath(me?.role)
  const iconClass =
    "press size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted md:size-10"
  return (
    <>
      {/* The 1 px line shows once this marker has scrolled away. */}
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
      />
      <header
        className={`sticky top-0 z-(--z-sticky) bg-card [view-transition-name:site-header] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:motion-color ${scrolled ? "after:bg-border" : "after:bg-transparent"}`}
      >
        <div className="mx-auto flex h-14 items-center gap-2 px-4 md:px-6 lg:h-16 lg:gap-4">
          <MobileMenu />
          <BrandLogo />
          <PrimaryNav />
          <div className="ms-auto flex shrink-0 items-center">
            <div className="hidden items-center lg:flex">
              <ShellLink
                path="/search"
                label={t("common.search")}
                className={`inline-flex ${iconClass}`}
              >
                <Search
                  className="size-5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </ShellLink>
              <LanguageSwitcher />
              <DataSaverToggle />
            </div>
            <a
              href={personalHref("/account/favorites", locale, me)}
              aria-label={t("common.favorites")}
              className={`inline-flex ${iconClass}`}
            >
              <Heart className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </a>
            <NotificationBell />
            <a
              href={personalHref(messages, locale, me)}
              aria-label={t("nav.messages")}
              className={`${iconClass} hidden lg:inline-flex`}
            >
              <MessageSquare
                className="size-5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </a>
            <AccountMenu />
            {post && (
              <a
                href={localeHref(post, locale)}
                className={cn(buttonVariants(), "ms-2 hidden lg:inline-flex")}
              >
                {t("common.post_listing")}
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
