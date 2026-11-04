import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"

/** Every audit row of one target, oldest first. */
export const auditOf = (id: string) =>
  db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, id))
    .orderBy(auditLog.createdAt)

export const dongola = {
  countryId: "sd",
  name: { ar: "دنقلا", en: "Dongola" },
  center: { lat: 19.17, lng: 30.48 },
}

export const eritrea = {
  code: "ER",
  name: { ar: "إريتريا", en: "Eritrea" },
  dialCode: "+291",
  enabled: false,
}
