import { z } from "zod"

import {
  geoSchema,
  nameSchema,
  optionalInt,
  phoneSchema,
  requiredInt,
  requiredText,
  weeklyHoursSchema,
} from "@sayaratak/shared/schemas/fields"
import { interestSchema } from "@sayaratak/shared/schemas/user"

export const roleChoiceSchema = z.object({
  role: z.enum(["user", "dealership", "workshop", "mechanic"]),
})
export type RoleChoice = z.infer<typeof roleChoiceSchema>
export type OnboardingRole = RoleChoice["role"]

export const roleDraftKey = "onboarding:role"
export const onboardingDraftKey = (role: OnboardingRole) => `onboarding:${role}`

export const userOnboardingSchema = z.object({
  cityId: z.string().min(1, "validation.required"),
  avatarId: z.string().optional(),
  interests: z.array(interestSchema).max(7),
})
export type UserOnboarding = z.infer<typeof userOnboardingSchema>

export const dealerBusinessSchema = z.object({
  name: requiredText(80),
  description: z
    .string()
    .trim()
    .min(20, "validation.desc_min")
    .max(1000, "validation.too_long"),
  logoId: z.string().optional(),
  coverId: z.string().optional(),
})
export type DealerBusiness = z.infer<typeof dealerBusinessSchema>

// `location` is null until a pin is dropped, which is how the map block reports it.
export const dealerLocationSchema = z.object({
  cityId: z.string().min(1, "validation.required"),
  districtId: z.string().min(1, "validation.required"),
  address: requiredText(160),
  location: geoSchema.nullable(),
  phones: z
    .array(z.object({ value: phoneSchema }))
    .min(1, "validation.phone_min")
    .max(3),
  whatsapp: phoneSchema.or(z.literal("")),
})
export type DealerLocation = z.infer<typeof dealerLocationSchema>

export const hoursStepSchema = z.object({ hours: weeklyHoursSchema })
export type HoursStep = z.infer<typeof hoursStepSchema>

export const workshopBusinessSchema = dealerBusinessSchema

export const workshopLocationSchema = dealerLocationSchema
  .omit({ phones: true })
  .extend({ phone: phoneSchema })
export type WorkshopLocation = z.infer<typeof workshopLocationSchema>

export const serviceRowSchema = z.object({
  name: requiredText(60),
  priceFrom: optionalInt(1, 9_999_999_999, "validation.price_min"),
  templateId: z.string().nullable(), // set when picked from the templates, null for a custom service
})

export const workshopHoursServicesSchema = hoursStepSchema.extend({
  services: z.array(serviceRowSchema).min(1, "validation.select_min").max(10),
})
export type WorkshopHoursServices = z.infer<typeof workshopHoursServicesSchema>

export const planStepSchema = z.object({
  planId: z.string().min(1, "validation.required"),
})
export type PlanStep = z.infer<typeof planStepSchema>

export const mechanicAboutSchema = z.object({
  name: nameSchema,
  photoId: z.string().optional(),
  phone: phoneSchema,
  whatsapp: phoneSchema.or(z.literal("")),
  yearsOfExperience: requiredInt(0, 60),
  bio: z
    .string()
    .trim()
    .min(20, "validation.desc_min")
    .max(600, "validation.too_long"),
})
export type MechanicAbout = z.infer<typeof mechanicAboutSchema>

export const mechanicExpertiseSchema = z.object({
  specializationIds: z.array(z.string()).min(1, "validation.select_min").max(6),
  cityId: z.string().min(1, "validation.required"),
  servedCityIds: z.array(z.string()).max(5),
})
export type MechanicExpertise = z.infer<typeof mechanicExpertiseSchema>

export const mechanicContactPlanSchema = planStepSchema.extend({
  phone: phoneSchema,
  whatsapp: phoneSchema.or(z.literal("")),
})
export type MechanicContactPlan = z.infer<typeof mechanicContactPlanSchema>
