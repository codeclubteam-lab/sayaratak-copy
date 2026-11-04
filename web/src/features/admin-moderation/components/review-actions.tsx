import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"

// Sticky at the bottom of the review pane. One primary action. The keys are listed in the header popover only (owner choice); screen readers hear them through `aria-keyshortcuts` while shortcuts are on.
export function ReviewActions({
  shortcuts,
  onApprove,
  onReject,
  onRemove,
}: {
  shortcuts: boolean
  onApprove: () => void
  onReject: () => void
  onRemove: () => void
}) {
  const { t } = useT()
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-3 bg-background px-1 py-3">
      <Button
        type="button"
        onClick={onApprove}
        aria-keyshortcuts={shortcuts ? "A" : undefined}
      >
        {t("admin.approve")}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onReject}
        aria-keyshortcuts={shortcuts ? "R" : undefined}
      >
        {t("admin.reject")}
      </Button>
      <RemoveButton
        variant="ghost"
        className="ms-auto text-destructive"
        title={t("admin.remove_title")}
        onConfirm={onRemove}
      >
        {t("common.remove")}
      </RemoveButton>
    </div>
  )
}
