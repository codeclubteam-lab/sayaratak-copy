import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { LocationPicker } from "@/components/app/location-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { MethodFields, PhoneFields } from "./contact-fields"
import { dealerContact, useContactPrefill } from "./use-contact-prefill"
import { useStepFields } from "./use-step-fields"

// Step `contact`: where the vehicle is, and how buyers reach the owner. A dealer starts with the dealership's details collapsed to one line.
export function ContactStep() {
  const { t, locale } = useT()
  const dealer = useContactPrefill()
  const { values, error, set } = useStepFields()
  const { data: taxonomy } = useQuery(taxonomyQuery)
  const [chosen, setChosen] = useState<boolean | null>(null)
  const own = dealer && dealerContact(dealer)
  const collapsed =
    chosen ??
    (!!own &&
      values.phone === own.phone &&
      values.cityId === own.cityId &&
      values.districtId === own.districtId)
  const useDealer = (on: boolean) => {
    setChosen(on)
    if (on && own)
      for (const [name, value] of Object.entries(own)) set(name, value)
  }
  const place = [
    taxonomy?.districts.find((d) => d.id === values.districtId)?.name[locale],
    taxonomy?.cities.find((c) => c.id === values.cityId)?.name[locale],
  ].filter(Boolean)
  return (
    <>
      {own && (
        <div className="flex flex-col gap-2">
          <Label className="min-h-(--row-h) font-normal">
            <Checkbox checked={collapsed} onCheckedChange={useDealer} />
            {t("post.use_dealer_contact")}
          </Label>
          {collapsed && (
            <p className="text-ui text-muted-foreground">
              {place.join(", ")} · <bdi>{values.phone}</bdi>
            </p>
          )}
        </div>
      )}
      {!collapsed && (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-ui font-medium">{t("post.where_title")}</h2>
            <LocationPicker
              districtRequired
              value={{
                cityId: values.cityId ?? "",
                districtId: values.districtId || null,
                location: values.location ?? null,
              }}
              cityError={error("cityId")}
              districtError={error("districtId")}
              onChange={(next) => {
                set("cityId", next.cityId)
                set("districtId", next.districtId ?? "")
                set("location", next.location)
              }}
            />
            <p className="text-caption text-muted-foreground">
              {t("post.location_hint")}
            </p>
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="text-ui font-medium">{t("post.reach_title")}</h2>
            <PhoneFields />
          </section>
        </>
      )}
      <MethodFields />
    </>
  )
}
