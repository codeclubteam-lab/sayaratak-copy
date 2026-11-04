import type { User } from "@sayaratak/shared/schemas/user"

import type { UserRow } from "./auth.tables"

// RFC 2606 reserves `.invalid`: no mail can ever reach it.
const PLACEHOLDER_DOMAIN = "@facebook.invalid"

/** The email of a Facebook account that gave none (owner, 3.4). */
export function placeholderEmail(facebookId: string) {
  return `fb-${facebookId}${PLACEHOLDER_DOMAIN}`
}

/** A placeholder, not an address the person gave. */
export function isPlaceholderEmail(email: string) {
  return email.endsWith(PLACEHOLDER_DOMAIN)
}

type Extras = { hasPassword: boolean; avatarUrl: string | undefined }

/** The account as `GET /me` answers it, in `userSchema` order (the mock's `publicUser`). */
export function toUser(row: UserRow, extras: Extras): User {
  return {
    id: row.id,
    role: row.role,
    fullName: row.name,
    email: isPlaceholderEmail(row.email) ? undefined : row.email,
    phone: row.phone ?? undefined,
    avatarUrl: extras.avatarUrl,
    cityId: row.cityId ?? undefined,
    verifiedPhone: row.verifiedPhone,
    verifiedEmail: row.emailVerified,
    hasPassword: extras.hasPassword,
    banned: row.banned,
    bannedReason: row.banReason ?? undefined,
    bannedUntil: row.banExpires?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    onboardingDone: row.onboardingDone,
    interests: row.interests,
    chosenPlanId: row.chosenPlanId ?? undefined,
  }
}

/** How an admin table names an account: its name, phone (when it has one) and email. */
export function toOwnerContact(row: UserRow) {
  return {
    name: row.name,
    ...(row.phone !== null && { phone: row.phone }),
    email: row.email,
  }
}
