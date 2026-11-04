import { eq } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { dealerships, mechanics, workshops } from "./businesses.tables"
import type { BusinessKind } from "./businesses.types"

const TABLES = {
  dealership: dealerships,
  workshop: workshops,
  mechanic: mechanics,
} as const

/** Whether the business already carries the verified badge. */
export function isVerified(
  ex: Executor,
  ref: { kind: BusinessKind; id: string }
) {
  const table = TABLES[ref.kind]
  return ex
    .select({ verified: table.verified })
    .from(table)
    .where(eq(table.id, ref.id))
    .then(([row]) => row?.verified ?? false)
}
