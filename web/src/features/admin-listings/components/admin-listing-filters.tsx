import { useQuery } from "@tanstack/react-query"
import { XIcon } from "lucide-react"

import { SelectInput } from "@/components/app/select-input"
import { useT } from "@/lib/i18n/use-t"
import { taxonomyQuery } from "@/features/listings/queries"
import { adminQueries } from "@/features/admin/queries"
import {
  adminListingTypes,
  adminListingsSearchSchema,
  sellerKinds,
  type AdminListingsSearch,
} from "@/features/admin/schemas"

// City, type, seller kind and promotion in the table toolbar, plus a chip for one person's listings (from the user sheet). Clearing one drops it from the URL.
export function AdminListingFilters({
  search,
  onChange,
}: {
  search: AdminListingsSearch
  onChange: (next: Partial<AdminListingsSearch>) => void
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const { type, sellerKind, promoted } = adminListingsSearchSchema.shape
  const owner = useQuery({
    ...adminQueries.users({ id: search.ownerId }),
    enabled: !!search.ownerId,
  }).data?.items[0]
  const ownerLabel = t("admin.listings_owner", {
    name: owner?.fullName ?? search.ownerId,
  })
  return (
    <>
      {search.ownerId && (
        <button
          type="button"
          aria-label={t("search.remove_filter", { label: ownerLabel })}
          onClick={() => onChange({ ownerId: undefined })}
          className="flex min-h-(--control-h) max-w-64 items-center gap-2 rounded-full bg-muted ps-4 pe-3 text-ui"
        >
          <bdi className="truncate">{ownerLabel}</bdi>
          <XIcon aria-hidden className="size-4 shrink-0" />
        </button>
      )}
      <SelectInput
        className="w-40"
        aria-label={t("admin.city_filter")}
        placeholder={t("admin.city_filter")}
        value={search.cityId ?? ""}
        options={(tax?.cities ?? []).map((c) => ({
          value: c.id,
          label: c.name[locale],
        }))}
        onChange={(next) => onChange({ cityId: next || undefined })}
      />
      <SelectInput
        className="w-40"
        aria-label={t("admin.type_filter")}
        placeholder={t("admin.type_filter")}
        value={search.type ?? ""}
        options={adminListingTypes.map((v) => ({
          value: v,
          label: t(v === "vehicle" ? "admin.type_vehicle" : `post.type_${v}`),
        }))}
        onChange={(next) => onChange({ type: type.parse(next || undefined) })}
      />
      <SelectInput
        className="w-40"
        aria-label={t("admin.seller_kind")}
        value={search.sellerKind}
        options={sellerKinds.map((v) => ({
          value: v,
          label: t(`admin.seller_${v}`),
        }))}
        onChange={(next) => onChange({ sellerKind: sellerKind.parse(next) })}
      />
      <SelectInput
        className="w-40"
        aria-label={t("admin.promoted_filter")}
        placeholder={t("admin.promoted_filter")}
        value={search.promoted ?? ""}
        options={(["yes", "no"] as const).map((v) => ({
          value: v,
          label: t(`admin.promoted_${v}`),
        }))}
        onChange={(next) =>
          onChange({ promoted: promoted.parse(next || undefined) })
        }
      />
    </>
  )
}
