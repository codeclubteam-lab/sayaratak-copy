import { z } from "zod"

import {
  emailSchema,
  nameSchema,
  passwordSchema,
} from "@sayaratak/shared/schemas/fields"

const confirmed = <T extends { password: string; confirmPassword: string }>(
  v: T
) => v.password === v.confirmPassword

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.required"),
})
export const signupFormSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "validation.required"),
    terms: z.boolean().refine(Boolean, "validation.terms"),
  })
  .refine(confirmed, {
    path: ["confirmPassword"],
    message: "validation.password_match",
  })
export const emailFormSchema = z.object({ email: emailSchema })
export const newPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "validation.required"),
  })
  .refine(confirmed, {
    path: ["confirmPassword"],
    message: "validation.password_match",
  })
export const otpFormSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "validation.otp"),
})
export type LoginForm = z.infer<typeof loginFormSchema>
export type SignupForm = z.infer<typeof signupFormSchema>
export type EmailForm = z.infer<typeof emailFormSchema>
export type NewPasswordForm = z.infer<typeof newPasswordFormSchema>
