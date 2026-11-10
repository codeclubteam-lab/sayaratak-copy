import { useState } from "react"
import { MailIcon, XIcon } from "lucide-react"

import { ShellLink } from "@/components/app/shell-link"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"

export function RecoveryEmailNotice({ me }: { me: User }) {
  const { t } = useT()
  const [dismissed, setDismissed] = useState(false)
  if (me.email || dismissed) return null
  return (
    <Alert className="mb-4">
      <MailIcon aria-hidden="true" />
      <AlertTitle>{t("auth.recovery_email_title")}</AlertTitle>
      <AlertDescription>
        {t("auth.recovery_email_body")}{" "}
        <ShellLink path={`${dashboardPath(me.role)}/settings`}>
          {t("auth.recovery_email_action")}
        </ShellLink>
      </AlertDescription>
      <AlertAction>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("common.close")}
          onClick={() => setDismissed(true)}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </AlertAction>
    </Alert>
  )
}
