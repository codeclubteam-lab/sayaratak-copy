import type { Executor } from "~/shared/db/tx"

import * as q from "./businesses.subject.queries"

/**
 * The businesses with these ids as threads see them (kind, owner, name, page
 * slug), keyed by id. Unknown ids are left out.
 */
export async function listSubjects(ex: Executor, ids: string[]) {
  const rows = await q.listSubjectRows(ex, ids)
  return new Map(rows.map((row) => [row.id, row]))
}
