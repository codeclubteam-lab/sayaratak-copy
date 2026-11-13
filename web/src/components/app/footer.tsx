import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useRouter } from "@tanstack/react-router"
import { Mail, Phone } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref, marketplaceLinks, serviceLinks } from "@/lib/navigation"
import { toWhatsappUrl } from "@sayaratak/shared/lib/phone"
import { siteQuery } from "@/features/pages/queries"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BrandIcon } from "./brand-icon"
import { BrandLogo } from "./brand-logo"
import { LanguageSwitcher } from "./language-switcher"
import { ShellLink } from "./shell-link"
import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  XIcon,
  YoutubeIcon,
} from "./social-icons"

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
  const { t, locale } = useT()
  const router = useRouter()
  const href = useLocation({ select: () => router.history.location.href })
  const targetLocale = locale === "ar" ? "en" : "ar"
  const switchHref = localeHref(href, targetLocale)
  const { data, isPending, isError, refetch } = useQuery(siteQuery)
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    if (!isPending) return
    const timeout = window.setTimeout(() => setDelayed(true), 150)
    return () => window.clearTimeout(timeout)
  }, [isPending])
  const contact = data?.contact
  return (
    <footer className="mt-8 overflow-hidden rounded-xl bg-card pt-8 [view-transition-name:site-footer] md:mt-12 md:pt-12">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-2">
            <BrandLogo />
            <p className="text-caption">
              <span className="text-muted-foreground">
                {t("nav.brand_tagline")}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {isPending && delayed && (
              <Skeleton
                aria-label={t("nav.loading_contact")}
                className="h-10 w-72 max-w-full"
              />
            )}
            {contact && (
              <address className="flex flex-wrap items-center gap-2.5 not-italic">
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3.5 py-2 text-ui text-foreground hover:bg-muted/80 md:min-h-10"
                  >
                    <Phone
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <bdi>{contact.phone}</bdi>
                  </a>
                )}
                {contact.whatsapp && (
                  <a
                    href={toWhatsappUrl(contact.whatsapp)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3.5 py-2 text-ui text-foreground hover:bg-muted/80 md:min-h-10"
                  >
                    <BrandIcon
                      name="whatsapp"
                      className="size-4 shrink-0 text-[#25d366]"
                    />
                    <span>{t("nav.whatsapp")}</span>
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3.5 py-2 text-ui text-foreground hover:bg-muted/80 md:min-h-10"
                  >
                    <Mail
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <bdi>{contact.email}</bdi>
                  </a>
                )}
              </address>
            )}
            {isError && (
              <div
                role="status"
                className="flex items-center gap-2 text-caption"
              >
                <span className="text-destructive">
                  {t("nav.contact_error")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void refetch()
                  }}
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}
            <LanguageSwitcher />
          </div>
        </div>

        <nav
          aria-label={t("nav.footer")}
          className="grid grid-cols-2 gap-x-8 gap-y-6 py-8 md:grid-cols-4 md:py-10"
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

        <div className="border-t border-border pt-6 pb-8">
          <p className="text-caption text-muted-foreground">
            {t("nav.copyright")}
          </p>

          <hr className="my-4 border-t border-border/80" />

          <div className="flex flex-col gap-4 text-caption md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href={switchHref}
                hrefLang={targetLocale}
                lang={targetLocale}
                className="font-bold text-foreground transition-colors hover:text-primary"
              >
                {locale === "ar" ? "السودان / العربية" : "Sudan / English"}
              </a>
              <span className="text-muted-foreground/30" aria-hidden="true">
                |
              </span>
              <ShellLink
                path="/privacy"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {t("nav.privacy")}
              </ShellLink>
              <ShellLink
                path="/terms"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {t("nav.terms")}
              </ShellLink>
              <ShellLink
                path="/about"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {t("nav.about")}
              </ShellLink>
              <ShellLink
                path="/contact"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {t("nav.contact")}
              </ShellLink>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">
                {t("nav.stay_in_loop")}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary"
                >
                  <FacebookIcon className="size-4" />
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary"
                >
                  <XIcon className="size-3.5" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary"
                >
                  <InstagramIcon className="size-4" />
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary"
                >
                  <YoutubeIcon className="size-4" />
                </a>
                {contact?.whatsapp ? (
                  <a
                    href={toWhatsappUrl(contact.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:text-primary"
                  >
                    <WhatsappIcon className="size-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
