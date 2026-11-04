import { useId } from "react"
import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { adminQueries } from "@/features/admin/queries"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { IndividualSettingsForm } from "./individual-settings-form"

// Whether individuals subscribe at all, and how many listings one may hold without a plan.
export function IndividualSettingsCard() {
  const { t } = useT()
  const id = useId()
  const settings = useQuery(adminQueries.settings)
  const title = t("admin.plans_individual_title")
  if (settings.isError && !settings.data)
    return (
      <SectionError
        title={title}
        message={t("admin.plans_settings_error")}
        onRetry={() => void settings.refetch()}
      />
    )
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-title font-semibold">
          {title}
        </h2>
        <p className="text-ui text-muted-foreground">
          {t("admin.plans_individual_body")}
        </p>
      </div>
      {settings.data ? (
        <IndividualSettingsForm
          // A save brings new values; the form starts again from them.
          key={JSON.stringify([
            settings.data.individualSubscriptionsEnabled,
            settings.data.freeListingLimit,
          ])}
          settings={settings.data}
        />
      ) : (
        // The two setting rows and the footer, shaped like the form.
        <div aria-hidden="true" className="flex flex-col">
          {["h-6 w-11 rounded-full", "h-10 w-24 rounded-lg"].map((control) => (
            <div
              key={control}
              className="flex items-center gap-4 border-t py-3"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className={control} />
            </div>
          ))}
          <div className="flex justify-end border-t pt-4">
            <Skeleton className="h-9 w-16 rounded-lg" />
          </div>
        </div>
      )}
    </section>
  )
}
