import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import { redirectSearch, withRedirect } from "@/features/auth/destination"
import { draftQuery } from "@/features/auth/queries"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import { stepHref } from "@/features/onboarding/draft"
import { flows, isRole } from "@/features/onboarding/flows"
import { loadOnboarding } from "@/features/onboarding/guards"
import { onboardingDraftKey } from "@/features/onboarding/schemas"
import { taxonomyQuery } from "@/features/listings/queries"
import { getCopy } from "@/lib/i18n/server"
import { localeHref } from "@/lib/navigation"
import { buildHead } from "@/lib/seo"

export const Route = createFileRoute("/$locale/onboarding/$role/$step")({
  validateSearch: redirectSearch,
  // A step opens only for the chosen role and once every earlier required step is saved; otherwise the person goes back to where they left off.
  beforeLoad: async (ctx) => {
    if (!isRole(ctx.params.role)) throw notFound()
    const { role, steps, reach, resume, target } = await loadOnboarding(ctx)
    const { locale } = ctx.context
    if (role !== ctx.params.role)
      throw redirect({
        href: localeHref(withRedirect("/onboarding/role", target), locale),
      })
    const index = steps.findIndex((s) => s.id === ctx.params.step)
    if (index < 0) throw notFound()
    if (index > reach)
      throw redirect({ href: stepHref(role, resume, locale, target) })
  },
  loader: async ({ context, params }) => {
    const step = isRole(params.role)
      ? flows[params.role].find((s) => s.id === params.step)
      : undefined
    if (!isRole(params.role) || !step) throw notFound()
    const [[title = "", description = ""]] = await Promise.all([
      getCopy({
        data: {
          locale: context.locale,
          keys: [step.titleKey, step.helperKey],
        },
      }),
      context.queryClient.ensureQueryData(
        draftQuery(onboardingDraftKey(params.role))
      ),
      context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return { title, description, locale: context.locale }
  },
  head: ({ loaderData, params }) =>
    loaderData
      ? buildHead({
          ...loaderData,
          path: `/onboarding/${params.role}/${params.step}`,
          noindex: true,
        })
      : {},
  component: function OnboardingStep() {
    const { role, step } = Route.useParams()
    const search = Route.useSearch()
    return isRole(role) ? (
      <OnboardingStepPage
        role={role}
        stepId={step}
        redirect={search.redirect}
      />
    ) : null
  },
})
