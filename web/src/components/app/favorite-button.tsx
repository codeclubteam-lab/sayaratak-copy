import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HeartIcon } from "lucide-react"

import { useRequireAuth } from "@/features/auth/auth-gate"
import { useFavoriteActions } from "@/features/listings/favorite-actions"
import { favoriteQueries } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"

// `overlay` is the white circle that sits on a card photo, `plain` is the bare icon for the detail page.
export function FavoriteButton({
  listingId,
  variant = "overlay",
  className,
}: {
  listingId: string
  variant?: "overlay" | "plain"
  className?: string
}) {
  const { t } = useT()
  const requireAuth = useRequireAuth()
  const { data: ids } = useQuery(favoriteQueries.ids)
  const { save, remove } = useFavoriteActions()
  const active = ids?.includes(listingId) ?? false
  // The pop plays once, right after the person saves, never on mount or when coming Back.
  const [justSaved, setJustSaved] = useState(false)
  const toggle = () =>
    requireAuth(() => {
      if (active) remove(listingId)
      else save(listingId)
      setJustSaved(!active)
    }, "auth.reason_favorite")
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={t("listing.favorite_add")}
      onClick={toggle}
      className={cn(
        "grid size-11 press place-items-center rounded-full md:size-10",
        className
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full",
          variant === "overlay" ? "bg-card" : "hover:bg-muted"
        )}
      >
        <HeartIcon
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn(
            "size-5 transition-colors",
            active ? "fill-primary text-primary" : "text-foreground",
            justSaved && "motion-safe:animate-heart-pop"
          )}
          onAnimationEnd={() => setJustSaved(false)}
        />
      </span>
    </button>
  )
}
