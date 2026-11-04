import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"
import { useEndPromotion } from "@/features/admin/queries"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

// Takes the promotion off its listing at once, after a confirm.
export function EndPromotionButton({ promotion }: { promotion: MyPromotion }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const end = useEndPromotion()
  const title = promotion.listing.title
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={t("admin.promos_end_label", { title })}
        onClick={() => setOpen(true)}
      >
        {t("admin.promos_end")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("admin.promos_end_title")}
        description={t("admin.promos_end_body", { title })}
        confirmLabel={t("admin.promos_end")}
        destructive
        pending={end.isPending}
        onConfirm={() =>
          end.mutate(promotion.id, {
            onSuccess: () =>
              toast.add({ title: t("admin.promos_ended_toast") }),
            onError: (e) => toast.add({ title: errorText(t, e) }),
            onSettled: () => setOpen(false),
          })
        }
      />
    </>
  )
}
