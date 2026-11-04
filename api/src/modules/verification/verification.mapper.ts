import type { VerificationRequest } from "@sayaratak/shared/schemas/admin"

import type { verificationRequests } from "./verification.tables"

type RequestRow = typeof verificationRequests.$inferSelect

export function toVerificationRequest(
  row: RequestRow,
  documents: VerificationRequest["documents"]
): VerificationRequest {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    ownerId: row.ownerId,
    documents,
    note: row.note ?? undefined,
    status: row.status,
    rejectionReason: row.rejectionReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }
}
