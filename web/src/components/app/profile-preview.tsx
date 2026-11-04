import { useCityName } from "@/hooks/use-city-name"
import { initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"
import { Badge } from "@/components/ui/badge"
import { MediaImage } from "./media-image"
import { OpenNowBadge } from "./open-now-badge"
import { RatingSummary } from "./rating-summary"

// What the public profile header will look like, from plain props so a form can feed it live. Empty fields show a placeholder.
export function ProfilePreview({
  variant,
  name,
  imageUrl,
  coverUrl,
  cityId,
  hours,
}: {
  variant: "dealership" | "workshop" | "mechanic"
  name: string
  imageUrl?: string
  coverUrl?: string
  cityId?: string
  hours?: WeeklyHours
}) {
  const { t } = useT()
  const city = useCityName(cityId ?? "")
  const round = variant === "mechanic"
  return (
    <div className="overflow-hidden rounded-xl bg-card">
      {!round && (
        <MediaImage
          src={coverUrl || null}
          alt=""
          sizes="480px"
          className="aspect-[3/1] rounded-none"
        />
      )}
      <div className="flex gap-3 p-4">
        {imageUrl ? (
          <MediaImage
            src={imageUrl}
            alt=""
            sizes="64px"
            fit={round ? "cover" : "contain"}
            className={
              round ? "size-16 shrink-0 rounded-full" : "size-16 shrink-0"
            }
          />
        ) : (
          // No photo yet: the name's initials, like a person's avatar.
          <span
            aria-hidden="true"
            className={`grid size-16 shrink-0 place-items-center bg-accent text-lead font-semibold text-accent-foreground ${round ? "rounded-full" : "rounded-lg"}`}
          >
            <bdi>{initials(name)}</bdi>
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-ui font-medium">
            {name ? <bdi>{name}</bdi> : t("form.preview_name")}
          </h3>
          <RatingSummary avg={0} count={0} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            {city && <span>{city}</span>}
            <Badge>{t(`common.${variant}`)}</Badge>
            {hours && <OpenNowBadge hours={hours} />}
          </div>
        </div>
      </div>
    </div>
  )
}
