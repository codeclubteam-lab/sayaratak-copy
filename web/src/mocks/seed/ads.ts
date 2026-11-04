import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import type { AdPageRow, CampaignRow } from "../types"

const DAY_MS = 24 * 60 * 60 * 1000

const prices: [AdPageId, number][] = [
  ["home_top", 300_000],
  ["home_middle", 150_000],
  ["search_car", 120_000],
  ["search_truck", 80_000],
  ["search_parts", 80_000],
  ["search_motorcycle", 60_000],
  ["search_tuk_tuk", 50_000],
  ["listing_detail", 100_000],
  ["directory_dealerships", 60_000],
  ["directory_workshops", 60_000],
  ["directory_mechanics", 50_000],
]
export const adPages = (): AdPageRow[] =>
  prices.map(([id, weeklyPrice]) => ({
    id,
    weeklyPrice,
    slots: 3,
    enabled: true,
  }))

const day = (offset: number) => {
  const d = new Date(Date.now() + offset * DAY_MS)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// One running campaign of the demo dealership (so visitors see a paid banner) and one waiting in the admin's queue from the demo workshop.
export const campaigns = (slugs: {
  dealer: string
  workshop: string
}): CampaignRow[] => [
  {
    id: "camp-1",
    ownerId: "u-dealer",
    creative: {
      imageUrl: "/mock/banner-2.webp",
      copy: {
        en: {
          heading: "Pickups ready to work",
          body: "Inspected trucks at Al Nasr Motors, Khartoum",
          cta: "See the stock",
        },
        ar: {
          heading: "بيك أب جاهز للعمل",
          body: "شاحنات مفحوصة في معرض النصر، الخرطوم",
          cta: "شاهد المعروض",
        },
      },
    },
    href: `/dealerships/${slugs.dealer}`,
    pages: ["search_car", "search_truck", "home_middle"],
    startsAt: day(-3),
    weeks: 2,
    endsAt: day(11),
    amount: (120_000 + 80_000 + 150_000) * 2,
    status: "approved",
    impressions: 1840,
    clicks: 37,
    createdAt: day(-4),
  },
  {
    id: "camp-2",
    ownerId: "u-workshop",
    creative: {
      imageUrl: "/mock/banner-3.webp",
      copy: {
        en: {
          heading: "Brake check in 30 minutes",
          body: "Walk in, no booking needed",
          cta: "Visit the workshop",
        },
        ar: {
          heading: "فحص الفرامل في 30 دقيقة",
          body: "تعال مباشرة، بدون حجز",
          cta: "زر الورشة",
        },
      },
    },
    href: `/workshops/${slugs.workshop}`,
    pages: ["listing_detail", "directory_workshops"],
    startsAt: day(1),
    weeks: 1,
    endsAt: day(8),
    amount: 100_000 + 60_000,
    status: "under_review",
    impressions: 0,
    clicks: 0,
    createdAt: day(0),
  },
]
