import { useId } from "react"
import { StarIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"

const stars = [1, 2, 3, 4, 5]
const tone = (filled: boolean) =>
  filled ? "fill-foreground text-foreground" : "text-input"

// Display by default. With `onChange` it is a radio group: native radios give arrow keys and a group name for free.
export function RatingStars({
  value,
  onChange,
  label,
  className,
}: {
  value: number
  onChange?: (rating: number) => void
  label?: string
  className?: string
}) {
  const { t } = useT()
  const group = useId()
  if (!onChange)
    return (
      <span
        role="img"
        aria-label={t("directory.stars_of_five", { rating: value.toFixed(1) })}
        className={cn("inline-flex", className)}
      >
        {stars.map((n) => (
          <StarIcon
            key={n}
            aria-hidden="true"
            strokeWidth={1.5}
            className={cn("size-4", tone(n <= Math.round(value)))}
          />
        ))}
      </span>
    )
  return (
    <fieldset className={cn("inline-flex", className)}>
      <legend className="sr-only">{label}</legend>
      {stars.map((n) => (
        <label
          key={n}
          className="grid size-11 place-items-center rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring md:size-10"
        >
          <input
            type="radio"
            name={group}
            checked={value === n}
            onChange={() => onChange(n)}
            aria-label={t("directory.stars_of_five", { rating: n })}
            className="sr-only"
          />
          <StarIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className={cn("size-6", tone(n <= value))}
          />
        </label>
      ))}
    </fieldset>
  )
}
