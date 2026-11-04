import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { ApiError } from "@/lib/api/client"
import { buildHead } from "@/lib/seo"
import type { SitePage } from "@sayaratak/shared/schemas/admin"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { bodySummary } from "./body"
import { pageQuery } from "./queries"

// The title and description come from the page the admin edits, in the visitor's language.
export async function pageLoader(
  { queryClient, locale }: { queryClient: QueryClient; locale: Locale },
  slug: SitePage["slug"]
) {
  const page = await queryClient
    .ensureQueryData(pageQuery(slug))
    .catch((error: unknown) => {
      throw error instanceof ApiError && error.status === 404
        ? notFound()
        : error
    })
  return {
    locale,
    slug,
    title: page.title[locale] || page.title.ar,
    description: bodySummary(page.body[locale] || page.body.ar),
  }
}

export const pageHead = (
  data: Awaited<ReturnType<typeof pageLoader>> | undefined
) => (data ? buildHead({ ...data, path: `/${data.slug}` }) : {})
