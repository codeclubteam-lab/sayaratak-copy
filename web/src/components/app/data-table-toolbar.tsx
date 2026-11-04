import { useEffect, useState, type ReactNode } from "react"
import { Columns3Icon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

export type ColumnToggle = {
  id: string
  label: string
  visible: boolean
  toggle: () => void
}

// Search applies after a short pause so each keystroke does not push a URL. `filters` holds the page's own selects.
export function DataTableToolbar({
  search,
  onSearch,
  filters,
  columns,
}: {
  search?: string
  onSearch?: (value: string) => void
  filters?: ReactNode
  columns: ColumnToggle[]
}) {
  const { t } = useT()
  const [draft, setDraft] = useState(search ?? "")
  useEffect(() => setDraft(search ?? ""), [search])
  useEffect(() => {
    if (!onSearch || draft === (search ?? "")) return
    const id = window.setTimeout(() => onSearch(draft), 300)
    return () => window.clearTimeout(id)
  }, [draft, search, onSearch])
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearch && (
        <Input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={t("common.search")}
          placeholder={t("common.search")}
          enterKeyHint="search"
          className="max-w-xs"
        />
      )}
      {filters}
      {columns.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="ms-auto" />}
          >
            <Columns3Icon aria-hidden="true" />
            {t("table.columns")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columns.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={c.visible}
                onCheckedChange={c.toggle}
                className="min-h-(--control-h)"
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
