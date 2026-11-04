import type { Banner } from "@sayaratak/shared/schemas/admin"
import type { AdPage, AdPageId, Campaign } from "@sayaratak/shared/schemas/ads"

import type { AdPageRow, BannerRow, CampaignRow } from "./ads.tables"

type Names = { ar: string; en: string }

export function toAdPage(row: AdPageRow, free: number): AdPage {
  return {
    id: row.id,
    weeklyPrice: row.weeklyPrice,
    slots: row.slots,
    enabled: row.enabled,
    free,
  }
}

export function toCampaign(
  row: CampaignRow,
  more: { ownerName: string; imageUrl: string }
): Campaign {
  return {
    id: row.id,
    // A campaign outlives its advertiser's account (ownerId null); the lists an advertiser reads never hold one.
    ownerId: row.ownerId ?? "",
    ownerName: more.ownerName,
    creative: { imageUrl: more.imageUrl, copy: row.copy },
    href: row.href,
    pages: row.pages,
    startsAt: row.startsAt.toISOString(),
    weeks: row.weeks,
    endsAt: row.endsAt.toISOString(),
    amount: row.amount,
    status: row.status,
    rejectionReason: row.rejectionReason ?? undefined,
    impressions: row.impressions,
    clicks: row.clicks,
    createdAt: row.createdAt.toISOString(),
  }
}

/** A house banner: one picture per language, real text on top when `copy` is set. */
export function toBanner(
  row: BannerRow,
  imageUrl: { ar: string; en: string }
): Banner {
  return {
    id: row.id,
    title: row.title,
    imageUrl,
    copy: row.copy ?? undefined,
    sponsored: row.sponsored,
    focus: row.focus,
    href: row.href,
    placement: row.placement,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    active: row.active,
    sortOrder: row.sortOrder,
    impressions: row.impressions,
    clicks: row.clicks,
  }
}

const PLACEMENT_OF_PAGE = {
  home_top: "home_top",
  home_middle: "home_middle",
  listing_detail: "listing_aside",
  directory_dealerships: "directory_top",
  directory_workshops: "directory_top",
  directory_mechanics: "directory_top",
  search_car: "search_top",
  search_truck: "search_top",
  search_motorcycle: "search_top",
  search_tuk_tuk: "search_top",
  search_parts: "search_top",
} as const satisfies Record<AdPageId, Banner["placement"]>

/** A running campaign as the sponsored banner of `page`: the advertiser's name is the eyebrow of each language. */
export function toSponsoredBanner(
  row: CampaignRow,
  more: { page: AdPageId; owner: Names; imageUrl: string }
): Banner {
  return {
    id: row.id,
    title: row.copy.en.heading,
    imageUrl: { ar: more.imageUrl, en: more.imageUrl },
    copy: {
      ar: { eyebrow: more.owner.ar, ...row.copy.ar },
      en: { eyebrow: more.owner.en, ...row.copy.en },
    },
    sponsored: true,
    focus: 50,
    href: row.href,
    placement: PLACEMENT_OF_PAGE[more.page],
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    active: true,
    sortOrder: 0,
    impressions: row.impressions,
    clicks: row.clicks,
  }
}
