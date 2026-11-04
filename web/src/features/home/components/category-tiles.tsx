import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { typeSlug } from "@/features/search/landing"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { VehicleType } from "@sayaratak/shared/schemas/listing"
import { homeQueries } from "../queries"

// Photos live in public/images/categories as <name>-320.webp and <name>-640.webp.
const typePhoto: Record<VehicleType, string> = {
  car: "cars",
  truck: "trucks",
  motorcycle: "motorcycles",
  tuk_tuk: "tuk-tuks",
  rickshaw: "rickshaws",
}

// Eight tiles, four to a row on a phone and one row of eight from `lg`: the enabled vehicle types, Parts, Workshops and Mechanics, each a photo with a live count. The vehicle counts are the facets of the "Newly added" rail, so they cost no request of their own.
export function CategoryTiles() {
  const { t, locale } = useT()
  const taxonomy = useQuery(taxonomyQuery).data
  const facets = useQuery({
    ...homeQueries.newest,
    select: (page) => page.facets.type,
  }).data
  const parts = useQuery({ ...homeQueries.parts, select: (p) => p.total }).data
  const workshops = useQuery({
    ...homeQueries.workshops,
    select: (p) => p.total,
  }).data
  const mechanics = useQuery({
    ...homeQueries.mechanics,
    select: (p) => p.total,
  }).data
  const tiles: {
    key: string
    label: string
    path: string
    photo: string
    count: number | undefined
  }[] = [
    ...(taxonomy?.vehicleTypes ?? [])
      .filter((v) => v.enabled)
      .map((v) => ({
        key: v.id,
        label: v.name[locale],
        path: `/vehicles/${typeSlug(v.id)}/sale`,
        photo: typePhoto[v.id],
        count: facets && (facets.find((f) => f.value === v.id)?.count ?? 0),
      })),
    {
      key: "parts",
      label: t("nav.parts"),
      path: "/parts",
      photo: "parts",
      count: parts,
    },
    {
      key: "workshops",
      label: t("nav.workshops"),
      path: "/workshops",
      photo: "workshops",
      count: workshops,
    },
    {
      key: "mechanics",
      label: t("nav.mechanics"),
      path: "/mechanics",
      photo: "mechanics",
      count: mechanics,
    },
  ]
  return (
    <section aria-labelledby="home-categories">
      <h2 id="home-categories" className="sr-only">
        {t("home.categories")}
      </h2>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4 md:gap-x-4 lg:grid-cols-8">
        {tiles.map(({ key, label, path, photo, count }) => (
          <li key={key}>
            <a
              href={localeHref(path, locale)}
              className="group flex press flex-col gap-2 rounded-xl"
            >
              <span className="block aspect-4/3 overflow-hidden rounded-lg bg-muted motion-color group-hover:bg-border">
                <img
                  src={`/images/categories/${photo}-320.webp`}
                  srcSet={`/images/categories/${photo}-320.webp 320w, /images/categories/${photo}-640.webp 640w`}
                  sizes="(min-width: 1024px) 140px, 25vw"
                  width={320}
                  height={240}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover mix-blend-multiply"
                />
              </span>
              <span className="flex flex-col px-0.5">
                <span className="text-caption font-semibold break-words hyphens-auto md:text-ui">
                  {label}
                </span>
                <span className="hidden min-h-4 text-caption text-muted-foreground num md:block">
                  {count === undefined ? "" : formatNumber(count, locale)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
