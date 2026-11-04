import type { ReactNode } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import type { SitePage } from "@sayaratak/shared/schemas/admin"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { pageQuery } from "../queries"
import { PageBody } from "./page-body"

// The route loader has put the page in the cache. `children` follow the body (the contact page adds its form and details).
export function SitePageView({
  slug,
  children,
}: {
  slug: SitePage["slug"]
  children?: ReactNode
}) {
  const { t, locale } = useT()
  const { data: page } = useSuspenseQuery(pageQuery(slug))
  const title = page.title[locale] || page.title.ar
  return (
    <div className="flex flex-col gap-6 pt-4 pb-12 md:pt-6">
      <Breadcrumbs
        items={[{ label: t("nav.home"), href: "/" }, { label: title }]}
      />
      <h1 className="text-page font-semibold">{title}</h1>
      <PageBody body={page.body[locale] || page.body.ar} />
      {children}
    </div>
  )
}
