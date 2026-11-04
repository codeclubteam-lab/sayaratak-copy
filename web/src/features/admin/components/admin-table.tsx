import { useCallback, useState, type ReactNode } from "react"
import { useLocation } from "@tanstack/react-router"
import type { RowData, RowSelectionState } from "@tanstack/react-table"

import { DataTable, type DataTableProps } from "@/components/app/data-table"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { AdminTableSearch } from "../schemas"

type Page<T> = { items: T[]; total: number; pageSize: number }

// The DataTable every admin list uses. The URL holds search, filters, sort and page; the page passes the route's
// `navigate` (in `useCallback`, so the search box keeps its pause) and its own filter controls. Selection belongs to
// one URL: it is dropped when the search changes. `bulkActions` gets the picked ids and a way to clear them.
export function AdminTable<
  T extends RowData,
  TSearch extends AdminTableSearch,
>({
  search,
  onNavigate,
  result,
  bulkActions,
  ...table
}: Omit<
  DataTableProps<T>,
  | "data"
  | "sort"
  | "onSortChange"
  | "search"
  | "onSearch"
  | "selection"
  | "page"
  | "pageCount"
  | "hrefFor"
  | "onPageChange"
> & {
  search: TSearch
  onNavigate: (next: TSearch) => void
  result: Page<T> | undefined
  bulkActions?: (ids: string[], clear: () => void) => ReactNode
}) {
  const { locale } = useT()
  const pathname = useLocation({ select: (l) => l.pathname })
  const urlKey = JSON.stringify(search)
  const [picked, setPicked] = useState<{
    urlKey: string
    rows: RowSelectionState
  }>({ urlKey, rows: {} })
  const rows = picked.urlKey === urlKey ? picked.rows : {}
  const ids = Object.keys(rows).filter((id) => rows[id])
  const setRows = (next: RowSelectionState) => setPicked({ urlKey, rows: next })

  const onSearch = useCallback(
    (q: string) => onNavigate({ ...search, q: q || undefined, page: 1 }),
    [onNavigate, search]
  )
  const hrefFor = (page: number) => {
    const query = new URLSearchParams(
      Object.entries({ ...search, page: page > 1 ? page : undefined }).flatMap(
        ([k, v]: [string, unknown]) =>
          v === undefined || v === "" ? [] : [[k, String(v)]]
      )
    ).toString()
    return localeHref(`${pathname}${query && `?${query}`}`, locale)
  }

  return (
    <DataTable
      {...table}
      data={result?.items}
      sort={search.sort}
      onSortChange={(sort) => onNavigate({ ...search, sort, page: 1 })}
      search={search.q ?? ""}
      onSearch={onSearch}
      selection={
        bulkActions && {
          value: rows,
          onChange: setRows,
          actions: bulkActions(ids, () => setRows({})),
        }
      }
      page={search.page}
      pageCount={
        result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1
      }
      hrefFor={hrefFor}
      onPageChange={(page) => onNavigate({ ...search, page })}
    />
  )
}
