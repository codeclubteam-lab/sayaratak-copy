import { useState, type FormEvent } from "react"
import { SearchIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { clearFilters } from "../filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { IntentToggle } from "./intent-toggle"

// The home search card, compact: vehicles or parts, buy or rent, and the keyword. City, make and price live in the filter panel.
export function SearchBar({
  search,
  onChange,
}: {
  search: SearchParams
  onChange: (next: SearchParams) => void
}) {
  const { t } = useT()
  const [q, setQ] = useState(search.q ?? "")
  // A chip or "Clear all" removes the keyword from the URL, so the field follows it.
  const [seen, setSeen] = useState(search.q)
  if (seen !== search.q) {
    setSeen(search.q)
    setQ(search.q ?? "")
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onChange({ ...search, q: q.trim() || undefined, page: 1 })
  }
  return (
    <form
      role="search"
      aria-label={t("common.search")}
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2"
    >
      <ToggleGroup
        aria-label={t("search.kind_label")}
        variant="outline"
        spacing={0}
        value={[search.kind]}
        onValueChange={(next) => {
          // Switching keeps the city and the keyword and drops filters that do not fit the other kind.
          const kind = next.find((v) => v === "vehicle" || v === "part")
          if (kind && kind !== search.kind)
            onChange({
              ...clearFilters(search),
              city: search.city,
              kind,
              intent: kind === "part" ? undefined : search.intent,
            })
        }}
      >
        <ToggleGroupItem value="vehicle">
          {t("home.tab_vehicles")}
        </ToggleGroupItem>
        <ToggleGroupItem value="part">{t("home.tab_parts")}</ToggleGroupItem>
      </ToggleGroup>
      {search.kind === "vehicle" && (
        <IntentToggle
          value={search.intent}
          onChange={(intent) => onChange({ ...search, intent, page: 1 })}
        />
      )}
      <div className="flex min-w-60 flex-1 items-center gap-2">
        <Input
          type="search"
          enterKeyHint="search"
          aria-label={t("search.query_label")}
          placeholder={t("search.query_placeholder")}
          maxLength={80}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit">
          <SearchIcon data-icon="inline-start" />
          {t("common.search")}
        </Button>
      </div>
    </form>
  )
}
