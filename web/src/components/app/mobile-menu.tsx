import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Menu, X } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import {
  messagesPath,
  localeHref,
  marketplaceLinks,
  personalHref,
  postPath,
  serviceLinks,
} from "@/lib/navigation"
import { meQuery } from "@/features/auth/me-query"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { DataSaverToggle } from "./data-saver-toggle"
import { LanguageSwitcher } from "./language-switcher"
import { ShellLink } from "./shell-link"

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { t, locale } = useT()
  const { data: me = null } = useQuery(meQuery)
  const post = postPath(me?.role)
  const messages = messagesPath(me?.role)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t("nav.menu")}
          />
        }
      >
        <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="inline-start"
        showCloseButton={false}
        className="w-80 max-w-[calc(100%-48px)] gap-0 overflow-y-auto"
        aria-describedby={undefined}
      >
        <SheetHeader className="flex-row items-center justify-between">
          <SheetTitle>{t("nav.menu")}</SheetTitle>
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.close")}
              />
            }
          >
            <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </SheetClose>
        </SheetHeader>
        <nav aria-label={t("nav.marketplace")} className="flex flex-col px-4">
          {[
            { key: "common.search", path: "/search" },
            ...marketplaceLinks,
            ...serviceLinks,
          ].map((link) => (
            <ShellLink
              key={link.key}
              path={link.path}
              className="flex min-h-11 items-center rounded-lg px-3 text-ui font-medium hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              {t(link.key)}
            </ShellLink>
          ))}
          <a
            href={personalHref(messages, locale, me)}
            className="flex min-h-11 items-center rounded-lg px-3 text-ui font-medium hover:bg-muted"
          >
            {t("nav.messages")}
          </a>
        </nav>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <LanguageSwitcher />
          <DataSaverToggle expanded />
        </div>
        {post && (
          <a
            href={localeHref(post, locale)}
            className="mx-4 mb-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-ui font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("common.post_listing")}
          </a>
        )}
      </SheetContent>
    </Sheet>
  )
}
