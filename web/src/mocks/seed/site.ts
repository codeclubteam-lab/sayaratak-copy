import type {
  Backup,
  Banner,
  Report,
  Settings,
  VerificationRequest,
} from "@sayaratak/shared/schemas/admin"
import type { EventType } from "@sayaratak/shared/schemas/api"
import type { EventRow, ListingRow, SitePageRow, UserRow } from "../types"
import { DAY, HOUR, ago, ahead, chance, int } from "./util"

export const settings: Settings = {
  autoApproveVerifiedDealers: true,
  listingExpiryDays: 30,
  individualSubscriptionsEnabled: true,
  freeListingLimit: 3,
  bankakAccount: { name: "Sayaratak", number: "1234567" },
  contact: {
    phone: "+249123456789",
    whatsapp: "+249912000000",
    email: "hello@sayaratak.sd",
    address: "الخرطوم، السودان",
  },
  locales: ["ar", "en"],
  backupSchedule: "daily",
}

const page = (
  slug: SitePageRow["slug"],
  ar: string,
  en: string,
  bodyAr: string,
  bodyEn: string
): SitePageRow => ({
  id: slug,
  slug,
  title: { ar, en },
  body: { ar: bodyAr, en: bodyEn },
  updatedAt: ago(30 * DAY),
})
export const pages = (): SitePageRow[] => [
  page(
    "about",
    "من نحن",
    "About us",
    "سيارتك سوق للسيارات وخدماتها في السودان. نجمع البائعين والمشترين والورش والميكانيكيين في مكان واحد.",
    "Sayaratak is a marketplace for vehicles and auto services in Sudan. It brings sellers, buyers, workshops and mechanics together."
  ),
  page(
    "contact",
    "اتصل بنا",
    "Contact us",
    "يسعدنا سماع رأيك. راسلنا في أي وقت.",
    "We would like to hear from you. Write to us any time."
  ),
  page(
    "privacy",
    "سياسة الخصوصية",
    "Privacy policy",
    "نحتفظ ببياناتك لتشغيل الخدمة فقط ولا نبيعها لأي جهة.\n\n# ما الذي نجمعه\n- الاسم ورقم الهاتف أو البريد الإلكتروني\n- الإعلانات والرسائل التي ترسلها عبر الموقع\n\n# حقوقك\nيمكنك طلب حذف حسابك وبياناتك في أي وقت عبر صفحة اتصل بنا.",
    "We keep your data only to run the service and never sell it.\n\n# What we collect\n- Your name and your phone number or email\n- The listings and messages you send through the site\n\n# Your rights\nYou can ask us to delete your account and data at any time from the contact page."
  ),
  page(
    "terms",
    "الشروط والأحكام",
    "Terms",
    "باستخدامك الموقع فأنت توافق على نشر معلومات صحيحة والالتزام بقواعد المجتمع.\n\n# قواعد النشر\n- انشر مركبات وخدمات حقيقية فقط\n- اذكر السعر الصحيح بالجنيه السوداني\n- لا تنشر إعلانا مكررا\n\n# الإيقاف\nقد نوقف الإعلانات أو الحسابات المخالفة.",
    "By using the site you agree to post accurate information and follow the community rules.\n\n# Posting rules\n- Post real vehicles and services only\n- State the correct price in Sudanese pounds\n- Do not post the same listing twice\n\n# Suspension\nWe may suspend listings or accounts that break these rules."
  ),
]

export const backups = (): Backup[] =>
  Array.from({ length: 5 }, (_, i) => ({
    id: `bk-${i + 1}`,
    createdAt: ago((i + 1) * DAY),
    sizeMb: 40 + i * 3,
    type: i % 2 ? "manual" : "auto",
    status: "ready",
  }))

// One photo per banner (`public/mock/banner-N.webp`, made by `bun run banners`, or a category photo) with real text in both languages on top. The home hero is a carousel of four (cars, trucks, workshops, mechanics); the two trucks banners stand in for paid ones, so they carry the "Ad" chip.
const text = (eyebrow: string, heading: string, body: string, cta: string) => ({
  eyebrow,
  heading,
  body,
  cta,
})
type BannerRow = Pick<
  Banner,
  "title" | "placement" | "href" | "focus" | "copy"
