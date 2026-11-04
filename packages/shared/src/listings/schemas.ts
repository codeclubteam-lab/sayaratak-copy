import { z } from "zod"

import {
  geoSchema,
  nameSchema,
  optionalInt,
  phoneSchema,
  priceSchema,
  yearSchema,
} from "../schemas/fields"
import { extraFields } from "../schemas/listing-fields"
import {
  fuelSchema,
  intentSchema,
  mediaSchema,
  transmissionSchema,
  vehicleTypeSchema,
  type VehicleType,
} from "../schemas/listing"

export const reportReasons = [
  "scam",
  "wrong_category",
  "already_sold",
  "duplicate",
  "inappropriate",
  "other",
] as const

export const reportSchema = z
  .object({
    reason: z.enum(reportReasons, { error: "validation.required" }),
    details: z.string().trim().max(500, "validation.too_long").optional(),
  })
  .refine(
    (v) => v.reason !== "other" || (v.details && v.details.length >= 10),
    {
      path: ["details"],
      message: "validation.details_required",
    }
  )
export type ReportForm = z.infer<typeof reportSchema>

// Step `type` of the post wizard.
export const typeStepSchema = z
  .object({
    kind: z.enum(["vehicle", "part"]),
    vehicleType: vehicleTypeSchema.nullable(),
    intent: intentSchema,
    partCategoryId: z.string().nullable(),
    compatibleTypes: z.array(vehicleTypeSchema),
  })
  .superRefine((v, ctx) => {
    const need = (
      ok: boolean,
      path: string,
      message = "validation.required"
    ) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message })
    }
    if (v.kind === "vehicle") need(v.vehicleType !== null, "vehicleType")
    if (v.kind === "part") {
      need(v.partCategoryId !== null, "partCategoryId")
      need(
        v.compatibleTypes.length > 0,
        "compatibleTypes",
        "validation.select_min"
      )
    }
  })

// The colors of the details step, stored as these English values and shown through `color.*` keys.
export const listingColors = [
  "white",
  "black",
  "silver",
  "grey",
  "red",
  "blue",
  "green",
  "beige",
  "brown",
  "yellow",
  "orange",
  "other",
] as const

// Step `details` of the post wizard: the fields every listing has. `detailsSchema` adds what depends on the type chosen earlier.
export const detailsBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "validation.title_min")
    .max(90, "validation.too_long"),
  description: z
    .string()
    .trim()
    .min(20, "validation.desc_min")
    .max(2000, "validation.too_long"),
  price: priceSchema,
  negotiable: z.boolean(),
  rentPeriod: z.enum(["day", "week", "month"]).nullable(),
  condition: z.enum(["new", "used"]),
  makeId: z.string().nullable(),
  modelId: z.string().nullable(),
  makeOther: z.string().trim().max(40, "validation.too_long").nullable(),
  modelOther: z.string().trim().max(40, "validation.too_long").nullable(),
  year: yearSchema.nullable(),
  mileageKm: optionalInt(0, 2_000_000),
  fuel: fuelSchema.nullable(),
  transmission: transmissionSchema.nullable(),
  color: z.string().nullable(),
  engineCc: optionalInt(20, 20_000),
  payloadTons: z
    .number({ message: "validation.required" })
    .min(0, "validation.number")
    .max(100, "validation.too_large")
    .nullable(),
  partNumber: z.string().trim().max(40, "validation.too_long").optional(),
  ...extraFields,
})

type Details = z.infer<typeof detailsBaseSchema>

