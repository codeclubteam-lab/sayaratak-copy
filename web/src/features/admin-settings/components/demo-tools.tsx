import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useResetDemoData } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { SettingsSection } from "@/components/app/settings-section"
import { Button } from "@/components/ui/button"

// Demo builds only. The reset reseeds the mock data and signs everyone out, the admin included.
export function DemoTools() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const reset = useResetDemoData()
  return (
    <SettingsSection
      title={t("admin.settings_demo")}
      description={t("admin.settings_demo_hint")}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("admin.settings_reset")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("admin.settings_reset_title")}
        description={
          reset.isError
            ? errorText(t, reset.error)
            : t("admin.settings_reset_body")
        }
        confirmLabel={t("admin.settings_reset")}
        destructive
        pending={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              window.location.assign("/")
            },
          })
        }
      />
    </SettingsSection>
  )
}
