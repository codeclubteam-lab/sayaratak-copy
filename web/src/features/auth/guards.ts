import { redirect } from "@tanstack/react-router"

import { dashboardPath, localeHref, personalHref } from "@/lib/navigation"
import { withRedirect } from "./destination"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { User } from "@sayaratak/shared/schemas/user"

type Guard = {
  context: { me: User | null; locale: Locale }
  location: { href: string }
}

// Signed-out visitors go to the sign in page and come back to the page they asked for.
export function requireUser({ context, location }: Guard) {
  if (!context.me)
    throw redirect({
      href: personalHref(location.href, context.locale, null),
    })
  return context.me
}

// An unfinished account goes to onboarding and returns here. Another role goes to its own dashboard.
export const requireRole = (role: User["role"]) => (guard: Guard) => {
  const me = requireUser(guard)
  if (!me.onboardingDone)
    throw redirect({
      href: localeHref(
        withRedirect("/onboarding/role", guard.location.href),
        guard.context.locale
      ),
    })
  if (me.role !== role)
    throw redirect({
      href: localeHref(dashboardPath(me.role), guard.context.locale),
    })
}

// A banned account sees the suspended page and the static pages that carry the support contact.
const bannedAllowed =
  /^\/(?:ar|en)\/(?:suspended|about|contact|privacy|terms)\/?$/
export function redirectBanned(c: {
  me: User | null
  locale: Locale
  pathname: string
}) {
  if (c.me?.banned && !bannedAllowed.test(c.pathname))
    throw redirect({ href: localeHref("/suspended", c.locale) })
}
