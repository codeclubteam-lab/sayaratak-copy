import { useState, type FormEvent, type ReactNode } from "react"
import { SearchIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { FormField } from "@/components/app/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// The frame every directory toolbar shares: a name search that waits for Search or Enter (like the search bar), then the page's own `fields` (selects) and `switches` (toggles, location), then the sort.
// From md they sit in the page. On a phone they move behind a Filters button (with the number of active filters) so the results start above the fold; the sheet's button shows how many results the filters give.
export function DirectoryToolbar({
  q,
  nameLabel,
  onSearch,
  fields,
  switches,
  sort,
  activeCount,
  resultCount,
}: {
  q: string | undefined
  nameLabel: string
  onSearch: (q: string | undefined) => void
  fields: ReactNode
  switches: ReactNode
  sort: ReactNode
  activeCount: number
  resultCount: number | undefined
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(q ?? "")
  // A chip, the back button or a cleared URL changes the keyword, so the field follows it.
  const [seen, setSeen] = useState(q)
  if (seen !== q) {
    setSeen(q)
    setDraft(q ?? "")
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(draft.trim() || undefined)
  }
  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        aria-label={t("common.search")}
        onSubmit={submit}
        className="flex items-end gap-3 md:flex-wrap"
      >
        <FormField label={nameLabel} className="min-w-0 flex-1 md:min-w-60">
          {(c) => (
            <Input
              {...c}
              type="search"
              enterKeyHint="search"
              maxLength={60}
              placeholder={t("directory.search_placeholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
        </FormField>
        <div className="hidden items-end gap-3 md:contents">{fields}</div>
        <Button type="submit">
          <SearchIcon data-icon="inline-start" />
          {t("common.search")}
        </Button>
      </form>
      <div className="flex items-center justify-between gap-3">
        <div className="hidden flex-wrap items-center gap-x-6 gap-y-2 md:flex">
          {switches}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" className="md:hidden" />}
          >
            {t("common.filters")}
            {activeCount > 0 && <span className="num">({activeCount})</span>}
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-dvh gap-4 overflow-y-auto px-4 pb-4"
          >
            <SheetHeader>
              <SheetTitle>{t("search.filters_title")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4">{fields}</div>
            <div className="flex flex-col items-start gap-3">{switches}</div>
            <Button type="button" onClick={() => setOpen(false)}>
              {resultCount !== undefined
                ? t("search.show_results", { count: resultCount })
                : t("search.apply")}
            </Button>
          </SheetContent>
        </Sheet>
        {sort}
      </div>
    </div>
  )
}
