import type { Executor } from "~/shared/db/tx"

import { auditLog, type NewAuditRow } from "./audit.tables"

export async function insert(ex: Executor, row: NewAuditRow) {
  await ex.insert(auditLog).values(row)
}
