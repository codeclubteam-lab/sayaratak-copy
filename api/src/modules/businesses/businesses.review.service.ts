import type { businessAdminPatchSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { both } from "~/shared/text/bilingual"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import { notify } from "~/modules/notifications/notifications.service"

import * as q from "./businesses.admin.queries"
import type { BusinessKind } from "./businesses.types"

type Patch = z.output<typeof businessAdminPatchSchema>
type Found = NonNullable<Awaited<ReturnType<typeof q.lockById>>>
type Target = Pick<Found, "kind" | "row">

// The owner's dashboard base is the business kind's: a dealership owner is a `dealership` account.
const DASHBOARD: Record<BusinessKind, string> = {
  dealership: "/dealer",
  workshop: "/workshop",
  mechanic: "/mechanic",
}

/**
 * Sets the verified badge and the suspension of one business, inside the
 * caller's transaction. Taking the badge away tells the owner; suspending needs
 * a reason (422) and tells the owner, and so does restoring. A value the
 * business already has changes nothing: no audit row, no notice. A dealership's
 * listings read the badge from the dealership, so they follow by themselves.
 */
export async function reviewBusiness(
  tx: Transaction,
  actor: Actor,
  change: { id: string; patch: Patch }
) {
  const found = await q.lockById(tx, change.id)
  if (!found) fail.notFound()
  const { verified, status, reason } = change.patch
  const suspending = status === "suspended" && found.row.status !== "suspended"
  if (suspending && !reason) fail.validation({ reason: "validation.required" })
  if (verified !== undefined)
    await setVerified(tx, actor, { ...found, verified })
  if (suspending) await suspend(tx, actor, { ...found, reason: reason ?? "" })
  else if (status === "active") await restore(tx, actor, found)
}

async function setVerified(
  tx: Transaction,
  actor: Actor,
  { kind, row, verified }: Target & { verified: boolean }
) {
  if (verified === row.verified) return
  await q.updateFlags(tx, { kind, id: row.id, set: { verified } })
  await recordAudit(tx, actor, {
    action: verified ? "business.verify" : "business.unverify",
    targetType: "business",
    targetId: row.id,
    before: { verified: row.verified },
    after: { verified },
  })
  if (verified) return
  await notify(tx, {
    userId: row.ownerUserId,
    type: "verification_result",
    title: { ar: "أُزيلت شارة التوثيق", en: "Your verified badge was removed" },
    body: {
      ar: "يمكنك طلب التوثيق من جديد.",
      en: "You can ask to be verified again.",
    },
    href: "/verification",
  })
}

async function suspend(
  tx: Transaction,
  actor: Actor,
  { kind, row, reason }: Target & { reason: string }
) {
  await q.updateFlags(tx, {
    kind,
    id: row.id,
    set: { status: "suspended", suspendedReason: reason },
  })
  await recordAudit(tx, actor, {
    action: "business.suspend",
    targetType: "business",
    targetId: row.id,
    before: { status: row.status },
    after: { status: "suspended" },
    reason,
  })
  await notify(tx, {
    userId: row.ownerUserId,
    type: "business_status",
    title: { ar: "تم إيقاف صفحتك", en: "Your page is suspended" },
    body: both(reason),
    href: DASHBOARD[kind],
  })
}

async function restore(tx: Transaction, actor: Actor, { kind, row }: Target) {
  if (row.status === "active") return
  await q.updateFlags(tx, {
    kind,
    id: row.id,
    set: { status: "active", suspendedReason: null },
  })
  await recordAudit(tx, actor, {
    action: "business.restore",
    targetType: "business",
    targetId: row.id,
    before: { status: row.status, suspendedReason: row.suspendedReason },
    after: { status: "active" },
  })
  await notify(tx, {
    userId: row.ownerUserId,
    type: "business_status",
    title: { ar: "عادت صفحتك للظهور", en: "Your page is back" },
    body: {
      ar: "صفحتك وإعلاناتك ظاهرة للزوار من جديد.",
      en: "Your page and listings show to visitors again.",
    },
    href: DASHBOARD[kind],
  })
}

/**
 * Gives the badge after an admin accepted a verification request. A business
 * that is gone, or already verified, is left as it is; no notice here (the
 * request's decision tells the owner).
 */
export async function markVerified(
  tx: Transaction,
  ref: { kind: BusinessKind; id: string }
) {
  await q.updateFlags(tx, { ...ref, set: { verified: true } })
}
