import { createFileRoute, redirect } from "@tanstack/react-router"

import { redirectSearch } from "@/features/auth/destination"
import { requireUser } from "@/features/auth/guards"
import { draftQuery } from "@/features/auth/queries"
import { RoleForm } from "@/features/onboarding/components/role-form"
import { roleDraftKey } from "@/features/onboarding/schemas"
import { getCopy } from "@/lib/i18n/server"
import { dashboardPath, localeHref } from "@/lib/navigation"
import { buildHead } from "@/lib/seo"

export const Route = createFileRoute("/$locale/onboarding/role")({
  validateSearch: redirectSearch,
  // Signed in, onboarding not finished. A finished account goes to the `redirect` target, else its dashboard.
  beforeLoad: (ctx) => {
    const me = requireUser(ctx)
    if (me.onboardingDone)
      throw redirect({
        href: localeHref(
          ctx.search.redirect ?? dashboardPath(me.role),
          ctx.context.locale
        ),
      })
  },
  loader: async ({ context }) => {
    const [[title = "", description = ""]] = await Promise.all([
      getCopy({
        data: {
          locale: context.locale,
          keys: ["onboarding.role_title", "onboarding.role_description"],
        },
      }),
      context.queryClient.ensureQueryData(draftQuery(roleDraftKey)),
    ])
    return { title, description, locale: context.locale }
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildHead({ ...loaderData, path: "/onboarding/role", noindex: true })
      : {},
  component: function Role() {
    return <RoleForm redirect={Route.useSearch().redirect} />
  },
})