> & { photo: string; sponsored?: boolean }
const bannerRows: BannerRow[] = [
  {
    title: "عروض الصيف",
    placement: "home_top",
    photo: "/mock/banner-1.webp",
    href: "/search?type=car",
    focus: 50,
    copy: {
      en: text(
        "Cars",
        "Summer offers on cars",
        "Browse verified listings across Sudan",
        "Browse cars"
      ),
      ar: text(
        "سيارات",
        "عروض الصيف على السيارات",
        "تصفح إعلانات موثقة في كل أنحاء السودان",
        "تصفح السيارات"
      ),
    },
  },
  {
    title: "اشحن سيارتك",
    placement: "home_middle",
    photo: "/mock/banner-2.webp",
    href: "/search?type=truck",
    focus: 54,
    sponsored: true,
    copy: {
      en: text(
        "Trucks",
        "Move more with the right truck",
        "Trucks and pickups from dealers near you",
        "See trucks"
      ),
      ar: text(
        "شاحنات",
        "انقل أكثر بالشاحنة المناسبة",
        "شاحنات وبيك أب من معارض قريبة منك",
        "عرض الشاحنات"
      ),
    },
  },
  {
    title: "ابحث بسهولة",
    placement: "search_top",
    photo: "/mock/banner-3.webp",
    href: "/search?kind=part",
    focus: 33,
    copy: {
      en: text(
        "Parts",
        "Find the part, fast",
        "Brakes, filters, spark plugs and more",
        "Browse parts"
      ),
      ar: text(
        "قطع غيار",
        "اعثر على القطعة بسرعة",
        "فرامل وفلاتر وشمعات وأكثر",
        "تصفح القطع"
      ),
    },
  },
  {
    title: "سجّل نشاطك",
    placement: "directory_top",
    photo: "/mock/banner-4.webp",
    href: "/onboarding",
    focus: 4,
    copy: {
      en: text(
        "For businesses",
        "List your dealership, workshop or garage",
        "Reach buyers across Sudan. Set up in minutes.",
        "Get started"
      ),
      ar: text(
        "للأعمال",
        "سجّل معرضك أو ورشتك مجانًا",
        "اوصل إلى مشترين في كل أنحاء السودان. التسجيل في دقائق.",
        "ابدأ الآن"
      ),
    },
  },
  {
    title: "شاحنات للعمل",
    placement: "home_top",
    photo: "/images/categories/trucks-640.webp",
    href: "/vehicles/trucks/sale",
    focus: 50,
    sponsored: true,
    copy: {
      en: text(
        "Trucks",
        "Trucks and pickups ready to work",
        "Compare trucks from dealers across Sudan",
        "Browse trucks"
      ),
      ar: text(
        "شاحنات",
        "شاحنات وبيك أب جاهزة للعمل",
        "قارن شاحنات من معارض في كل أنحاء السودان",
        "تصفح الشاحنات"
      ),
    },
  },
  {
    title: "ورش موثوقة",
    placement: "home_top",
    photo: "/images/categories/workshops-640.webp",
    href: "/workshops",
    focus: 50,
    copy: {
      en: text(
        "Workshops",
        "Book a workshop you can trust",
        "Compare ratings, prices and opening hours",
        "Find a workshop"
      ),
      ar: text(
        "ورش",
        "احجز في ورشة تثق بها",
        "قارن التقييمات والأسعار وساعات العمل",
        "ابحث عن ورشة"
      ),
    },
  },
  {
    title: "ميكانيكي قريب",
    placement: "home_top",
    photo: "/images/categories/mechanics-640.webp",
    href: "/mechanics",
    focus: 40,
    copy: {
      en: text(
        "Mechanics",
        "A mechanic near you, when you need one",
        "Call or message a verified mechanic in your city",
        "Find a mechanic"
      ),
      ar: text(
        "ميكانيكيون",
        "ميكانيكي قريب منك وقت الحاجة",
        "اتصل أو راسل ميكانيكيًا موثقًا في مدينتك",
        "ابحث عن ميكانيكي"
      ),
    },
  },
]
export const banners = (): Banner[] =>
  bannerRows.map((row, i) => ({
    id: `bn-${i + 1}`,
    title: row.title,
    imageUrl: { ar: row.photo, en: row.photo },
    copy: row.copy,
    sponsored: row.sponsored ?? false,
    focus: row.focus,
    href: row.href,
    placement: row.placement,
    startsAt: ago(10 * DAY),
    endsAt: ahead(60 * DAY),
    active: true,
    sortOrder: i,
    impressions: int(1000, 9000),
    clicks: int(40, 400),
  }))

