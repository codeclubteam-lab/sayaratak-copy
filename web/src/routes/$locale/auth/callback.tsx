import { createFileRoute } from "@tanstack/react-router"

import { authPage } from "@/features/auth/auth-page"
import { SocialCallbackPage } from "@/features/auth/components/social-callback-page"

export const Route = createFileRoute("/$locale/auth/callback")({
  ...authPage("/auth/callback", "auth.session_title", "auth.session_loading"),
  ssr: false,
  // Unlike a sign-in form, this route must finish on the client before redirecting.
  beforeLoad: undefined,
  component: CallbackPage,
})

function CallbackPage() {
  const { redirect, error } = Route.useSearch()
  return <SocialCallbackPage redirect={redirect} error={error} />
}
