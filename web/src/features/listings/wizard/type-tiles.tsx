import { useId } from "react"
import { CheckIcon } from "lucide-react"

import { FieldError } from "@/components/app/field-error"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { useT } from "@/lib/i18n/use-t"
import type { Tile } from "./type-change"

const photo: Record<Tile, string> = {
  car: "cars",
  truck: "trucks",
  motorcycle: "motorcycles",
  tuk_tuk: "tuk-tuks",
  rickshaw: "rickshaws",
  part: "parts",
}

// Native radios under the tile look: Tab enters the group on the chosen tile and the arrow keys move between tiles.
export function TypeTiles({
  tiles,
  value,
  onChange,
  error,
}: {
  tiles: Tile[]
  value: Tile | null
  onChange: (tile: Tile) => void
  error?: string
}) {
  const { t } = useT()
  const name = useId()
  return (
    <FieldSet>
      <FieldLegend className="sr-only">{t("post.type_title")}</FieldLegend>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((tile) => (
          <label
            key={tile}
            className="group relative flex press cursor-pointer flex-col gap-2 rounded-xl p-1 has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === tile}
              aria-invalid={Boolean(error)}
              onChange={() => onChange(tile)}
            />
            <span className="block aspect-4/3 overflow-hidden rounded-lg bg-muted outline-primary group-has-checked:outline-2">
              <img
                src={`/images/categories/${photo[tile]}-320.webp`}
                srcSet={`/images/categories/${photo[tile]}-320.webp 320w, /images/categories/${photo[tile]}-640.webp 640w`}
                sizes="(min-width: 768px) 200px, 45vw"
                width={320}
                height={240}
                alt=""
                decoding="async"
                className="size-full object-cover mix-blend-multiply"
              />
            </span>
            <span className="px-0.5 text-ui font-medium group-has-checked:text-primary">
              {t(`post.type_${tile}`)}
            </span>
            <CheckIcon
              aria-hidden="true"
              className="absolute end-3 top-3 hidden size-6 rounded-full bg-primary p-1 text-primary-foreground group-has-checked:block"
            />
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </FieldSet>
  )
}
