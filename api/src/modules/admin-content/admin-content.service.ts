import type {
  pagePatchSchema,
  settingsPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import type { Actor } from "~/modules/audit/audit.types"
import * as content from "~/modules/content/content.admin.service"
import { getPage } from "~/modules/content/content.service"
import { syncFreeLimit } from "~/modules/plans/plans.admin.service"

/** `GET /admin/pages/:slug`: one of the four fixed pages; any other slug is 404. */
export function getAdminPage(slug: string) {
  return getPage(slug)
}

/** `PATCH /admin/pages/:slug`: the page as it is after. */
export function changePage(
  actor: Actor,
  change: { slug: string; edit: z.output<typeof pagePatchSchema> }
) {
  return transaction((tx) => content.updatePage(tx, actor, change))
}

/** `GET /admin/settings`. */
export function getSettings() {
  return content.getAdminSettings(db)
}

/** `PATCH /admin/settings`: the settings as they are after. The free plan then shows the free listing limit. */
export function changeSettings(
  actor: Actor,
  edit: z.output<typeof settingsPatchSchema>
) {
  return transaction(async (tx) => {
    const settings = await content.updateSettings(tx, actor, edit)
    await syncFreeLimit(tx)
    return settings
  })
}
