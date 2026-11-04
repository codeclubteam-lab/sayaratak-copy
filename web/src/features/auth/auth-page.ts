import { redirect } from "@tanstack/react-router"

import { getCopy } from "@/lib/i18n/server"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { User } from "@sayaratak/shared/schemas/user"
import { buildHead } from "@/lib/seo"
import { redirectSearch, signInDestination } from "./destination"

type Ctx = { context: { me: User | null; locale: Locale } }

// Search, guard, title and head shared by /auth/login, /auth/signup and /auth/forgot. A signed-in visitor has nothing to do there.
export const authPage = (path: string, titleKey: string, textKey: string) => ({
  validateSearch: redirectSearch,
  beforeLoad: ({
    context,
    search,
  }: Ctx & { search: { redirect?: string } }) => {
    if (context.me)
      throw redirect({
        href: signInDestination(context.me, search.redirect, context.locale),
      })
  },
  loader: async ({ context }: Ctx) => {
    const [title = "", description = ""] = await getCopy({
      data: { locale: context.locale, keys: [titleKey, textKey] },
    })
    return { title, description, locale: context.locale }
  },
  head: ({
    loaderData,
  }: {
    loaderData?: { title: string; description: string; locale: Locale }
  }) => (loaderData ? buildHead({ ...loaderData, path, noindex: true }) : {}),
})
