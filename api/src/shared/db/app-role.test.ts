import { afterAll, beforeAll, expect, test } from "bun:test"
import { SQL } from "bun"

import { ensureAppRole } from "~/shared/db/app-role"

const ownerUrl = process.env.TEST_DATABASE_URL ?? ""
const role = "sayaratak_app_test"
const appUrl = (() => {
  const url = new URL(ownerUrl)
  url.username = role
  url.password = "it's-a-test-password"
  return url.toString()
})()

const owner = new SQL({ url: ownerUrl, max: 1 })
let app: SQL

async function dropRole() {
  if ((await owner`select 1 from pg_roles where rolname = ${role}`).length > 0)
    await owner.unsafe(`drop owned by ${role}; drop role ${role}`)
}

beforeAll(async () => {
  await dropRole()
  await ensureAppRole(ownerUrl, appUrl)
  app = new SQL({ url: appUrl, max: 1 })
})

afterAll(async () => {
  await app.close()
  await owner`delete from audit_log where id = 'app-role-test'`
  await dropRole()
  await owner.close()
})

const refused = (sql: string) =>
  expect(Promise.resolve(app.unsafe(sql))).rejects.toThrow(
    /permission denied|must be owner/
  )

test("the app user reads and writes rows", async () => {
  await app`insert into audit_log (id, action, target_type, target_id, created_at) values ('app-role-test', 'a', 'b', 'c', now())`
  expect(
    (await app`select id from audit_log where id = 'app-role-test'`).length
  ).toBe(1)
  await app`select max(created_at) from drizzle.__drizzle_migrations`
  expect((await app`show statement_timeout`)[0]?.statement_timeout).toBe("10s")
})

test("the audit log is append only for the app user", async () => {
  await refused(`update audit_log set reason = 'x'`)
  await refused(`delete from audit_log`)
  await refused(`truncate audit_log`)
})

test("the app user cannot change the schema", async () => {
  await refused(`drop table audit_log`)
  await refused(`create table app_role_test_new (id int)`)
  await refused(`alter table audit_log add column x int`)
})

test("a table made after the first run is granted on the next run", async () => {
  await owner`create table app_role_test_later (id int)`
  try {
    await refused(`insert into app_role_test_later values (1)`)
    await ensureAppRole(ownerUrl, appUrl)
    await app`insert into app_role_test_later values (1)`
    await refused(`update audit_log set reason = 'x'`)
  } finally {
    await owner`drop table app_role_test_later`
  }
})

test("refuses the owner's own user and a missing password", async () => {
  await expect(ensureAppRole(ownerUrl, ownerUrl)).rejects.toThrow()
  const noPassword = new URL(appUrl)
  noPassword.password = ""
  await expect(ensureAppRole(ownerUrl, noPassword.toString())).rejects.toThrow()
})
