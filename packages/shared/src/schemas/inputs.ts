import { z } from "zod"

import { broadcastAudienceSchema, notificationPrefsSchema } from "./api"
import {
  emailSchema,
  geoSchema,
  identifierSchema,
  localeSchema,
  nameSchema,
  optionalText,
  optionalInt,
  passwordSchema,
  phoneSchema,
  priceSchema,
  requiredText,
  roleSchema,
  yearSchema,
} from "./fields"
import {
  fuelSchema,
  intentSchema,
  listingStatusSchema,
  mediaSchema,
  moderationSchema,
  promotionTypeSchema,
  transmissionSchema,
  vehicleTypeSchema,
} from "./listing"
import { bannerCopySchema, settingsSchema, verificationLabels } from "./admin"
import { adPageIdSchema, creativeSchema } from "./ads"
import { extraFields } from "./listing-fields"
import { targetTypeSchema } from "./review"
import { interestSchema } from "./user"
import { searchParamsSchema } from "../search/schemas"

// Request bodies. Messages are i18n keys, as everywhere else.
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.required"),
})
export const signupInputSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})
export const emailInputSchema = z.object({ email: emailSchema })
export const codeInputSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "validation.otp"),
})
export const oauthInputSchema = z.object({
  accountId: z.string().min(1, "validation.required"),
})
export const otpSendInputSchema = z.object({
  identifier: z.string().optional(),
})
export const otpVerifyInputSchema = z.object({
  code: z.string().min(1, "validation.otp"),
  identifier: z.string().optional(),
})
export const resetInputSchema = z.object({
  token: z.string().min(1, "validation.required"),
  password: passwordSchema,
})
export const profilePatchSchema = z
  .object({
    fullName: nameSchema,
    // "" removes it. A new address needs the code sent to it.
    email: emailSchema.or(z.literal("")),
    phone: phoneSchema.or(z.literal("")),
    code: z.string().min(1, "validation.otp"),
    avatarUrl: z.string(),
    cityId: z.string(),
    interests: z.array(interestSchema),
    locale: localeSchema,
  })
  .partial()
export const passwordInputSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
})
export const draftInputSchema = z.object({
  data: z.record(z.string(), z.unknown()),
})
export const onboardingInputSchema = z.object({
  role: roleSchema.exclude(["admin"]),
  payload: z.record(z.string(), z.unknown()).default({}),
})
export const notificationPrefsInputSchema = notificationPrefsSchema.partial()

const listingFields = z.object({
  kind: z.enum(["vehicle", "part"]),
  intent: intentSchema,
  vehicleType: vehicleTypeSchema.nullable(),
  title: requiredText(120),
  description: optionalText(4000),
  price: priceSchema,
  negotiable: z.boolean(),
  rentPeriod: z.enum(["day", "week", "month"]).nullable(),
  condition: z.enum(["new", "used"]),
  makeId: z.string().nullable(),
  modelId: z.string().nullable(),
  makeOther: z.string().nullable(),
  modelOther: z.string().nullable(),
  year: yearSchema.nullable(),
  mileageKm: optionalInt(0, 5_000_000),
  fuel: fuelSchema.nullable(),
  transmission: transmissionSchema.nullable(),
  color: z.string().nullable(),
  engineCc: z.number().nullable(),
  payloadTons: z.number().nullable(),
  partNumber: z.string().nullable(),
  ...extraFields,
  partCategoryId: z.string().nullable(),
  compatibleTypes: z.array(vehicleTypeSchema),
  media: z.array(mediaSchema),
  cityId: z.string().min(1, "validation.required"),
  districtId: z.string().nullable(),
  location: geoSchema.nullable(),
  contact: z.object({
    phone: phoneSchema,
    whatsapp: phoneSchema.nullable(),
    showPhone: z.boolean(),
    methods: z
      .array(z.enum(["call", "whatsapp", "chat"]))
      .min(1, "validation.contact_required"),
  }),
  // true sends the listing to review (or publishes it for verified dealers), false keeps it a draft.
  submit: z.boolean(),
})
export const listingCreateSchema = listingFields
  .partial()
  .required({ title: true, price: true, cityId: true })
export const listingPatchSchema = listingFields
  .partial()
  .extend({ moderation: moderationSchema.optional() })
export const listingStatusInputSchema = z.object({
  status: listingStatusSchema,
})

export const reviewInputSchema = z.object({
  targetType: targetTypeSchema,
  targetId: z.string().min(1),
  rating: z.number().int().min(1, "validation.rating_required").max(5),
  body: z
    .string()
    .trim()
    .min(10, "validation.review_min")
    .max(1000, "validation.too_long")
    .optional(),
})
export const reviewPatchSchema = reviewInputSchema
  .pick({ rating: true, body: true })
  .partial()
export const replyInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "validation.message_min")
    .max(1000, "validation.too_long"),
})

