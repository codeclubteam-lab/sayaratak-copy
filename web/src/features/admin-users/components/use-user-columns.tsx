import { useQuery } from "@tanstack/react-query"

import type { DataColumn } from "@/lib/table"
import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminUser } from "@sayaratak/shared/schemas/admin"
import { taxonomyQuery } from "@/features/listings/queries"
import { UserCell } from "./user-cell"
import { UserContact } from "./user-contact"
import { UserStatusBadge } from "./user-status-badge"

// Columns of the users table. The server keeps them newest first, so no column sorts.
export function useUserColumns(
  onOpen: (user: AdminUser) => void
): DataColumn<AdminUser>[] {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  return [
    {
      id: "user",
      header: t("admin.user_col_user"),
      enableHiding: false,
      cell: ({ row }) => (
        <UserCell user={row.original} onOpen={() => onOpen(row.original)} />
      ),
    },
    {
      id: "contact",
      header: t("admin.user_col_contact"),
      cell: ({ row }) => <UserContact user={row.original} />,
    },
    {
      id: "role",
      header: t("admin.user_col_role"),
      cell: ({ row }) => t(`dashboard.role_${row.original.role}`),
    },
    {
      id: "city",
      header: t("admin.city_filter"),
      cell: ({ row }) =>
        tax?.cities.find((c) => c.id === row.original.cityId)?.name[locale],
    },
    {
      id: "listings",
      header: t("admin.user_col_listings"),
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.listings, locale)}
        </span>
      ),
    },
    {
      id: "joined",
      header: t("admin.user_col_joined"),
      cell: ({ row }) => formatDate(row.original.createdAt, locale),
    },
    {
      id: "status",
      header: t("admin.report_col_status"),
      cell: ({ row }) => <UserStatusBadge user={row.original} />,
    },
  ]
}
