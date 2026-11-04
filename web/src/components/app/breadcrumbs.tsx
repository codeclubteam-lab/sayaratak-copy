import { Fragment } from "react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { origin } from "@/lib/seo"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type Crumb = { label: string; href?: string }

// The last item is the current page, so it is text. `href` is a path without the locale.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { t, locale } = useT()
  const base = origin()
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href && { item: base + localeHref(c.href, locale) }),
    })),
  }
  return (
    <Breadcrumb aria-label={t("common.breadcrumb")}>
      <BreadcrumbList>
        {items.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {c.href && i < items.length - 1 ? (
                <BreadcrumbLink href={localeHref(c.href, locale)}>
                  <bdi>{c.label}</bdi>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>
                  <bdi>{c.label}</bdi>
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
      {/* The origin differs between the server env and the browser, so the text may differ at hydration. */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(json).replace(/</g, "\\u003c"),
        }}
      />
    </Breadcrumb>
  )
}