export const favoriteInputSchema = z.object({ listingId: z.string().min(1) })
export const favoriteSortSchema = z.enum(["recent", "price_asc", "price_desc"])
export const savedSearchInputSchema = z.object({
  name: requiredText(60),
  params: searchParamsSchema,
  alerts: z.boolean().default(true),
})
export const savedSearchPatchSchema = z
  .object({
    name: requiredText(60),
    alerts: z.boolean(),
    markSeen: z.boolean(),
  })
  .partial()

export const threadInputSchema = z.object({
  subjectType: z.enum(["listing", "dealership", "workshop", "mechanic"]),
  subjectId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "validation.message_min")
    .max(2000, "validation.too_long"),
})
export const messageInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "validation.message_min")
    .max(2000, "validation.too_long"),
})
export const readInputSchema = z.object({ ids: z.array(z.string()).optional() })
// An installed app registers its push address (A18). Loose on `appVersion`: apps we cannot update may send any build string.
export const deviceInputSchema = z.object({
  platform: z.enum(["ios", "android"]),
  fcmToken: z.string().min(1).max(4096),
  appVersion: z.string().min(1).max(32),
  locale: z.enum(["ar", "en"]),
})

// `priceId` picks a row of the price list. A credit needs none: it is always a 7-day Featured, free and started at once.
export const promotionInputSchema = z
  .object({
    listingId: z.string().min(1),
    priceId: z.string().min(1).optional(),
    useCredit: z.boolean().optional(),
  })
  .refine((v) => v.useCredit || v.priceId, "validation.required")
export const reportInputSchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum([
    "scam",
    "wrong_category",
    "already_sold",
    "duplicate",
    "inappropriate",
    "other",
  ]),
  details: z.string().trim().max(1000, "validation.too_long").optional(),
})
export const contactSubjects = [
  "general",
  "listing_help",
  "business",
  "report_problem",
] as const
export const contactInputSchema = z.object({
  name: nameSchema,
  contact: identifierSchema,
  subject: z.enum(contactSubjects),
  message: z
    .string()
    .trim()
    .min(10, "validation.message_min")
    .max(1000, "validation.too_long"),
})
export const eventInputSchema = z.object({
  type: z.enum([
    "view",
    "phone_click",
    "whatsapp_click",
    "share",
    "banner_click",
    "banner_view",
  ]),
  targetId: z.string().min(1),
})

// Business self-service: a free-form patch limited to what each profile type can edit (checked in the handler).
export const businessPatchSchema = z.record(z.string(), z.unknown())
export const serviceInputSchema = z.object({
  name: requiredText(80),
  description: optionalText(300),
  priceFrom: optionalInt(1, 9_999_999_999, "validation.price_min"),
  templateId: z.string().nullable().default(null), // kept from the template, never edited by hand
})
export const portfolioInputSchema = z.object({
  imageId: z.string().min(1, "validation.required"), // an image upload
  caption: requiredText(120),
})
export const portfolioUpdateSchema = z.object({
  caption: requiredText(120),
  imageId: z.string().min(1, "validation.required").optional(),
})
export const idsInputSchema = z.object({ ids: z.array(z.string()) })
export const imagesInputSchema = z.object({
  url: z.string().min(1, "validation.required"),
})

export const rejectInputSchema = z.object({ reason: requiredText(300) })
export const noteInputSchema = z.object({
  note: z.string().max(300).optional(),
})
export const bulkInputSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(["approve", "reject", "remove", "restore"]),
  reason: z.string().optional(),
})
export const banInputSchema = z.object({
  reason: requiredText(300),
  duration: z.enum(["7d", "30d", "permanent"]),
})
// `POST /admin/reports/:id/action`: with `ban` the seller is banned, otherwise the listing is removed. Either way every open report on the listing closes.
export const reportActionInputSchema = noteInputSchema.extend({
  ban: banInputSchema.optional(),
})
// `reason` goes with a suspension.
export const businessAdminPatchSchema = z
  .object({
    status: z.enum(["active", "suspended"]),
    verified: z.boolean(),
    reason: z.string().trim().min(1).max(300),
  })
  .partial()
// A plan for one business; price, limit and duration are optional custom values copied into the subscription.
export const assignPlanInputSchema = z.object({
  planId: z.string().min(1),
  price: z.number().int().min(0).optional(),
  limit: z.number().int().min(0).nullable().optional(),
  durationDays: z.number().int().min(1).optional(),
  note: z.string().max(200).optional(),
})
// A plan as the admin writes it. A cap sent as null is taken off (no cap).
export const planInputSchema = z.object({
  audience: z.enum(["user", "dealership", "workshop", "mechanic"]),
  name: z.object({
    ar: z.string().trim().min(1).max(40),
    en: z.string().trim().min(1).max(40),
  }),
  price: z.number().int().min(0),
  durationDays: z.number().int().min(1).max(730),
  listingLimit: z.number().int().min(0).nullable(),
  serviceLimit: z.number().int().min(0).nullable(),
  photoLimit: z.number().int().min(0).nullable(),
  portfolioLimit: z.number().int().min(0).nullable(),
  featuredCredits: z.number().int().min(0),
  features: z
    .array(
      z.object({
        ar: z.string().trim().min(1).max(80),
        en: z.string().trim().min(1).max(80),
      })
    )
    .max(8),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
})
export const grantInputSchema = z.object({
  listingId: z.string().min(1),
  type: promotionTypeSchema,
  days: z.number().int().min(1).default(7),
})
// An internal path: one leading slash, never `//host`.
export const pathSchema = z
  .string()
  .trim()
  .regex(/^\/(?!\/)/, "validation.path")
  .max(200, "validation.too_long")
