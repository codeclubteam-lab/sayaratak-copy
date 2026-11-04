import { ChevronDown } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref, marketplaceLinks, serviceLinks } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShellLink } from "./shell-link"

export function PrimaryNav() {
  const { t, locale } = useT()
  return (
    <nav
      aria-label={t("nav.marketplace")}
      className="hidden shrink-0 items-center gap-6 lg:flex"
    >
      {marketplaceLinks.map((link) => (
        <ShellLink
          key={link.key}
          path={link.path}
          className="inline-flex min-h-10 items-center rounded-lg text-[14px] leading-5 font-medium hover:text-primary"
        >
          {t(link.key)}
        </ShellLink>
      ))}
      <div className="lg:flex xl:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="px-0 text-[14px] leading-5" />
            }
          >
            {t("nav.services")}
            <ChevronDown
              className="size-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-48">
            {serviceLinks.map((link) => (
              <DropdownMenuItem
                key={link.key}
                className="min-h-10"
                render={<a href={localeHref(link.path, locale)} />}
              >
                {t(link.key)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {serviceLinks.map((link) => (
        <ShellLink
          key={link.key}
          path={link.path}
          className="hidden min-h-10 items-center rounded-lg text-[14px] leading-5 font-medium hover:text-primary xl:inline-flex"
        >
          {t(link.key)}
        </ShellLink>
      ))}
    </nav>
  )
}
