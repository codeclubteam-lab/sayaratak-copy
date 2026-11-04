import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { PriceText } from "@/components/app/price-text"
import { RowActions } from "@/components/app/row-actions"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import type { Workshop } from "@sayaratak/shared/schemas/profile"

type Service = Workshop["services"][number]

// One service: name, description and "From" price, move buttons for the order on the public page, and a menu with Edit and Delete (Delete asks first).
export function ServiceRow({
  service,
  first,
  last,
  onMove,
  onEdit,
  onDelete,
}: {
  service: Service
  first: boolean
  last: boolean
  onMove: (step: -1 | 1) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useT()
  const name = service.name
  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-body font-medium">
          <bdi>{name}</bdi>
        </h3>
        {service.description && (
          <p className="text-ui text-muted-foreground">{service.description}</p>
        )}
        {service.priceFrom !== undefined && (
          <p className="flex items-baseline gap-1 text-ui text-muted-foreground">
            {t("directory.price_from")}
            <PriceText price={service.priceFrom} size="table" />
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          data-move={`${service.id}:-1`}
          disabled={first}
          aria-label={t("dashboard.services_move_up", { name })}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          data-move={`${service.id}:1`}
          disabled={last}
          aria-label={t("dashboard.services_move_down", { name })}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon aria-hidden="true" />
        </Button>
        <RowActions
          label={name}
          actions={[
            { key: "edit", label: t("common.edit"), onSelect: onEdit },
            {
              key: "delete",
              label: t("common.delete"),
              onSelect: onDelete,
              destructive: {
                title: t("dashboard.services_delete_title"),
                description: t("dashboard.services_delete_body", { name }),
              },
            },
          ]}
        />
      </div>
    </li>
  )
}
