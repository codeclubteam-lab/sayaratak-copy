import { useId } from "react"
import { useLocation, useRouter } from "@tanstack/react-router"

import { FormField } from "@/components/app/form-field"
import { SelectInput } from "@/components/app/select-input"
import { Switch } from "@/components/ui/switch"
import { useUpdateProfile } from "@/features/auth/queries"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { usePrefs, useSetPrefs } from "@/lib/prefs"
import { localeSchema } from "@sayaratak/shared/schemas/locale"

// Both apply at once. The language lives in the URL, so a change remembers the choice on the account and reloads this page in the other language, like the header switch.
export function PreferencesForm() {
  const { t, locale } = useT()
  const id = useId()
  const router = useRouter()
  const href = useLocation({ select: () => router.history.location.href })
  const update = useUpdateProfile()
  const { dataSaver } = usePrefs()
  const setPrefs = useSetPrefs()
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <FormField label={t("settings.language_label")}>
        {(c) => (
          <SelectInput
            {...c}
            value={locale}
            options={localeSchema.options.map((value) => ({
              value,
              label: t(`nav.language_${value}`),
            }))}
            onChange={(next) => {
              const target = localeSchema.parse(next)
              if (target === locale) return
              update.mutate(
                { locale: target },
                {
                  onSettled: () =>
                    window.location.assign(localeHref(href, target)),
                }
              )
            }}
            disabled={update.isPending}
          />
        )}
      </FormField>
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span id={`${id}-saver`} className="text-ui font-medium">
            {t("nav.data_saver")}
          </span>
          <span
            id={`${id}-saver-hint`}
            className="text-caption text-muted-foreground"
          >
            {t("settings.data_saver_hint")}
          </span>
        </div>
        <Switch
          aria-labelledby={`${id}-saver`}
          aria-describedby={`${id}-saver-hint`}
          checked={dataSaver}
          onCheckedChange={(on) => setPrefs({ dataSaver: on })}
        />
      </div>
    </div>
  )
}
