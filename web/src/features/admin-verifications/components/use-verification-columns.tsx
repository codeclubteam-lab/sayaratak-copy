import type { DataColumn } from "@/lib/table"
import { formatNumber, formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminVerification } from "@sayaratak/shared/schemas/admin"
import { VerificationBusinessCell } from "./verification-business-cell"

// Columns of the verifications table. The server keeps them newest first, so no column sorts.
export function useVerificationColumns(
  onOpen: (request: AdminVerification) => void
): DataColumn<AdminVerification>[] {
  const { t, locale } = useT()
  const now = useNow()
  return [
    {
      id: "business",
      header: t("admin.verification_col_business"),
      enableHiding: false,
      cell: ({ row }) => (
        <VerificationBusinessCell
          request={row.original}
          onOpen={() => onOpen(row.original)}
        />
      ),
    },
    {
      id: "type",
      header: t("admin.verification_col_type"),
      cell: ({ row }) => t(`dashboard.role_${row.original.targetType}`),
    },
    {
      id: "owner",
      header: t("admin.verification_col_owner"),
      cell: ({ row }) => <bdi>{row.original.owner?.name}</bdi>,
    },
    {
      id: "submitted",
      header: t("admin.verification_col_submitted"),
      cell: ({ row }) => formatRelative(row.original.createdAt, now, locale),
    },
    {
      id: "documents",
      header: t("admin.verification_col_documents"),
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.documents.length, locale)}
        </span>
      ),
    },
  ]
}
