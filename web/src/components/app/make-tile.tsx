import { searchPath } from "@/features/search/href"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import { MakeLogo } from "./make-logo"

// A make's logo on a grey tile with its name and count, linking to that make's results. `count` is already formatted.
export function MakeTile({
  make,
  count,
}: {
  make: Taxonomy["makes"][number]
  count?: string
}) {
  const { locale } = useT()
  return (
    <a
      href={localeHref(searchPath({ kind: "vehicle", make: make.id }), locale)}
      className="group flex press flex-col gap-3 rounded-xl"
    >
      <span className="relative block aspect-4/3 rounded-lg bg-muted motion-color group-hover:bg-border">
        <span className="absolute inset-3 md:inset-4">
          <MakeLogo id={make.id} name={make.name.en} size="lg" />
        </span>
      </span>
      <span className="flex flex-col px-0.5">
        <span className="text-caption font-semibold break-words md:text-ui">
          <bdi>{make.name[locale]}</bdi>
        </span>
        <span className="min-h-4 text-caption text-muted-foreground num">
          {count}
        </span>
      </span>
    </a>
  )
}