// One rule per field that is required only for some types. `when` keeps a rule running after a field has a type error (an empty price), so one press of Next lists every problem of the step.
export const detailsSchema = (ctx: {
  kind: "vehicle" | "part"
  vehicleType: VehicleType | null
  intent: "sale" | "rent"
}) => {
  const vehicle = ctx.kind === "vehicle"
  const gearbox = ctx.vehicleType === "car" || ctx.vehicleType === "truck"
  const part = ctx.kind === "part"
  const rules: [boolean, (v: Details) => boolean, string, string?][] = [
    [vehicle, (v) => !!(v.makeId || v.makeOther), "makeId"],
    [vehicle, (v) => !!(v.modelId || v.modelOther), "modelId"],
    [vehicle, (v) => v.year !== null, "year"],
    [vehicle, (v) => v.fuel !== null, "fuel"],
    [vehicle && gearbox, (v) => v.transmission !== null, "transmission"],
    [
      vehicle,
      (v) => v.condition === "new" || v.mileageKm !== null,
      "mileageKm",
    ],
    [ctx.intent === "rent", (v) => v.rentPeriod !== null, "rentPeriod"],
    [
      part,
      (v) =>
        v.fitsYearFrom === null ||
        v.fitsYearTo === null ||
        v.fitsYearFrom <= v.fitsYearTo,
      "fitsYearTo",
      "validation.year_order",
    ],
  ]
  return rules
    .filter(([applies]) => applies)
    .reduce(
      (schema, [, ok, path, message]) =>
        schema.refine(ok, {
          path: [path],
          message: message ?? "validation.required",
          when: () => true,
        }),
      detailsBaseSchema
    )
}

// Step `photos` of the post wizard: photos first and at most one video last, so the cover is always a photo.
export const photosStepSchema = z
  .object({ media: z.array(mediaSchema) })
  .superRefine((v, ctx) => {
    const images = v.media.filter((m) => m.type === "image").length
    const videos = v.media.length - images
    const bad = (message: string) =>
      ctx.addIssue({ code: "custom", path: ["media"], message })
    if (images < 3) bad("validation.media_min")
    if (images > 20) bad("validation.media_max")
    if (videos > 1) bad("validation.video_max")
  })

// Step `contact` of the post wizard. `when` keeps the WhatsApp rule running beside a phone error, so one press of Next lists every problem.
export const contactStepSchema = z
  .object({
    cityId: z.string().min(1, "validation.required"),
    districtId: z.string().min(1, "validation.required"),
    location: geoSchema.nullable(),
    phone: phoneSchema,
    whatsapp: phoneSchema.nullable(),
    showPhone: z.boolean(),
    methods: z
      .array(z.enum(["call", "whatsapp", "chat"]))
      .min(1, "validation.select_min"),
  })
  .refine((v) => !v.methods.includes("whatsapp") || v.whatsapp !== null, {
    path: ["whatsapp"],
    message: "validation.required",
    when: () => true,
  })

// The whole wizard payload, flat: the four steps merged, every field present and `null` (or `[]`) when empty. `toListingInput` builds it; the mock checks a submitted listing against it and then against each step's own rules.
export const listingInputSchema = z.object({
  kind: z.enum(["vehicle", "part"]),
  vehicleType: vehicleTypeSchema.nullable(),
  intent: intentSchema,
  partCategoryId: z.string().nullable(),
  compatibleTypes: z.array(vehicleTypeSchema),
  ...detailsBaseSchema.shape,
  partNumber: z.string().trim().max(40, "validation.too_long").nullable(),
  media: z.array(mediaSchema),
  cityId: z.string(),
  districtId: z.string(),
  location: geoSchema.nullable(),
  phone: phoneSchema,
  whatsapp: phoneSchema.nullable(),
  showPhone: z.boolean(),
  methods: z.array(z.enum(["call", "whatsapp", "chat"])).min(1),
})
export type ListingInput = z.infer<typeof listingInputSchema>

// Step `review`: nothing to check, except the name and city of an account that has none yet. Those fields are in the form only while the step shows them.
export const reviewProfileSchema = z.object({
  profileName: nameSchema,
  profileCityId: z.string().min(1, "validation.required"),
})

// The offer on the done step. Nothing is chosen until the owner picks a row.
export const promotionChoiceSchema = z.object({
  // A price row id.
  promotion: z
    .string({ error: "post.promo_required" })
    .min(1, "post.promo_required"),
})
