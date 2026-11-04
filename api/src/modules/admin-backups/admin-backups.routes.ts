import { backupSchema } from "@sayaratak/shared/schemas/admin"
import { Hono } from "hono"
import { z } from "zod"

import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  getBackups,
  restoreRefusal,
  startBackup,
} from "./admin-backups.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminBackupsRoutes = new Hono()

adminBackupsRoutes.get(
  "/admin/backups",
  spec({
    summary: "Every backup, newest first",
    access: "user",
    responses: { 200: z.array(backupSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getBackups())
)

adminBackupsRoutes.post(
  "/admin/backups",
  spec({
    summary:
      "Takes a backup now: `pg_dump` into the private bucket. The answer comes when the file is stored, so it is `ready` (the mock answers `running` and flips it after 2 seconds); a failed dump answers 500 and leaves a `failed` row",
    access: "user",
    responses: { 200: backupSchema },
    errors: [...ADMIN_ERRORS, "server_error"],
  }),
  requireAdmin,
  async (c) => c.json(await startBackup(c.get("actor")))
)

adminBackupsRoutes.post(
  "/admin/backups/:id/restore",
  spec({
    summary:
      "Always 403 `forbidden` with a message: a restore replaces the whole database, so it runs from the command line (`bun scripts/db-restore.ts <id>`), never from the API",
    access: "user",
    responses: {},
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  (c) => c.json(restoreRefusal(), 403)
)
