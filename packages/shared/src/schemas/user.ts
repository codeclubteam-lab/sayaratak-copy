import { z } from "zod"

import { emailSchema, idSchema, phoneSchema, roleSchema } from "./fields"

// What a person chose to follow during onboarding (A9 step 5.x).
export const interestSchema = z.enum([
  "cars",
  "trucks",
  "motorcycles",
  "tuk_tuks",
  "parts",
  "workshops",
  "mechanics",
])
export type Interest = z.infer<typeof interestSchema>

export const userSchema = z.object({
  id: idSchema,
  role: roleSchema,
  fullName: z.string(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  avatarUrl: z.string().optional(),
  cityId: z.string().optional(),
  verifiedPhone: z.boolean(),
  verifiedEmail: z.boolean(),
  // False for accounts made with Google or Facebook: they set a password instead of changing one.
  hasPassword: z.boolean(),
  banned: z.boolean(),
  bannedReason: z.string().optional(),
  // End of a timed ban; absent for a permanent one.
  bannedUntil: z.string().optional(),
  createdAt: z.string(),
  onboardingDone: z.boolean(),
  interests: z.array(interestSchema),
  // A paid plan picked in onboarding and not paid for yet. Cleared when a receipt is sent or the owner keeps the free plan; a rejected receipt sets it again.
  chosenPlanId: idSchema.optional(),
})
export type User = z.infer<typeof userSchema>
