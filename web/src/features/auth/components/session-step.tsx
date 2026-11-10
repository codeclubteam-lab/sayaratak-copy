import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/app/submit-button"
import { useT } from "@/lib/i18n/use-t"
import { AuthHeading } from "./auth-heading"

export function SessionStep({
  pending,
  error,
  onRetry,
  onBack,
}: {
  pending: boolean
  error: boolean
  onRetry: () => void
  onBack: () => void
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title={t("auth.session_title")}
        helper={t(error ? "auth.session_load_error" : "auth.session_loading")}
      />
      <SubmitButton type="button" size="lg" pending={pending} onClick={onRetry}>
        {t("common.retry")}
      </SubmitButton>
      <Button type="button" variant="link" disabled={pending} onClick={onBack}>
        {t("auth.back_to_sign_in")}
      </Button>
    </div>
  )
}
