import { customAlphabet, nanoid } from "nanoid"

import { buildSeed } from "./seed"
import type { Db, Snapshot } from "./types"

declare global {
  var __sayaratakDb: Db | undefined
}

const empty = () => process.env.MOCK_EMPTY === "true"

// Kept on globalThis so Vite hot reload does not wipe it. Reset mutates in place, so imports of `db` stay valid.
export const db: Db = (globalThis.__sayaratakDb ??= buildSeed({
  empty: empty(),
}))
export const resetDb = () => Object.assign(db, buildSeed({ empty: empty() }))
// ponytail: a full copy per backup, fine for the demo data; store diffs if backups ever pile up.
export const takeSnapshot = (): Snapshot => {
  const { backups: _, ...rest } = db
  return structuredClone(rest)
}
// Puts a snapshot back (or the seed data when there is none) and keeps the backup list. Sessions are cookies holding a
// user id, so whoever is signed in stays signed in as long as their account exists in the restored data.
export const restoreDb = (snapshot?: Snapshot) => {
  const { backups: _, ...seed } = buildSeed({ empty: empty() })
  Object.assign(db, snapshot ? structuredClone(snapshot) : seed)
}

type Row = { id: string }
// Six characters, like the seeded ids, so slugs keep the same shape.
export const newListingId = () =>
  `l${customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 5)()}`
export const newId = (prefix: string) => `${prefix}-${nanoid(8)}`
export const find = <T extends Row>(table: T[], id: string) =>
  table.find((r) => r.id === id)
export const insert = <T extends Row>(table: T[], row: T) => {
  table.push(row)
  return row
}
export const update = <T extends Row>(
  table: T[],
  id: string,
  patch: Partial<T>
) => {
  const row = find(table, id)
  if (row) Object.assign(row, patch)
  return row
}
export const remove = <T extends Row>(table: T[], id: string) => {
  const i = table.findIndex((r) => r.id === id)
  if (i >= 0) table.splice(i, 1)
  return i >= 0
}
export const paginate = <T>(rows: T[], page = 1, pageSize = 24) => ({
  items: rows.slice((page - 1) * pageSize, page * pageSize),
  total: rows.length,
  page,
  pageSize,
})
