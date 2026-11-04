import type {
  notificationPrefsInputSchema,
  passwordInputSchema,
  profilePatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { isAPIError } from "better-auth/api"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { fail } from "~/shared/http/errors"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"
import * as uploads from "~/modules/uploads/uploads.service"

import { auth } from "./auth.config"
import { isPlaceholderEmail } from "./auth.mapper"
import * as q from "./auth.queries"
import { getMe } from "./auth.service"
import type { SessionUser } from "./auth.types"

type ProfilePatch = z.infer<typeof profilePatchSchema>
type PasswordInput = z.infer<typeof passwordInputSchema>
type PrefsPatch = z.infer<typeof notificationPrefsInputSchema>

// Better-Auth's email code errors, as the mock's codes (A6 error mapping).
// Five wrong tries delete the code, the same as an expired one.
const CODE_GONE = new Set(["OTP_EXPIRED", "TOO_MANY_ATTEMPTS"])
const OTP_INVALID_FIELDS = { code: "auth.otp_invalid" }

/**
 * Saves the settings form. A new email needs the code sent to it
 * (Better-Auth email-otp change-email); a new phone is saved without a code
 * and is not verified until SMS codes exist (owner, 3.5). "" removes the
 * phone, the city or the photo; the email cannot be removed.
 * `headers` carries the refreshed session cookie after an email change.
 */
export async function updateProfile(
  user: SessionUser,
  patch: ProfilePatch,
  requestHeaders: Headers
) {
  const headers = await changeEmail(user, patch, requestHeaders)
  const fields = {
    name: patch.fullName,
    interests: patch.interests,
    locale: patch.locale,
    ...(await phoneChange(user, patch.phone)),
    ...(await cityChange(patch.cityId)),
    ...(await avatarChange(user, patch.avatarUrl)),
  }
  // Drizzle skips undefined values; with none left it would refuse the update.
  // Read again even with nothing else to save: the email may have changed.
  const row = Object.values(fields).some((value) => value !== undefined)
    ? await q.updateProfile(db, user.id, fields)
    : await q.getUser(db, user.id)
  return { me: await getMe(row ?? user), headers }
}

/**
 * Changes the password, or sets a first one for a Google or Facebook only
 * account (Better-Auth's client cannot, O2). Other sessions are signed out
 * and this one gets a new cookie (A12).
 */
export async function changePassword(
  user: SessionUser,
  input: PasswordInput,
  requestHeaders: Headers
) {
  if (!(await q.hasPassword(db, user.id))) {
    await auth.api.setPassword({
      headers: requestHeaders,
      body: { newPassword: input.newPassword },
    })
    return new Headers()
  }
  const { headers } = await auth.api
    .changePassword({
      headers: requestHeaders,
      body: {
        currentPassword: input.currentPassword ?? "",
        newPassword: input.newPassword,
        revokeOtherSessions: true,
      },
      returnHeaders: true,
    })
    .catch(toInvalidCredentials)
  return headers
}

/** The notification switches in settings. */
export function getPrefs(user: SessionUser) {
  return user.prefs
}

/** Saves the switches the form changed; the rest keep their value. */
export async function updatePrefs(user: SessionUser, patch: PrefsPatch) {
  const prefs = { ...user.prefs, ...patch }
  await q.updatePrefs(db, user.id, prefs)
  return prefs
}

async function changeEmail(
  user: SessionUser,
  patch: ProfilePatch,
  requestHeaders: Headers
) {
  const shown = isPlaceholderEmail(user.email) ? "" : user.email
  const email = patch.email?.toLowerCase()
  if (email === undefined || email === shown) return new Headers()
  if (email === "") fail.invalid("contact_required")
  if (await q.hasOtherWithEmail(db, { email, userId: user.id }))
    fail.conflict("exists")
  if (!patch.code) fail.invalid("otp_invalid", OTP_INVALID_FIELDS)
  const { headers } = await auth.api
    .changeEmailEmailOTP({
      headers: requestHeaders,
      body: { newEmail: email, otp: patch.code },
      returnHeaders: true,
    })
    .catch(toCodeError)
  return headers
}

async function phoneChange(user: SessionUser, phone: string | undefined) {
  if (phone === undefined || phone === (user.phone ?? "")) return {}
  if (phone === "") return { phone: null, verifiedPhone: false }
  if (await q.hasOtherWithPhone(db, { phone, userId: user.id }))
    fail.conflict("exists")
  return { phone, verifiedPhone: false }
}

async function cityChange(cityId: string | undefined) {
  if (cityId === undefined) return {}
  if (cityId === "") return { cityId: null }
  if (!(await taxonomy.isCity(db, cityId)))
    fail.validation({ cityId: "validation.required" })
  return { cityId }
}

async function avatarChange(user: SessionUser, url: string | undefined) {
  if (url === undefined) return {}
  if (url === "") return { avatarUploadId: null }
  const id = await uploads.getOwnImageId(db, { ownerUserId: user.id, url })
  if (!id) fail.validation({ avatarUrl: "validation.url" })
  return { avatarUploadId: id }
}

// A caught Better-Auth error: a wrong current password is the mock's 401.
function toInvalidCredentials(error: unknown): never {
  if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD")
    fail.invalidCredentials()
  throw error
}

// A caught Better-Auth error from the email code check, as the mock answers it.
function toCodeError(error: unknown): never {
  if (!isAPIError(error)) throw error
  if (CODE_GONE.has(error.body?.code ?? "")) fail.gone("code_expired")
  fail.invalid("otp_invalid", OTP_INVALID_FIELDS)
}
