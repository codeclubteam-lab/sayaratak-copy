import { useCallback, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon } from "lucide-react"

import { LeaveGuard } from "@/components/app/leave-guard"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { ShellLink } from "@/components/app/shell-link"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { businessQueries } from "@/features/directory/queries"
import { HoursStep } from "@/features/onboarding/components/hours-step"
import { PlaceFields } from "@/features/onboarding/components/place-fields"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import * as s from "../schemas"
import { BrandingFields } from "./branding-fields"
import { ContactFields } from "./contact-fields"
import { DetailsFields } from "./details-fields"
import { MechanicSections } from "./mechanic-sections"
import { PublicAddress } from "./public-address"
import { SectionForm } from "./section-form"
import { WorkshopContactFields } from "./workshop-contact-fields"

// A dealership's, workshop's or mechanic's public profile, one section per form. Leaving with any section unsaved asks first.
export function BusinessProfilePage({
  variant,
}: {
  variant: "dealership" | "workshop" | "mechanic"
}) {
  const { t } = useT()
  const title = t("dashboard.nav_profile")
  usePageTitle(title)
  const mine = useQuery(businessQueries.mine)
  const schemas = {
    dealership: dealershipSchema,
    workshop: workshopSchema,
    mechanic: mechanicSchema,
  }
  const d = schemas[variant].safeParse(mine.data).data
  const path = d && `/${variant}s/${d.slug}`
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const onDirty = useCallback(
    (id: string, value: boolean) =>
      setDirty((prev) =>
        prev[id] === value ? prev : { ...prev, [id]: value }
      ),
    []
  )
  const section = (id: string) => ({
    id,
    title: t(`dashboard.profile_${id}`),
    description: t(`dashboard.profile_${id}_body`),
    onDirty,
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title}>
        {path && (
          <ShellLink
            path={path}
            newTab
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t("dashboard.profile_view")}
          </ShellLink>
        )}
      </PageHeader>
      {mine.isError && !d ? (
        <SectionError
          message={t("dashboard.profile_load_error")}
          onRetry={() => void mine.refetch()}
        />
      ) : !d ? (
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <PublicAddress path={`/${variant}s/${d.slug}`} />
          {"portfolio" in d ? (
            <MechanicSections mechanic={d} section={section} />
          ) : (
            <div>
              <SectionForm
                {...section("branding")}
                schema={s.brandingSchema}
                values={s.brandingValues(d)}
              >
                <BrandingFields business={d} />
              </SectionForm>
              <SectionForm
                {...section("details")}
                schema={s.detailsSchema}
                values={s.detailsValues(d)}
              >
                <DetailsFields />
              </SectionForm>
              {"phones" in d ? (
                <SectionForm
                  {...section("contact")}
                  schema={s.contactSchema}
                  values={s.contactValues(d)}
                  toBody={s.contactBody}
                >
                  <ContactFields />
                </SectionForm>
              ) : (
                <SectionForm
                  {...section("contact")}
                  schema={s.workshopContactSchema}
                  values={s.workshopContactValues(d)}
                  toBody={s.workshopContactBody}
                >
                  <WorkshopContactFields />
                </SectionForm>
              )}
              <SectionForm
                {...section("location")}
                schema={s.locationSchema}
                values={s.locationValues(d)}
              >
                <PlaceFields />
              </SectionForm>
              <SectionForm
                {...section("hours")}
                schema={s.hoursSchema}
                values={s.hoursValues(d)}
              >
                <HoursStep />
              </SectionForm>
            </div>
          )}
        </>
      )}
      <LeaveGuard when={Object.values(dirty).some(Boolean)} />
    </div>
  )
}
