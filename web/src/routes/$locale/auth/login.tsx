import { createFileRoute } from "@tanstack/react-router"

import { LoginForm } from "@/features/auth/components/login-form"
import { authPage } from "@/features/auth/auth-page"
import { useAuthDone } from "@/features/auth/use-auth-done"

export const Route = createFileRoute("/$locale/auth/login")({
  ...authPage("/auth/login", "auth.login_title", "auth.login_helper"),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return <LoginForm onDone={useAuthDone(redirect)} redirect={redirect} />
}
