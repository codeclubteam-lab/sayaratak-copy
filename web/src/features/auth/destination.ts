import { z } from "zod"

import { dashboardPath, localeHref, safeRedirect } from "@/lib/navigation"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { User } from "@sayaratak/shared/schemas/user"

// The `redirect` search param of /auth and the onboarding pages: a path on this site, else nothing.
export const redirectSearch = z.object({
  redirect: z.string().optional().transform(safeRedirect).catch(undefined),
})

export const withRedirect = (path: string, redirect?: string) =>
  redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path

// Where a page-mode sign in lands: a finished account goes to the `redirect` target, else its dashboard. A new account goes to role selection first and the target waits at the end of onboarding.
export function signInDestination(
  me: User,
  redirect: string | undefined,
  locale: Locale
) {
  return localeHref(
    me.onboardingDone
      ? (redirect ?? dashboardPath(me.role))
      : withRedirect("/onboarding/role", redirect),
    locale
  )
}
