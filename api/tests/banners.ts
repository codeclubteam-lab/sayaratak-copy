import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { fileOf, postUpload } from "./files"
import { expectSchema, req, type SignedIn } from "./helpers"

/** A banner body as the admin form sends it; the pictures are addresses of uploads the admin made. */
export const bannerBody = (urls: { ar: string; en: string }) => ({
  title: "Ramadan offers",
  imageUrl: urls,
  sponsored: false,
  focus: 40,
  href: "/search",
  placement: "home_top",
  startsAt: "2026-11-01T00:00:00.000Z",
  endsAt: "2026-12-01T23:59:59.000Z",
  active: true,
  sortOrder: 9,
})

/** Uploads a picture as the admin and answers its address, as the banner form does. */
export async function uploadPicture(admin: SignedIn) {
  const media = await expectSchema(
    await postUpload(admin, { file: fileOf("jpeg") }),
    mediaSchema
  )
  return media.url
}

/** A caller that sends JSON as the signed-in admin. */
export function callAs(admin: SignedIn) {
  return async (method: string, path: string, body?: unknown) =>
    req(path, {
      method,
      headers: {
        cookie: admin.cookie,
        origin: admin.origin,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
}

export const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))

export const uploadRows = () => db.select().from(uploads)
