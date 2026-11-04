import { ImagesIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { Mechanic } from "@sayaratak/shared/schemas/profile"
import { EmptyState } from "@/components/app/empty-state"
import { PhotoGrid } from "@/components/app/photo-grid"

// The portfolio: thumbnails with their captions, each opening the viewer.
export function MechanicWork({
  portfolio,
  name,
}: {
  portfolio: Mechanic["portfolio"]
  name: string
}) {
  const { t } = useT()
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 md:p-5">
      <h2 className="text-title font-semibold">{t("directory.work_title")}</h2>
      {portfolio.length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title={t("directory.work_empty")}
          level={3}
          className="py-6"
        />
      ) : (
        <PhotoGrid
          alt={name}
          items={portfolio.map((p) => ({
            ...p,
            type: "image",
            posterUrl: null,
          }))}
        />
      )}
    </section>
  )
}
