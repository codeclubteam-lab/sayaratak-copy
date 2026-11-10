import { useRouter, useSearch } from "@tanstack/react-router"

import { Separator } from "@/components/ui/separator"
import { useT } from "@/lib/i18n/use-t"
import { errorText } from "@/lib/api/error-text"
import { localeHref, safeRedirect } from "@/lib/navigation"
import { useSocialLogin } from "../queries"
import { withRedirect } from "../destination"
import { SocialButtons } from "./social-buttons"

// "or", then Google and Facebook. Shared by log in and sign up; a new social account goes to onboarding like an email sign up.
export function SocialSignIn({ redirect }: { redirect?: string }) {
  const { t, locale } = useT()
  const router = useRouter()
  const search = useSearch({ strict: false })
  const social = useSocialLogin()
  return (
    <>
      <div className="flex items-center gap-3 text-ui text-muted-foreground">
        <Separator className="flex-1" />
        {t("auth.or")}
        <Separator className="flex-1" />
      </div>
      <SocialButtons
        disabled={social.isPending}
        onSelect={(provider) => {
          // A page reload cannot replay the gate's closure. Return to its page (owner, 11.1).
          const location = router.state.location
          const path = location.pathname.includes("/auth/")
            ? safeRedirect(redirect)
            : safeRedirect(location.href)
          const callbackURL = new URL(
            localeHref(withRedirect("/auth/callback", path), locale),
            window.location.origin
          ).href
          social.mutate({
            provider,
            callbackURL,
            errorCallbackURL: callbackURL,
          })
        }}
      />
      {(social.isError || ("error" in search && search.error)) && (
        <p role="alert" className="text-ui text-destructive">
          {social.error ? errorText(t, social.error) : t("auth.oauth_error")}
        </p>
      )}
    </>
  )
}
