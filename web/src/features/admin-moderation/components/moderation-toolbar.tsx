import { SelectInput } from "@/components/app/select-input"
import { useT } from "@/lib/i18n/use-t"
import { vehicleTypeSchema } from "@sayaratak/shared/schemas/listing"
import {
  moderationSearchSchema,
  sellerKinds,
  type ModerationSearch,
} from "@/features/admin/schemas"

const types = [...vehicleTypeSchema.options, "part"] as const

// Vehicle type and seller kind. Clearing one goes back to every type or every seller.
export function ModerationToolbar({
  search,
  onChange,
}: {
  search: ModerationSearch
  onChange: (next: Partial<ModerationSearch>) => void
}) {
  const { t } = useT()
  const { type, sellerKind } = moderationSearchSchema.shape
  return (
    <>
      <SelectInput
        className="w-44"
        aria-label={t("admin.type_filter")}
        placeholder={t("admin.type_filter")}
        value={search.type ?? ""}
        options={types.map((v) => ({ value: v, label: t(`post.type_${v}`) }))}
        onChange={(next) => onChange({ type: type.parse(next || undefined) })}
      />
      <SelectInput
        className="w-44"
        aria-label={t("admin.seller_kind")}
        value={search.sellerKind}
        options={sellerKinds.map((v) => ({
          value: v,
          label: t(`admin.seller_${v}`),
        }))}
        onChange={(next) => onChange({ sellerKind: sellerKind.parse(next) })}
      />
    </>
  )
}
