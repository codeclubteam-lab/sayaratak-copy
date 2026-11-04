import { createFileRoute, redirect } from "@tanstack/react-router"

import { redirectSearch } from "@/features/auth/destination"
import { stepHref } from "@/features/onboarding/draft"
import { loadOnboarding } from "@/features/onboarding/guards"

// "Finish setting up" lands here: resume at the first step still open.
export const Route = createFileRoute("/$locale/onboarding/")({
  validateSearch: redirectSearch,
  beforeLoad: async (ctx) => {
    const { role, resume, target } = await loadOnboarding(ctx)
    throw redirect({
      href: stepHref(role, resume, ctx.context.locale, target),
    })
  },
})
