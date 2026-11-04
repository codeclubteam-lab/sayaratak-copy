import type { ReactNode } from "react"
import { PhoneIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { formatPhone } from "@sayaratak/shared/lib/phone"
import type { Geo, WeeklyHours } from "@sayaratak/shared/schemas/fields"
import { HoursTable } from "@/components/app/hours-table"
import { LocationBlock } from "@/components/app/location-block"

// Description, photos, where and when, and the numbers. Every block shows only when the business filled it in. The dealership and workshop profiles share it.
export function BusinessAbout({
  description: text,
  photos,
  cityId,
  address,
  location,
  hours,
  phones,
}: {
  description: string
  photos?: ReactNode
  cityId: string
  address: string
  location: Geo | null
  hours: WeeklyHours
  phones: string[]
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-8 rounded-xl bg-card p-4 md:p-5">
      {text && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-semibold">
            {t("directory.about_title")}
          </h2>
          <p className="max-w-prose text-body whitespace-pre-line">{text}</p>
        </section>
      )}
      {photos && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-semibold">
            {t("directory.photos_title")}
          </h2>
          {photos}
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">
          {t("directory.address_title")}
        </h2>
        <LocationBlock cityId={cityId} address={address} location={location} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">
          {t("directory.hours_title")}
        </h2>
        <HoursTable hours={hours} />
      </section>
      {phones.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-semibold">
            {t("directory.phones_title")}
          </h2>
          <ul className="flex flex-col gap-1">
            {phones.map((phone) => (
              <li key={phone}>
                <a
                  href={`tel:${phone}`}
                  className="inline-flex min-h-11 items-center gap-2 text-body text-primary hover:underline md:min-h-0"
                >
                  <PhoneIcon aria-hidden strokeWidth={1.5} className="size-4" />
                  <bdi dir="ltr" className="num">
                    {formatPhone(phone)}
                  </bdi>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
