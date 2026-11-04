import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import type {
  ActivityItem,
  AdminSearch,
} from "@sayaratak/shared/schemas/responses"

type Hit = AdminSearch["listings"][number]
type Dated = { createdAt: Date }
type Business = { id: string; kind: string; name: Bilingual }

/** The admin screen that lists a business kind: `dealership` opens `/admin/dealerships`. */
const businessHref = (row: Business) => `/admin/${row.kind}s?id=${row.id}`

export function toListingActivity(
  row: { id: string; moderation: string } & Dated,
  label: Bilingual
): ActivityItem {
  return {
    id: row.id,
    type: "listing_submitted",
    label,
    // A pending listing opens in the review queue; any other opens in the listings table.
    href:
      row.moderation === "pending"
        ? `/admin/moderation?listing=${row.id}`
        : `/admin/listings?id=${row.id}`,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toBusinessActivity(row: Business & Dated): ActivityItem {
  return {
    id: row.id,
    type: "business_joined",
    label: row.name,
    href: businessHref(row),
    createdAt: row.createdAt.toISOString(),
  }
}

export function toPaymentActivity(
  row: { id: string } & Dated,
  label: Bilingual
): ActivityItem {
  return {
    id: row.id,
    type: "payment_submitted",
    label,
    href: `/admin/payments?id=${row.id}`,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toReportActivity(
  row: { id: string } & Dated,
  label: Bilingual
): ActivityItem {
  return {
    id: row.id,
    type: "report_filed",
    label,
    href: `/admin/reports?id=${row.id}`,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toListingHit(
  row: { id: string; moderation: string },
  label: Bilingual
): Hit {
  return {
    id: row.id,
    label,
    detail: row.moderation,
    href: `/admin/listings?id=${row.id}`,
  }
}

export function toUserHit(
  row: { id: string; phone: string | null; email: string },
  label: Bilingual
): Hit {
  return {
    id: row.id,
    label,
    detail: row.phone ?? row.email,
    href: `/admin/users?id=${row.id}`,
  }
}

export function toBusinessHit(row: Business): Hit {
  return {
    id: row.id,
    label: row.name,
    detail: row.kind,
    href: businessHref(row),
  }
}

export function toPaymentHit(
  row: { id: string; payerName: string },
  label: Bilingual
): Hit {
  return {
    id: row.id,
    label,
    detail: row.payerName,
    href: `/admin/payments?id=${row.id}`,
  }
}
