import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { marketplaceLinks, serviceLinks } from "@/lib/navigation"
import { toWhatsappUrl } from "@sayaratak/shared/lib/phone"
import { siteQuery } from "@/features/pages/queries"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BrandIcon } from "./brand-icon"
import { LanguageSwitcher } from "./language-switcher"
import { ShellLink } from "./shell-link"

const groups = [
  { key: "nav.marketplace", links: marketplaceLinks },
  { key: "nav.services", links: serviceLinks },
  {
    key: "nav.company",
    links: [
      { key: "nav.about", path: "/about" },
      { key: "nav.contact", path: "/contact" },
    ],
  },
  {
    key: "nav.legal",
    links: [
      { key: "nav.privacy", path: "/privacy" },
      { key: "nav.terms", path: "/terms" },
    ],
  },
]

export function Footer() {
  const { t } = useT()
  const { data, isPending, isError, refetch } = useQuery(siteQuery)
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    if (!isPending) return
    const timeout = window.setTimeout(() => setDelayed(true), 150)
    return () => window.clearTimeout(timeout)
  }, [isPending])
  const contact = data?.contact
  return (
    <footer className="mt-8 bg-card py-8 [view-transition-name:site-footer] md:mt-12 md:py-12">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <nav
          aria-label={t("nav.footer")}
          className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4"
        >
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="mb-2 text-ui font-semibold">{t(group.key)}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.key}>
                    <ShellLink
                      path={link.path}
                      className="inline-flex min-h-11 min-w-11 items-center rounded-lg text-ui text-muted-foreground hover:text-primary md:min-h-10"
                    >
                      {t(link.key)}
                    </ShellLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 text-ui">
            <h2 className="mb-2 font-semibold">{t("nav.contact")}</h2>
            {isPending && delayed && (
              <Skeleton
                aria-label={t("nav.loading_contact")}
                className="h-11 w-80 max-w-full"
              />
            )}
            {contact && (
              <address className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground not-italic">
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex min-h-11 items-center rounded-lg md:min-h-10"
                  >
                    <bdi>{contact.phone}</bdi>
                  </a>
                )}
                {contact.whatsapp && (
                  <a
                    href={toWhatsappUrl(contact.whatsapp)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg md:min-h-10"
                  >
                    <BrandIcon name="whatsapp" className="size-4" />
                    {t("nav.whatsapp")}
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex min-h-11 max-w-full items-center rounded-lg break-all md:min-h-10"
                  >
                    <bdi>{contact.email}</bdi>
                  </a>
                )}
                {contact.address && (
                  <span
                    dir="auto"
                    className="inline-flex min-h-11 items-center md:min-h-10"
                  >
                    {contact.address}
                  </span>
                )}
              </address>
            )}
            {isError && (
              <div role="status" className="max-w-sm">
                <p>{t("nav.contact_error")}</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void refetch()
                  }}
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  )
}
