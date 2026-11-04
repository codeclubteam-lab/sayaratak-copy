import type { AdTarget } from "@sayaratak/shared/schemas/ads"

import type { Executor } from "~/shared/db/tx"
import type { SessionUser } from "~/modules/auth/auth.types"
import { getBusinessIdOf } from "~/modules/businesses/businesses.service"
import { listSubjects } from "~/modules/businesses/businesses.subject.service"
import { listPublicLinksOf } from "~/modules/listings/listings.read.service"

// The first 50 public listings only, as the mock: a banner can link to a few.
const LISTING_TARGETS_MAX = 50
const PROFILE_BASE = {
  dealership: "/dealerships",
  workshop: "/workshops",
  mechanic: "/mechanics",
} as const

/**
 * `GET /me/ad-targets`: where the advertiser's banner may link. Their own
 * public profile first, then their public listings.
 */
export async function listAdTargets(ex: Executor, user: SessionUser) {
  const businessId = await getBusinessIdOf(ex, user.id)
  const [profile, links] = await Promise.all([
    businessId
      ? listSubjects(ex, [businessId]).then((found) => found.get(businessId))
      : undefined,
    listPublicLinksOf(ex, {
      ownerUserId: user.id,
      limit: LISTING_TARGETS_MAX,
    }),
  ])
  const targets: AdTarget[] = links.map((link) => ({
    href: `/listing/${link.slug}`,
    label: { ar: link.title, en: link.title },
  }))
  if (profile)
    targets.unshift({
      href: `${PROFILE_BASE[profile.kind]}/${profile.slug}`,
      label: profile.name,
    })
  return targets
}
