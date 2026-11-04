import { customType } from "drizzle-orm/pg-core"

/**
 * A jsonb column for the Bun SQL driver. Drizzle's own `jsonb` stringifies the
 * value and Bun SQL then stores that string as a JSON string, so an object
 * landed as `"{\"ar\":...}"`. Bun SQL encodes objects and arrays as JSON
 * itself, so this type passes values through untouched. Use it as
 * `jsonb().$type<T>()`, never `jsonb` from drizzle-orm/pg-core (lint bans it).
 */
export const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => "jsonb",
})
