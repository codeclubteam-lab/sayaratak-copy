import { createFileRoute } from "@tanstack/react-router"

import { SignupFlow } from "@/features/auth/components/signup-flow"
import { authPage } from "@/features/auth/auth-page"
import { useAuthDone } from "@/features/auth/use-auth-done"

export const Route = createFileRoute("/$locale/auth/signup")({
  ...authPage("/auth/signup", "auth.signup_title", "auth.signup_helper"),
  component: SignupPage,
})

function SignupPage() {
  const { redirect } = Route.useSearch()
  return <SignupFlow onDone={useAuthDone(redirect)} redirect={redirect} />
}
