import type { Executor } from "~/shared/db/tx"
import * as uploads from "~/modules/uploads/uploads.media.service"

import * as q from "./listings.queries"
import * as subjects from "./listings.subject.queries"

/**
 * The listings with these ids as threads see them (owner, title, page slug,
 * first photo address), keyed by id. A listing is a subject whatever its
 * moderation state, as in the mock. Unknown ids are left out.
 */
export async function listSubjects(ex: Executor, ids: string[]) {
  const [rows, media] = await Promise.all([
    subjects.listSubjectRows(ex, ids),
    q.listMediaIds(ex, ids),
  ])
  // The rows come ordered by listing, then position: the first of each listing is its cover.
  const coverIds = new Map<string, string>()
  for (const row of media)
    if (!coverIds.has(row.listingId)) coverIds.set(row.listingId, row.uploadId)
  const covers = await uploads.getMediaOf(ex, [...coverIds.values()])
  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        imageUrl: covers.get(coverIds.get(row.id) ?? "")?.url,
      },
    ])
  )
}
