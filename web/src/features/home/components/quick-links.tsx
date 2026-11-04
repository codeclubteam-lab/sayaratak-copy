import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { typeSlug } from "@/features/search/landing"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"

// Text links under the search card: the first four enabled vehicle types, then Parts. Each goes to its landing page.
export function QuickLinks() {
  const { t, locale } = useT()
  const types = (useQuery(taxonomyQuery).data?.vehicleTypes ?? [])
    .filter((v) => v.enabled)
    .slice(0, 4)
  const links = [
    ...types.map((v) => ({
      key: v.id,
      label: v.name[locale],
      path: `/vehicles/${typeSlug(v.id)}/sale`,
    })),
    { key: "parts", label: t("nav.parts"), path: "/parts" },
  ]
  return (
    <nav aria-label={t("home.quick_links")}>
      <ul className="flex flex-wrap gap-x-5">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={localeHref(link.path, locale)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-ui font-medium hover:text-primary md:min-h-9"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
