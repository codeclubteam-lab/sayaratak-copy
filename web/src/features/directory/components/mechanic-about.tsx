import { useCityNames } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import { Badge } from "@/components/ui/badge"

// The bio and the cities the mechanic travels to. A mechanic has no address or opening hours.
export function MechanicAbout({
  bio,
  servedCityIds,
}: {
  bio: string
  servedCityIds: string[]
}) {
  const { t } = useT()
  const cities = useCityNames(servedCityIds)
  return (
    <div className="flex flex-col gap-8 rounded-xl bg-card p-4 md:p-5">
      {bio && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-semibold">
            {t("directory.about_title")}
          </h2>
          <p className="max-w-prose text-body whitespace-pre-line">{bio}</p>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">
          {t("directory.cities_served_title")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {cities.map((city) => (
            <li key={city}>
              <Badge variant="muted">{city}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
