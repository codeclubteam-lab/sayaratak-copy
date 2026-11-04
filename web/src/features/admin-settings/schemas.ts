import { z } from "zod"

import {
  emailSchema,
  optionalText,
  phoneSchema,
  requiredInt,
  requiredText,
} from "@sayaratak/shared/schemas/fields"

export const listingSettingsSchema = z.object({
  autoApproveVerifiedDealers: z.boolean(),
  listingExpiryDays: requiredInt(7, 180),
})
export type ListingSettings = z.infer<typeof listingSettingsSchema>

export const paymentSettingsSchema = z.object({
  bankakAccountName: requiredText(80),
  bankakAccountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "validation.account_number"),
})
export type PaymentSettings = z.infer<typeof paymentSettingsSchema>

export const contactSettingsSchema = z.object({
  phone: phoneSchema,
  whatsapp: phoneSchema.or(z.literal("")),
  email: emailSchema,
  address: optionalText(200),
})
export type ContactSettings = z.infer<typeof contactSettingsSchema>
