import { useRequireAuth } from "@/features/auth/auth-gate"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"

// Shown in place of the uploaders while signed out: uploads need an account (owner, 2026-11-01). The wizard keeps what was typed, and the uploaders appear once the dialog signs in.
export function PhotosSignIn() {
  const { t } = useT()
  const requireAuth = useRequireAuth()
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-body">{t("post.photos_sign_in")}</p>
      <Button
        type="button"
        onClick={() => requireAuth(() => undefined, "auth.reason_photos")}
      >
        {t("common.sign_in")}
      </Button>
    </div>
  )
}
