import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { useDeleteBanner, useUpdateBanner } from "@/features/admin/queries"
import { RowActions } from "@/components/app/row-actions"
import { toast } from "@/components/ui/toast"

// Edit, Duplicate (opens the form with a copy that starts off), Turn on or off, and Delete after a confirm.
export function BannerActions({
  banner,
  onEdit,
  onDuplicate,
}: {
  banner: Banner
  onEdit: (b: Banner) => void
  onDuplicate: (b: Banner) => void
}) {
  const { t } = useT()
  const update = useUpdateBanner()
  const remove = useDeleteBanner()
  const done = (key: string) => ({
    onSuccess: () => toast.add({ title: t(key) }),
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  return (
    <RowActions
      label={banner.title}
      actions={[
        {
          key: "edit",
          label: t("common.edit"),
          onSelect: () => onEdit(banner),
        },
        {
          key: "duplicate",
          label: t("admin.banners_duplicate"),
          onSelect: () => onDuplicate(banner),
        },
        {
          key: "toggle",
          label: t(
            banner.active ? "admin.banners_turn_off" : "admin.banners_turn_on"
          ),
          onSelect: () =>
            update.mutate(
              { id: banner.id, active: !banner.active },
              done(
                banner.active
                  ? "admin.banners_off_toast"
                  : "admin.banners_on_toast"
              )
            ),
        },
        {
          key: "delete",
          label: t("common.delete"),
          destructive: {
            title: t("admin.banners_delete_title", { name: banner.title }),
            description: t("admin.banners_delete_body"),
          },
          onSelect: () =>
            remove.mutate(banner.id, done("admin.banners_deleted_toast")),
        },
      ]}
    />
  )
}
