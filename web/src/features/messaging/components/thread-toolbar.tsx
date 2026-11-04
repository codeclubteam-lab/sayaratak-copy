import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT } from "@/lib/i18n/use-t"
import type { MessagesSearch } from "../schemas"

// Search applies after a short pause so each keystroke does not push a URL. Pressing the chosen filter again goes back to All.
export function ThreadToolbar({
  q,
  filter,
  onSearch,
  onFilter,
}: {
  q?: string
  filter: MessagesSearch["filter"]
  onSearch: (value: string) => void
  onFilter: (filter: MessagesSearch["filter"]) => void
}) {
  const { t } = useT()
  const [draft, setDraft] = useState(q ?? "")
  useEffect(() => setDraft(q ?? ""), [q])
  useEffect(() => {
    if (draft === (q ?? "")) return
    const id = window.setTimeout(() => onSearch(draft), 300)
    return () => window.clearTimeout(id)
  }, [draft, q, onSearch])
  return (
    <div className="flex flex-col gap-2 p-3">
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={t("messages.search_label")}
        placeholder={t("common.search")}
        enterKeyHint="search"
      />
      <ToggleGroup
        aria-label={t("messages.filter_label")}
        variant="outline"
        spacing={0}
        value={[filter]}
        onValueChange={(next) =>
          onFilter(next[0] === "unread" ? "unread" : "all")
        }
      >
        <ToggleGroupItem value="all">
          {t("messages.filter_all")}
        </ToggleGroupItem>
        <ToggleGroupItem value="unread">
          {t("messages.filter_unread")}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
