import type { Settings, SitePage } from "@sayaratak/shared/schemas/admin"
import type { Site } from "@sayaratak/shared/schemas/responses"

import type { SettingsRow, SitePageRow } from "./content.tables"

export function toSite(row: SettingsRow): Site {
  return {
    contact: row.contact,
    locales: row.locales,
  }
}

export function toSitePage(row: SitePageRow): SitePage {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The settings the admin page edits: every one, the banking details as one group. */
export function toSettings(row: SettingsRow): Settings {
  return {
    autoApproveVerifiedDealers: row.autoApproveVerifiedDealers,
    listingExpiryDays: row.listingExpiryDays,
    individualSubscriptionsEnabled: row.individualSubscriptionsEnabled,
    freeListingLimit: row.freeListingLimit,
    bankakAccount: { name: row.bankakName, number: row.bankakNumber },
    contact: row.contact,
    locales: row.locales,
    backupSchedule: row.backupSchedule,
  }
}
