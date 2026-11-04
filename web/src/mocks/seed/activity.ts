import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import type { Message } from "@sayaratak/shared/schemas/messaging"
import type { Review } from "@sayaratak/shared/schemas/review"
import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"
import { faker } from "@faker-js/faker"
import type {
  FavoriteRow,
  ListingRow,
  NotificationRow,
  SavedSearchRow,
  ThreadRow,
  UserRow,
} from "../types"
import {
  DAY,
  HOUR,
  ago,
  both,
  chance,
  int,
  notificationHref,
  pick,
  ratingFrom,
} from "./util"
import {
  buyerLines,
  customerLines,
  providerLines,
  reviewBad,
  reviewGood,
  reviewMid,
  reviewReply,
  sellerLines,
} from "./words"

// Seeded individuals only: the demo accounts and new@demo.sy keep their own scripted content.
const isPlain = (u: UserRow) => /^u-\d+$/.test(u.id)

type Business = {
  id: string
  ownerId: string
  name: Bilingual
  type: "dealership" | "workshop" | "mechanic"
  photo: string
}

export function seedReviews(users: UserRow[], businesses: Business[]) {
  const authors = users.filter((u) => isPlain(u) && !u.banned)
  const reviews: Review[] = []
  const seen = new Set<string>()
  while (reviews.length < 120) {
    const target = pick(businesses)
    const author = pick(authors)
    const key = `${author.id}:${target.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const rating = faker.helpers.weightedArrayElement([
      { weight: 48, value: 5 },
      { weight: 32, value: 4 },
      { weight: 9, value: 3 },
      { weight: 6, value: 2 },
      { weight: 5, value: 1 },
    ])
    const createdAt = ago(int(HOUR, 120 * DAY))
    reviews.push({
      id: `r-${reviews.length + 1}`,
      targetType: target.type,
      targetId: target.id,
      authorId: author.id,
      authorName: author.fullName,
      rating,
      body: chance(0.85)
        ? pick(rating >= 4 ? reviewGood : rating === 3 ? reviewMid : reviewBad)
        : undefined,
      createdAt,
      reply: chance(0.4)
        ? { body: pick(reviewReply), createdAt: ago(int(HOUR, 3 * DAY)) }
        : undefined,
      status:
        reviews.length > 115
          ? "flagged"
          : reviews.length > 111
            ? "hidden"
            : "visible",
    })
  }
  return reviews
}

// Ratings are the average of visible reviews.
export function applyRatings(
  reviews: Review[],
  rows: (Dealership | Workshop | Mechanic)[]
) {
  for (const row of rows) {
    row.rating = ratingFrom(
      reviews
        .filter((r) => r.targetId === row.id && r.status !== "hidden")
        .map((r) => r.rating)
    )
  }
}

export function seedThreads(
  users: UserRow[],
  listings: ListingRow[],
  businesses: Business[]
) {
  const threads: ThreadRow[] = []
  const messages: Message[] = []
  const demo = [
    "u-omar",
    "u-omar",
    "u-omar",
    "u-dealer",
    "u-dealer",
    "u-workshop",
    "u-mechanic",
  ]
  const people = users.filter((u) => isPlain(u) && !u.banned)
  for (let i = 0; i < 25; i++) {
    const meId = pick(demo)
    const me = users.find((u) => u.id === meId)
    const other = pick(people.length ? people : users)
    if (!me) continue
    const mine = listings.filter(
      (l) => l.ownerUserId === me.id && l.moderation === "approved"
    )
    const biz = businesses.find((b) => b.ownerId === me.id)
    const forListing = me.role === "user" || me.role === "dealership"
    const listing = forListing && mine.length ? pick(mine) : undefined
    const subject = listing
      ? {
          subjectType: "listing" as const,
          subjectId: listing.id,
          subjectTitle: both(listing.title),
          subjectImage: listing.media[0]?.url,
        }
      : {
          subjectType: biz?.type ?? ("mechanic" as const),
          subjectId: biz?.id ?? "m-1",
          subjectTitle: biz?.name ?? both(""),
          subjectImage: biz?.photo,
        }
    // One thread per pair and subject, as POST /threads keeps it: a repeat draw adds its messages to the first one.
    const same = threads.find(
      (t) =>
        t.subjectType === subject.subjectType &&
        t.subjectId === subject.subjectId &&
        t.participantIds.includes(other.id) &&
        t.participantIds.includes(me.id)
    )
    const id = same?.id ?? `t-${i + 1}`
    if (!same)
      threads.push({ id, ...subject, participantIds: [other.id, me.id] })
    const [buyerSet, sellerSet] = listing
      ? [buyerLines, sellerLines]
      : [customerLines, providerLines]
    const count = int(3, 12)
    const unread = chance(0.4)
    for (let k = 0; k < count; k++) {
      const fromOther = k % 2 === 0
      const createdAt = ago((count - k) * int(HOUR, 6 * HOUR) + i * HOUR)
      const last = k >= count - 2
      messages.push({
        id: `msg-${messages.length + 1}`,
        threadId: id,
        senderId: fromOther ? other.id : me.id,
        body: (fromOther ? buyerSet : sellerSet)[k % 6] ?? "",
        createdAt,
        readAt: fromOther && unread && last ? undefined : createdAt,
      })
    }
  }
  return { threads, messages }
}

type Role = UserRow["role"]
const allRoles: Role[] = ["user", "dealership", "workshop", "mechanic", "admin"]
const sellerRoles: Role[] = ["user", "dealership"]
const businessRoles: Role[] = ["dealership", "workshop", "mechanic"]
// What each kind of person can receive, so no demo account is told about a page it does not have. Hrefs are the mock's role-free form (see `notificationHref`).
const notes: {
  type: NotificationRow["type"]
  title: [string, string]
  body: [string, string]
  href: string
  roles: Role[]
}[] = [
  {
    type: "message",
    title: ["رسالة جديدة", "New message"],
    body: [
      "لديك رسالة جديدة في صندوق الوارد.",
      "You have a new message in your inbox.",
    ],
    href: "/messages",
    roles: ["user", ...businessRoles],
  },
  {
    type: "listing_approved",
    title: ["تمت الموافقة على إعلانك", "Your listing was approved"],
    body: [
      "إعلانك الآن ظاهر للجميع.",
      "Your listing is now visible to everyone.",
    ],
    href: "/listings",
    roles: sellerRoles,
  },
  {
    type: "listing_rejected",
    title: ["تم رفض إعلانك", "Your listing was rejected"],
    body: [
      "راجع السبب وعدّل الإعلان.",
      "Check the reason and edit the listing.",
    ],
    href: "/listings",
    roles: sellerRoles,
  },
  {
    type: "saved_search_match",
    title: ["إعلان جديد يطابق بحثك", "A new listing matches your search"],
    body: [
      "وصل إعلان جديد يطابق بحثك المحفوظ.",
      "A new listing matches your saved search.",
    ],
    href: "/saved-searches",
    roles: ["user"],
  },
  {
    type: "review_new",
    title: ["تقييم جديد", "New review"],
    body: ["حصلت على تقييم جديد.", "You received a new review."],
    href: "/reviews",
    roles: businessRoles,
  },
  {
    type: "payment_approved",
    title: ["تمت الموافقة على الدفع", "Payment approved"],
    body: ["تم تفعيل خدمتك.", "Your service is now active."],
    href: "/billing",
    roles: [...sellerRoles, "workshop", "mechanic"],
  },
  {
    type: "subscription_expiring",
    title: ["اشتراكك على وشك الانتهاء", "Your plan is about to end"],
    body: ["جدد اشتراكك لتستمر في النشر.", "Renew to keep posting."],
    href: "/billing",
    roles: [...sellerRoles, "workshop", "mechanic"],
  },
  {
    type: "verification_result",
    title: ["تم توثيق حسابك", "Your account is verified"],
    body: [
      "ظهرت علامة التوثيق على ملفك.",
      "The verified badge is now on your profile.",
    ],
    href: "/verification",
    roles: businessRoles,
  },
  {
    type: "broadcast",
    title: ["إعلان من الإدارة", "Announcement"],
    body: ["نرحب بكم في سيارتك.", "Welcome to Sayaratak."],
    href: "",
    roles: allRoles,
  },
]
export function seedNotifications(people: Pick<UserRow, "id" | "role">[]) {
  const rows: NotificationRow[] = []
  for (const { id: userId, role } of people) {
    const mine = notes.filter((n) => n.roles.includes(role))
    for (let i = 0; i < (role === "admin" ? 3 : 12); i++) {
      const note = mine[i % mine.length]
      if (!note) continue
      const createdAt = ago((i + 1) * int(2 * HOUR, 20 * HOUR))
      rows.push({
        id: `n-${rows.length + 1}`,
        userId,
        type: note.type,
        title: { ar: note.title[0], en: note.title[1] },
        body: { ar: note.body[0], en: note.body[1] },
        href: note.href ? notificationHref(role, note.href) : undefined,
        createdAt,
        readAt: i > 3 ? createdAt : undefined,
      })
    }
  }
  return rows
}

export function seedSaved(users: UserRow[], listings: ListingRow[]) {
  const approved = listings.filter((l) => l.moderation === "approved")
  const favorites: FavoriteRow[] = []
  const add = (userId: string, n: number) => {
    for (const l of faker.helpers.arrayElements(
      approved.filter((x) => x.ownerUserId !== userId),
      n
    )) {
      favorites.push({
        id: `f-${favorites.length + 1}`,
        userId,
        listingId: l.id,
        createdAt: ago(int(HOUR, 30 * DAY)),
      })
    }
  }
  add("u-omar", 7)
  for (const u of users.filter(isPlain).slice(1, 41)) add(u.id, int(1, 3))
  const savedSearches: SavedSearchRow[] = [
    {
      id: "ss-1",
      userId: "u-omar",
      name: "تويوتا هايلكس في الخرطوم",
      params: {
        kind: "vehicle",
        intent: "sale",
        type: "car",
        make: "toyota",
        city: "khartoum",
        includeSold: false,
        sort: "newest",
        page: 1,
      },
      alerts: true,
      newCount: 2,
      createdAt: ago(10 * DAY),
    },
    {
      id: "ss-2",
      userId: "u-omar",
      name: "سيارات أقل من 20 مليون",
      params: {
        kind: "vehicle",
        intent: "sale",
        maxPrice: 20_000_000,
        includeSold: false,
        sort: "price_asc",
        page: 1,
      },
      alerts: false,
      newCount: 0,
      createdAt: ago(20 * DAY),
    },
    {
      id: "ss-3",
      userId: "u-omar",
      name: "قطع غيار",
      params: { kind: "part", includeSold: false, sort: "newest", page: 1 },
      alerts: true,
      newCount: 1,
      createdAt: ago(5 * DAY),
    },
  ]
  return { favorites, savedSearches }
}
