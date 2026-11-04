import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import { type SQL, sql } from "drizzle-orm"
import { type AnyPgColumn, integer, timestamp } from "drizzle-orm/pg-core"

import { jsonb } from "~/shared/db/jsonb"

// Lists answer in the mock's array order, new rows last, so ordered tables keep an insert position.
export const position = () => integer().generatedByDefaultAsIdentity().notNull()
export const bilingualText = () => jsonb().$type<Bilingual>().notNull()
export const createdAt = () => timestamp({ withTimezone: true }).notNull()

// A bilingual value is an object with a string in both slots. `is true` because a missing key
// makes the test null, and a check that is null passes.
export function bilingual(column: AnyPgColumn): SQL {
  return sql`(jsonb_typeof(${column} -> 'ar') = 'string' and jsonb_typeof(${column} -> 'en') = 'string') is true`
}

// A map pin is both coordinates or neither, inside the valid ranges.
export function geo(latColumn: AnyPgColumn, lngColumn: AnyPgColumn): SQL {
  return sql`((${latColumn} is null) = (${lngColumn} is null)) and coalesce(${latColumn} between -90 and 90 and ${lngColumn} between -180 and 180, true)`
}
