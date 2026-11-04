import { useState } from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "./confirm-dialog"

const item = "min-h-11 md:min-h-10"

export type RowAction = {
  key: string
  label: string
  onSelect: () => void
  disabled?: boolean
  // Destructive actions are listed last and always ask first.
  destructive?: { title: string; description?: string }
}

// One "..." menu per table row. `label` names the row for screen readers ("Actions for Toyota Corolla").
export function RowActions({
  label,
  actions,
}: {
  label: string
  actions: RowAction[]
}) {
  const { t } = useT()
  const [pending, setPending] = useState<RowAction>()
  const safe = actions.filter((a) => !a.destructive)
  const risky = actions.filter((a) => a.destructive)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("table.row_actions", { name: label })}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {safe.map((a) => (
            <DropdownMenuItem
              key={a.key}
              className={item}
              disabled={a.disabled}
              onClick={a.onSelect}
            >
              {a.label}
            </DropdownMenuItem>
          ))}
          {safe.length > 0 && risky.length > 0 && <DropdownMenuSeparator />}
          {risky.map((a) => (
            <DropdownMenuItem
              key={a.key}
              variant="destructive"
              className={item}
              disabled={a.disabled}
              onClick={() => setPending(a)}
            >
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {pending?.destructive && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(undefined)}
          title={pending.destructive.title}
          description={pending.destructive.description}
          confirmLabel={pending.label}
          destructive
          onConfirm={() => {
            pending.onSelect()
            setPending(undefined)
          }}
        />
      )}
    </>
  )
}
