import { useId } from "react"
import { useQuery } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { prefsQuery, useUpdateNotificationPrefs } from "@/features/auth/queries"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { notificationPrefsSchema } from "@sayaratak/shared/schemas/api"

// Message keys are snake_case: savedSearchMatches reads `pref_saved_search_matches`.
const snake = (key: string) =>
  key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const prefKeys = Object.keys(notificationPrefsSchema.shape) as Array<
  keyof typeof notificationPrefsSchema.shape
>

// One row per kind of notification, each switch saves at once (optimistic, undone if the call fails).
export function NotificationPrefsForm() {
  const { t } = useT()
  const id = useId()
  const prefs = useQuery(prefsQuery)
  const update = useUpdateNotificationPrefs()
  if (prefs.isError && !prefs.data)
    return (
      <SectionError
        message={t("notifications.prefs_error")}
        onRetry={() => void prefs.refetch()}
      />
    )
  if (!prefs.data)
    return (
      <div aria-hidden="true" className="flex flex-col gap-4">
        {prefKeys.map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    )
  return (
    <ul className="flex flex-col divide-y">
      {prefKeys.map((key) => (
        <li key={key} className="flex items-center gap-4 py-3 first:pt-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <span id={`${id}-${key}`} className="text-ui font-medium">
              {t(`notifications.pref_${snake(key)}`)}
            </span>
            <span
              id={`${id}-${key}-hint`}
              className="text-caption text-muted-foreground"
            >
              {t(`notifications.pref_${snake(key)}_hint`)}
            </span>
          </div>
          <Switch
            aria-labelledby={`${id}-${key}`}
            aria-describedby={`${id}-${key}-hint`}
            checked={prefs.data[key]}
            onCheckedChange={(on) =>
              update.mutate(
                { [key]: on },
                { onError: (e) => toast.add({ title: errorText(t, e) }) }
              )
            }
          />
        </li>
      ))}
    </ul>
  )
}
