import { z } from "zod"

import {
  bilingualSchema,
  geoSchema,
  idSchema,
  phoneSchema,
  weeklyHoursSchema,
} from "./fields"
import { mediaSchema } from "./listing"
import { ratingSchema } from "./review"

// A banned owner's public page carries no contact: phones empty, `phone` empty text, `whatsapp` null.
const hideablePhoneSchema = phoneSchema.or(z.literal(""))

export const profileStatusSchema = z.enum(["active", "suspended"])
export type ProfileStatus = z.infer<typeof profileStatusSchema>

// Name, description and bio are stored in both languages: the owner types one, the server translates it on save, and each visitor reads their own.
// A map pin is optional when a business signs up, and so is a WhatsApp number.
export const dealershipSchema = z.object({
  id: idSchema,
  slug: z.string(),
  ownerId: idSchema,
  name: bilingualSchema,
  logoUrl: z.string(),
  coverUrl: z.string(),
  description: bilingualSchema,
  cityId: z.string(),
  districtId: z.string(),
  address: z.string(),
  location: geoSchema.nullable(),
  phones: z.array(phoneSchema),
  whatsapp: phoneSchema.nullable(),
  hours: weeklyHoursSchema,
  rating: ratingSchema,
  verified: z.boolean(),
  inventoryCount: z.number().int(),
  status: profileStatusSchema,
  // Why the admin suspended it; the owner's dashboard shows it.
  suspendedReason: z.string().optional(),
  // Set on the public profile while the owner is banned: the page shows a notice and no contact.
  unavailable: z.literal(true).optional(),
  createdAt: z.string(),
})
export type Dealership = z.infer<typeof dealershipSchema>

export const workshopSchema = z.object({
  id: idSchema,
  slug: z.string(),
  ownerId: idSchema,
  name: bilingualSchema,
  logoUrl: z.string(),
  coverUrl: z.string().optional(),
  description: bilingualSchema,
  cityId: z.string(),
  districtId: z.string(),
  address: z.string(),
  location: geoSchema.nullable(),
  phone: hideablePhoneSchema,
  whatsapp: phoneSchema.nullable(),
  hours: weeklyHoursSchema,
  images: z.array(mediaSchema),
  services: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      description: z.string(),
      priceFrom: z.number().int().optional(),
      // Set when the service was picked from the service templates, null for a custom one. The directory `service` filter matches on it.
      templateId: z.string().nullable(),
    })
  ),
  rating: ratingSchema,
  verified: z.boolean(),
  status: profileStatusSchema,
  // Why the admin suspended it; the owner's dashboard shows it.
  suspendedReason: z.string().optional(),
  // Set on the public profile while the owner is banned: the page shows a notice and no contact.
  unavailable: z.literal(true).optional(),
  createdAt: z.string(),
})
export type Workshop = z.infer<typeof workshopSchema>

export const mechanicSchema = z.object({
  id: idSchema,
  slug: z.string(),
  ownerId: idSchema,
  name: bilingualSchema,
  photoUrl: z.string(),
  bio: bilingualSchema,
  cityId: z.string(),
  servedCityIds: z.array(z.string()),
  yearsOfExperience: z.number().int(),
  specializationIds: z.array(z.string()),
  phone: hideablePhoneSchema,
  whatsapp: phoneSchema.nullable(),
  portfolio: z.array(
    z.object({
      id: idSchema,
      url: z.string(),
      caption: z.string(),
      width: z.number(),
      height: z.number(),
      placeholderColor: z.string(),
    })
  ),
  available: z.boolean(),
  rating: ratingSchema,
  verified: z.boolean(),
  status: profileStatusSchema,
  // Why the admin suspended it; the owner's dashboard shows it.
  suspendedReason: z.string().optional(),
  // Set on the public profile while the owner is banned: the page shows a notice and no contact.
  unavailable: z.literal(true).optional(),
  createdAt: z.string(),
})
export type Mechanic = z.infer<typeof mechanicSchema>
