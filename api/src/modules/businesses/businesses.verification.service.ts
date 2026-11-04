import type { Executor } from "~/shared/db/tx"

import * as q from "./businesses.verification.queries"
import type { BusinessKind } from "./businesses.types"

/** Whether the business already carries the verified badge (a request for it is then pointless). */
export function isBusinessVerified(
  ex: Executor,
  ref: { kind: BusinessKind; id: string }
) {
  return q.isVerified(ex, ref)
}
