import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"

import { ShellLink } from "@/components/app/shell-link"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { localeHref, safeRedirect } from "@/lib/navigation"
import { markSignIn } from "@/lib/sign-in-flag"
import { meQuery } from "../me-query"
import { signInDestination, withRedirect } from "../destination"
import { AuthHeading } from "./auth-heading"
import { SessionStep } from "./session-step"

// Runs only on the OAuth return. An authenticated /me arms reminders before
// redirecting, without persisting the gate's pending action or any tokens.
export function SocialCallbackPage({
  redirect,
  error,
}: {
  redirect?: string
  error?: string
}) {
  const { t, locale } = useT()
  const router = useRouter()
  const handled = useRef(false)
  const me = useQuery({
    ...meQuery,
    staleTime: 0,
    retry: false,
    enabled: !error,
  })
  const login = localeHref(
    withRedirect("/auth/login", safeRedirect(redirect)),
    locale
  )
  useEffect(() => {
    if (error || me.isFetching || !me.isSuccess || handled.current) return
    handled.current = true
    if (me.data) {
      markSignIn()
      router.history.replace(
        signInDestination(me.data, safeRedirect(redirect), locale)
      )
    } else
      router.history.replace(
        `${login}${login.includes("?") ? "&" : "?"}error=oauth_failed`
      )
  }, [
    error,
    me.isFetching,
    me.isSuccess,
    me.data,
    router,
    redirect,
    locale,
    login,
  ])
  if (error)
    return (
      <div className="flex flex-col gap-6">
        <AuthHeading
          title={t("auth.login_title")}
          helper={t("auth.oauth_error")}
        />
        <ShellLink
          path={withRedirect("/auth/login", safeRedirect(redirect))}
          className={buttonVariants({ size: "lg" })}
        >
          {t("auth.back_to_sign_in")}
        </ShellLink>
      </div>
    )
  return (
    <SessionStep
      pending={me.isPending || me.isFetching}
      error={me.isError}
      onRetry={() => void me.refetch()}
      onBack={() => router.history.replace(login)}
    />
  )
}
