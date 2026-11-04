import { createFileRoute, redirect } from "@tanstack/react-router"

import { redirectSearch, withRedirect } from "@/features/auth/destination"
import { localeHref } from "@/lib/navigation"

// The old single sign in page; links to it land on log in.
export const Route = createFileRoute("/$locale/auth/")({
  validateSearch: redirectSearch,
  beforeLoad: ({ context, search }) => {
    throw redirect({
      href: localeHref(
        withRedirect("/auth/login", search.redirect),
        context.locale
      ),
    })
  },
})
