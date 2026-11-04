import { useId } from "react"
import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { adminQueries } from "@/features/admin/queries"
import type { SitePage } from "@sayaratak/shared/schemas/admin"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { PageForm } from "./page-form"

// Loads the page, then hands it to the form; a save starts the form again from the saved values.
export function PageEditor({ slug }: { slug: SitePage["slug"] }) {
  const { t } = useT()
  const id = useId()
  const page = useQuery(adminQueries.page(slug))
  const title = t(`nav.${slug}`)
  if (page.isError && !page.data)
    return (
      <SectionError
        title={title}
        message={t("admin.pages_error")}
        onRetry={() => void page.refetch()}
      />
    )
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-title font-semibold">
        {title}
      </h2>
      {page.data ? (
        <PageForm key={page.data.updatedAt} page={page.data} />
      ) : (
        <div
          aria-hidden="true"
          className="flex flex-col gap-4 rounded-xl bg-card p-4"
        >
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      )}
    </section>
  )
}
