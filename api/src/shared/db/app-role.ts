import { SQL } from "bun"

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Two keys to the database (A3). `ownerUrl` can change the schema and only deploy steps hold it.
 * The user inside `appUrl` is what the running API connects as: read and write rows, no DDL, no
 * update or delete on the audit log, queries cut off at 10 s. Creates that user if it is missing,
 * sets the password found in `appUrl`, and grants on every table that exists now, so it runs after
 * each migration and each restore (`pg_restore --no-privileges` drops grants). One transaction,
 * so the audit log is never open to updates in between.
 */
export async function ensureAppRole(ownerUrl: string, appUrl: string) {
  const owner = new URL(ownerUrl)
  const app = new URL(appUrl)
  const role = decodeURIComponent(app.username)
  const password = decodeURIComponent(app.password)
  const database = app.pathname.slice(1)
  if (!NAME.test(role) || !NAME.test(database) || !password)
    throw new Error(
      "DATABASE_URL needs a plain user name, a password and a database name"
    )
  if (role === decodeURIComponent(owner.username))
    throw new Error("DATABASE_URL must use another user than the owner's")

  const client = new SQL({ url: ownerUrl, max: 1 })
  try {
    const [found] = await client`select 1 from pg_roles where rolname = ${role}`
    const literal = `'${password.replaceAll("'", "''")}'`
    await client.unsafe(`
      begin;
      ${found ? "alter" : "create"} role "${role}" with login nosuperuser nocreatedb nocreaterole password ${literal};
      alter role "${role}" set statement_timeout = '10s';
      grant connect on database "${database}" to "${role}";
      grant usage on schema public, drizzle to "${role}";
      grant select, insert, update, delete on all tables in schema public to "${role}";
      grant usage, select on all sequences in schema public to "${role}";
      grant select on drizzle.__drizzle_migrations to "${role}";
      revoke update, delete on audit_log from "${role}";
      commit;
    `)
  } finally {
    await client.close()
  }
}
