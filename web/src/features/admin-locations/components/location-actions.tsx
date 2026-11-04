import { useT } from "@/lib/i18n/use-t"
import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"

// Edit, then Remove after a confirm. A place still in use is refused by the server (409 `in_use`) and the toast says so.
export function LocationActions({
  name,
  onEdit,
  onRemove,
}: {
  name: string
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={t("admin.locations_edit_label", { name })}
        onClick={onEdit}
      >
        {t("common.edit")}
      </Button>
      <RemoveButton
        variant="secondary"
        size="sm"
        aria-label={t("admin.locations_remove_label", { name })}
        title={t("admin.locations_remove_title", { name })}
        onConfirm={onRemove}
      >
        {t("common.remove")}
      </RemoveButton>
    </div>
  )
}
