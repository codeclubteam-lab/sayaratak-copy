import { notificationPrefsSchema } from "@sayaratak/shared/schemas/api"

/** Every notification switch on: new accounts start here, as in the mock's `defaultPrefs`. */
export const ALL_PREFS = notificationPrefsSchema.parse(
  Object.fromEntries(
    notificationPrefsSchema.keyof().options.map((key) => [key, true])
  )
)