export const broadcastInputSchema = broadcastAudienceSchema.extend({
  title: z.object({ ar: requiredText(80), en: requiredText(80) }),
  body: z.object({ ar: requiredText(300), en: requiredText(300) }),
  href: pathSchema.optional(),
})
// `GET /admin/broadcasts/estimate`: the audience in the query string (`roles` repeated); Verified only is off when left out.
export const broadcastEstimateQuerySchema = broadcastAudienceSchema.extend({
  verifiedOnly: z.boolean().default(false),
})
export const adminListingPatchSchema = listingFields
  .pick({ title: true, description: true, price: true })
  .partial()
  .extend({
    status: listingStatusSchema.optional(),
    moderation: moderationSchema.optional(),
  })
export const taxonomyInputSchema = z.record(z.string(), z.unknown())
export const bannerInputSchema = z.object({
  title: requiredText(80),
  imageUrl: z.object({ ar: z.string(), en: z.string() }),
  copy: z.object({ ar: bannerCopySchema, en: bannerCopySchema }).optional(),
  sponsored: z.boolean().default(false),
  focus: z.number().min(0).max(100).default(50),
  href: z.string().min(1, "validation.path"),
  placement: z.enum([
    "home_top",
    "home_middle",
    "search_top",
    "listing_aside",
    "directory_top",
  ]),
  startsAt: z.string(),
  endsAt: z.string(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})
export const pagePatchSchema = z
  .object({
    title: z.object({ ar: z.string(), en: z.string() }),
    body: z.object({ ar: z.string(), en: z.string() }),
  })
  .partial()
// `PATCH /admin/settings`: any of the settings. The expiry stays at one day or more and the free limit at zero or more, as the database keeps them; the admin form is stricter.
export const settingsPatchSchema = settingsSchema
  .extend({
    listingExpiryDays: z.number().int().min(1, "validation.number"),
    freeListingLimit: z.number().int().min(0, "validation.number"),
  })
  .partial()

// A self-serve banner campaign: the banner, its link, the pages, and 1 to 4 weeks from a start day (YYYY-MM-DD).
export const campaignInputSchema = z.object({
  creative: creativeSchema,
  href: z.string().min(1, "validation.required"),
  pages: z.array(adPageIdSchema).min(1, "validation.ad_pages"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.required"),
  weeks: z.number().int().min(1).max(4),
})
export const adPagePatchSchema = z.object({
  weeklyPrice: z.number().int().min(0).optional(),
  slots: z.number().int().min(1).max(10).optional(),
  enabled: z.boolean().optional(),
})

// `POST /uploads` (multipart). `poster` is a video's first frame. The server reads width,
// height and color from the stored file; the client's values are accepted and ignored.
const fileSchema = z
  .instanceof(File, { message: "validation.required" })
  .meta({ type: "string", format: "binary" })
export const uploadFormSchema = z.object({
  file: fileSchema,
  poster: fileSchema.optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  placeholderColor: z.string().optional(),
})

// `POST /payments` (multipart): a Bankak receipt for a plan, promotion or campaign. A missing text field
// reads as empty, so the length message shows, as the mock reports it; `itemId` is checked against the item.
export const paymentFormSchema = z.object({
  itemType: z.enum(["plan", "promotion", "campaign"], "validation.required"),
  itemId: z.string().prefault(""),
  payerName: z
    .string()
    .prefault("")
    .pipe(z.string().trim().min(2, "validation.name_min")),
  transactionRef: z
    .string()
    .prefault("")
    .pipe(z.string().trim().min(4, "validation.txn_min")),
  receipt: fileSchema,
})
export type PaymentForm = z.infer<typeof paymentFormSchema>

// `POST /me/verification` (multipart): `label` and `file` once per document in the same order, 1 to 5
// of them, and an optional `note`. A bad label or count reads as `documents`, as the mock reports it.
export const verificationFormSchema = z
  .object({
    label: z.array(z.string()).default([]),
    file: z.array(fileSchema).default([]),
    note: z.string().trim().max(300, "validation.too_long").optional(),
  })
  .refine(
    (form) =>
      form.label.length >= 1 &&
      form.label.length <= 5 &&
      form.label.length === form.file.length &&
      form.label.every((label) =>
        (verificationLabels as readonly string[]).includes(label)
      ),
    { path: ["documents"], message: "validation.select_min" }
  )
