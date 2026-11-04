import { SelectInput } from "@/components/app/select-input"
import { useT } from "@/lib/i18n/use-t"
import { roleSchema } from "@sayaratak/shared/schemas/fields"
import {
  userStatuses,
  usersSearchSchema,
  type UsersSearch,
} from "@/features/admin/schemas"

// Role and status selects in the table toolbar. Clearing one drops it from the URL.
export function UserFilters({
  search,
  onChange,
}: {
  search: UsersSearch
  onChange: (next: Partial<UsersSearch>) => void
}) {
  const { t } = useT()
  const { role, status } = usersSearchSchema.shape
  return (
    <>
      <SelectInput
        className="w-44"
        aria-label={t("admin.user_col_role")}
        placeholder={t("admin.user_col_role")}
        value={search.role ?? ""}
        options={roleSchema.options.map((v) => ({
          value: v,
          label: t(`dashboard.role_${v}`),
        }))}
        onChange={(next) => onChange({ role: role.parse(next || undefined) })}
      />
      <SelectInput
        className="w-36"
        aria-label={t("admin.report_col_status")}
        placeholder={t("admin.report_col_status")}
        value={search.status ?? ""}
        options={userStatuses.map((v) => ({
          value: v,
          label: t(`admin.user_${v}`),
        }))}
        onChange={(next) =>
          onChange({ status: status.parse(next || undefined) })
        }
      />
    </>
  )
}
