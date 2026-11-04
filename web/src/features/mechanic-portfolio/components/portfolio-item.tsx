import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { MediaImage } from "@/components/app/media-image"
import { RowActions } from "@/components/app/row-actions"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import type { Mechanic } from "@sayaratak/shared/schemas/profile"

type Item = Mechanic["portfolio"][number]

// One finished job: photo, caption, move earlier and later (the public order), and a menu with Edit caption and Delete (Delete asks first).
export function PortfolioItem({
  item,
  first,
  last,
  onMove,
  onEdit,
  onDelete,
}: {
  item: Item
  first: boolean
  last: boolean
  onMove: (step: -1 | 1) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useT()
  const name = item.caption
  return (
    <li className="flex flex-col gap-2">
      <MediaImage
        src={item.url}
        placeholderColor={item.placeholderColor}
        alt={name}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
      />
      <p className="text-ui">
        <bdi>{name}</bdi>
      </p>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          data-move={`${item.id}:-1`}
          disabled={first}
          aria-label={t("dashboard.portfolio_move_earlier", { name })}
          onClick={() => onMove(-1)}
        >
          <ChevronLeftIcon aria-hidden="true" className="rtl:-scale-x-100" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          data-move={`${item.id}:1`}
          disabled={last}
          aria-label={t("dashboard.portfolio_move_later", { name })}
          onClick={() => onMove(1)}
        >
          <ChevronRightIcon aria-hidden="true" className="rtl:-scale-x-100" />
        </Button>
        <span className="ms-auto">
          <RowActions
            label={name}
            actions={[
              {
                key: "edit",
                label: t("dashboard.portfolio_edit_caption"),
                onSelect: onEdit,
              },
              {
                key: "delete",
                label: t("common.delete"),
                onSelect: onDelete,
                destructive: {
                  title: t("dashboard.portfolio_delete_title"),
                  description: t("dashboard.portfolio_delete_body"),
                },
              },
            ]}
          />
        </span>
      </div>
    </li>
  )
}
