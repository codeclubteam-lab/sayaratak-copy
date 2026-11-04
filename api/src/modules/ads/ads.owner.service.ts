import type { Executor } from "~/shared/db/tx"
import { listPeople } from "~/modules/auth/auth.service"
import { getBusinessIdOf } from "~/modules/businesses/businesses.service"
import { listSubjects } from "~/modules/businesses/businesses.subject.service"

/**
 * How an advertiser is named on a campaign: the business name in each
 * language, else the account's name in both. Empty for a deleted account.
 */
export async function getOwnerNames(ex: Executor, ownerId: string | null) {
  if (!ownerId) return { ar: "", en: "" }
  const businessId = await getBusinessIdOf(ex, ownerId)
  const business =
    businessId && (await listSubjects(ex, [businessId])).get(businessId)
  if (business) return business.name
  const name = (await listPeople(ex, [ownerId])).get(ownerId)?.name ?? ""
  return { ar: name, en: name }
}
