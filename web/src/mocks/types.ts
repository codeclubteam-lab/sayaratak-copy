import type {
  Banner,
  Backup,
  Report,
  Settings,
  SitePage,
  VerificationRequest,
} from "@sayaratak/shared/schemas/admin"
import type { AdPage, Campaign } from "@sayaratak/shared/schemas/ads"
import type {
  Broadcast,
  EventType,
  NotificationPrefs,
} from "@sayaratak/shared/schemas/api"
import type { Bilingual, Locale } from "@sayaratak/shared/schemas/fields"
import type { contactSubjects } from "@sayaratak/shared/schemas/inputs"
import type { Listing, Media } from "@sayaratak/shared/schemas/listing"
import type { Message, Notification } from "@sayaratak/shared/schemas/messaging"
import type {
  Payment,
  Plan,
  Promotion,
  PromotionPrice,
  Subscription,
} from "@sayaratak/shared/schemas/billing"
import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"
import type { Review } from "@sayaratak/shared/schemas/review"
import type { SavedSearch } from "@sayaratak/shared/schemas/saved-search"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import type { User } from "@sayaratak/shared/schemas/user"

// Rows are the API shapes plus the few server-only columns; handlers parse through the schemas, which drops the extras.
export type UserRow = Omit<User, "hasPassword"> & {
  password: string | null
  locale: Locale
  prefs: NotificationPrefs
}
// `bumpedAt` is when a bump last put the listing back at the top of the newest.
export type ListingRow = Listing & { ownerUserId: string; bumpedAt?: string }
export type ThreadRow = {
  id: string
  subjectType: "listing" | "dealership" | "workshop" | "mechanic"
  subjectId: string
  subjectTitle: Bilingual
  subjectImage?: string
  participantIds: string[]
}
export type NotificationRow = Notification & { userId: string }
export type SavedSearchRow = SavedSearch & { userId: string }
export type FavoriteRow = {
  id: string
  userId: string
  listingId: string
  createdAt: string
}
export type DraftRow = {
  id: string
  userId: string
  key: string
  data: Record<string, unknown>
}
export type EventRow = {
  id: string
  day: string
  targetId: string
  counts: Record<EventType, number>
}
export type ContactRow = {
  id: string
  name: string
  contact: string
  subject: (typeof contactSubjects)[number]
  message: string
  createdAt: string
}
export type BroadcastRow = Broadcast
export type UploadRow = {
  id: string
  name: string
  type: string
  bytes: ArrayBuffer
  // Set by POST /uploads, so a later save by id (PUT /me/business/images) can build the Media.
  media?: Media
}
// `id` is the lowercase ISO code; it never changes once the country exists. Only enabled countries reach the public site.
export type Country = {
  id: string
  name: Bilingual
  dialCode: string
  enabled: boolean
}
// Everything a backup copies and a restore puts back; the backup list itself is left out.
export type Snapshot = Omit<Db, "backups">
// Seeded rows carry no snapshot, so restoring one puts the seed data back.
export type BackupRow = Backup & { snapshot?: Snapshot }
export type PromotionPriceRow = PromotionPrice
export type SitePageRow = SitePage & { id: string }

export type Db = {
  taxonomy: Taxonomy
  countries: Country[]
  users: UserRow[]
  listings: ListingRow[]
  dealerships: Dealership[]
  workshops: Workshop[]
  mechanics: Mechanic[]
  reviews: Review[]
  favorites: FavoriteRow[]
  savedSearches: SavedSearchRow[]
  threads: ThreadRow[]
  messages: Message[]
  notifications: NotificationRow[]
  plans: Plan[]
  subscriptions: Subscription[]
  payments: Payment[]
  promotions: Promotion[]
  promotionPrices: PromotionPriceRow[]
  reports: Report[]
  verifications: VerificationRequest[]
  banners: Banner[]
  adPages: AdPageRow[]
  campaigns: CampaignRow[]
  pages: SitePageRow[]
  backups: BackupRow[]
  settings: Settings
  drafts: DraftRow[]
  events: EventRow[]
  contacts: ContactRow[]
  broadcasts: BroadcastRow[]
  uploads: Map<string, UploadRow>
  attempts: Map<string, number[]>
  // Email codes by `signup:<email>` or `reset:<email>`. A sign-up code carries the account to create once it is verified.
  codes: Map<string, EmailCode>
  // One-time reset tokens (a verified reset code), token to user id.
  resetTokens: Map<string, string>
}

export type EmailCode = {
  code: string
  expiresAt: number
  fails: number
  signup?: { fullName: string; password: string }
}

// Admin-set price and slot count of a page that sells banners; `free` is computed per request.
export type AdPageRow = Omit<AdPage, "free">
// `ownerName` is computed from the owner on the way out.
export type CampaignRow = Omit<Campaign, "ownerName">
