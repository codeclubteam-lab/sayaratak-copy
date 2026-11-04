import { z } from "zod"

import {
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
} from "@sayaratak/shared/schemas/fields"

// The fields are strings, "" meaning empty, so every input stays controlled. The avatar is the stored url, as `PATCH /me` takes it.
// Every account keeps an email (sign-in is by email); the phone is optional.
export const profileFormSchema = z.object({
  fullName: nameSchema,
  email: z.string().trim().min(1, "validation.required").pipe(emailSchema),
  phone: phoneSchema.or(z.literal("")),
  cityId: z.string(),
  avatarUrl: z.string(),
})
export type ProfileForm = z.infer<typeof profileFormSchema>

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.required"),
    newPassword: passwordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "validation.password_same",
  })
export type PasswordForm = z.infer<typeof passwordFormSchema>

// An account made with Google or Facebook has no current password to give; the field is left out and sent empty.
export const newPasswordFormSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema,
})

export const deleteAccountSchema = z.object({
  phrase: z
    .string()
    .trim()
    .refine((v): boolean => v === "DELETE" || v === "حذف", "validation.phrase"),
})
export type DeleteAccountForm = z.infer<typeof deleteAccountSchema>
