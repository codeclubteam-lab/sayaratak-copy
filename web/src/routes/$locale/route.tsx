import { Outlet, createFileRoute, notFound } from "@tanstack/react-router"

import { ClientLinks } from "@/components/app/client-links"
import { redirectBanned } from "@/features/auth/guards"
import { localeSchema } from "@sayaratak/shared/schemas/locale"

// Unknown locale segments are a 404. The `locale` cookie is set by the root loader (once per document).
export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params, context, location }) => {
    const locale = localeSchema.safeParse(params.locale)
    if (!locale.success) throw notFound()
    redirectBanned({
      me: context.me,
      locale: locale.data,
      pathname: location.pathname,
    })
    return { locale: locale.data }
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  return (
    <>
      <ClientLinks locale={Route.useRouteContext().locale} />
      <Outlet />
    </>
  )
}
