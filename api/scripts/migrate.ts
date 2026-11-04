import { SQL } from "bun"
import { drizzle } from "drizzle-orm/bun-sql"
import { migrate } from "drizzle-orm/bun-sql/migrator"

// One connection, so the session advisory lock covers every statement and two
// deploys (or two test runs) never migrate at the same time.
export async function runMigrations(url: string) {
  const client = new SQL({ url, max: 1 })
  try {
    await client`select pg_advisory_lock(hashtext('sayaratak:migrate'))`
    await migrate(drizzle({ client }), {
      migrationsFolder: `${import.meta.dir}/../drizzle`,
    })
  } finally {
    await client.close()
  }
}

if (import.meta.main) {
  const { env } = await import("~/env")
  const { ensureAppRole } = await import("~/shared/db/app-role")
  await runMigrations(env.MIGRATE_DATABASE_URL ?? env.DATABASE_URL)
  if (env.MIGRATE_DATABASE_URL)
    await ensureAppRole(env.MIGRATE_DATABASE_URL, env.DATABASE_URL)
}
