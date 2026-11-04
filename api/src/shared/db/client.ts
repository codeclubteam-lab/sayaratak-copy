import { SQL } from "bun"
import { drizzle } from "drizzle-orm/bun-sql"
import { env } from "~/env"
import * as schema from "~/shared/db/schema"

/**
 * A pool on the configured database. The restore command opens a second one after `pg_restore`:
 * the old pool's prepared statements name types that the restore dropped and made again.
 */
export function connect(max: number) {
  return drizzle({
    client: new SQL({ url: env.DATABASE_URL, max }),
    schema,
    // A17.4: camelCase in TypeScript, snake_case in SQL.
    casing: "snake_case",
  })
}

export const db = connect(env.DB_POOL_MAX)