export function seedReports(
  listings: ListingRow[],
  users: UserRow[]
): Report[] {
  const approved = listings.filter((l) => l.moderation === "approved")
  const reporters = users.filter((u) => u.role === "user")
  const reasons: Report["reason"][] = [
    "scam",
    "wrong_category",
    "already_sold",
    "duplicate",
    "inappropriate",
    "other",
  ]
  // The first two open reports share a listing, so the admin sees a count above one.
  return reasons.map((reason, i) => ({
    id: `rp-${i + 1}`,
    listingId: approved[i === 1 ? 0 : i * 7]?.id ?? "",
    reporterId: reporters[i + 1]?.id ?? "u-1",
    reason,
    details: i % 2 ? "الإعلان مكرر أكثر من مرة" : undefined,
    status: i < 4 ? "open" : i === 4 ? "dismissed" : "actioned",
    createdAt: ago((i + 1) * 5 * HOUR),
    resolutionNote: i >= 4 ? "تمت المراجعة" : undefined,
  }))
}

const documentLabel = {
  dealership: "commercial_registration",
  workshop: "workshop_license",
  mechanic: "national_id",
} as const

// Four pending requests from unverified businesses of each type, one approved (its business is verified) and one rejected.
export function seedVerifications(
  targets: {
    id: string
    ownerId: string
    type: VerificationRequest["targetType"]
    verified: boolean
  }[]
): VerificationRequest[] {
  const open = (type: VerificationRequest["targetType"], n: number) =>
    targets.filter((t) => t.type === type && !t.verified)[n]
  const picks = [
    [open("dealership", 0), "pending"],
    [open("workshop", 0), "pending"],
    [open("mechanic", 0), "pending"],
    [open("dealership", 1), "pending"],
    [targets.find((t) => t.verified), "approved"],
    [open("mechanic", 1), "rejected"],
  ] as const
  return picks.flatMap(([t, status], i) =>
    t
      ? [
          {
            id: `vr-${i + 1}`,
            targetType: t.type,
            targetId: t.id,
            ownerId: t.ownerId,
            documents: [
              {
                id: `doc-${i + 1}-1`,
                label: documentLabel[t.type],
                url: `/mock/doc-0${(i % 3) + 1}.svg`,
              },
              ...(i % 2
                ? []
                : [
                    {
                      id: `doc-${i + 1}-2`,
                      label:
                        t.type === "mechanic" ? "certificate" : "shop_photo",
                      url: `/mock/doc-0${((i + 1) % 3) + 1}.svg`,
                    },
                  ]),
            ],
            note: i % 2 ? "نرجو المراجعة" : undefined,
            status,
            rejectionReason:
              status === "rejected" ? "المستند غير واضح" : undefined,
            createdAt: ago((i + 1) * 9 * HOUR),
          },
        ]
      : []
  )
}

// Daily counts for ninety days so every analytics chart has a real series.
export function seedEvents(targetIds: string[]): EventRow[] {
  const rows: EventRow[] = []
  const zero = (): Record<EventType, number> => ({
    view: 0,
    phone_click: 0,
    whatsapp_click: 0,
    share: 0,
    banner_click: 0,
    banner_view: 0,
  })
  for (const targetId of targetIds) {
    const base = int(2, 20)
    for (let d = 0; d < 90; d++) {
      const day = new Date(Date.now() - d * DAY).toISOString().slice(0, 10)
      const views = Math.max(
        0,
        base + int(-3, 8) + (chance(0.1) ? int(10, 30) : 0)
      )
      rows.push({
        id: `ev-${targetId}-${day}`,
        day,
        targetId,
        counts: {
          ...zero(),
          view: views,
          phone_click: Math.round(views * 0.12),
          whatsapp_click: Math.round(views * 0.1),
          share: Math.round(views * 0.03),
        },
      })
    }
  }
  return rows
}
