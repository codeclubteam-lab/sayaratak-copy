import type { ReactNode } from "react"
import {
  functionalUpdate,
  useTable,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { dataTableFeatures, type DataColumn } from "@/lib/table"
import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BulkActionBar } from "./bulk-action-bar"
import { DataTableToolbar } from "./data-table-toolbar"
import { ResultsPagination } from "./results-pagination"

export type DataTableProps<T extends RowData> = {
  columns: DataColumn<T>[]
  data: T[] | undefined
  getRowId: (row: T) => string
  // Names the table for screen readers.
  label: string
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  // The URL holds sort, search and page; the table only reports clicks.
  sort?: string
  onSortChange?: (sort: string) => void
  search?: string
  onSearch?: (value: string) => void
  filters?: ReactNode
  // Without `selection` there are no checkboxes and no bulk bar.
  selection?: {
    value: RowSelectionState
    onChange: (value: RowSelectionState) => void
    actions: ReactNode
  }
  // Below md each row renders as this card. Without it the table scrolls sideways with its first column pinned.
  mobileCard?: (row: T) => ReactNode
  empty: ReactNode
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  onPageChange: (page: number) => void
}

const SKELETON_ROWS = 6

export function DataTable<T extends RowData>({
  columns,
  data,
  getRowId,
  label,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  search,
  onSearch,
  filters,
  selection,
  mobileCard,
  empty,
  page,
  pageCount,
  hrefFor,
  onPageChange,
}: DataTableProps<T>) {
  const { t } = useT()
  const showSkeleton = useDelayedFlag(!!loading)
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? [],
    getRowId,
    enableRowSelection: !!selection,
    state: { rowSelection: selection?.value ?? {} },
    onRowSelectionChange: (u) =>
      selection?.onChange(functionalUpdate(u, selection.value)),
  })
  const count = selection
    ? Object.values(selection.value).filter(Boolean).length
    : 0
  const toggles = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide())
    .map((c) => ({
      id: c.id,
      label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
      visible: c.getIsVisible(),
      toggle: () => c.toggleVisibility(),
    }))
  const rows = table.getRowModel().rows
  const colSpan = table.getVisibleLeafColumns().length + (selection ? 1 : 0)
  const mobileOnly = mobileCard ? "hidden md:block" : ""

  const check = (row: (typeof rows)[number]) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(v) => row.toggleSelected(v)}
      aria-label={t("table.select_row")}
    />
  )
  const message = error ? (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-4 py-12 text-center"
    >
      <TriangleAlertIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-ui font-medium">{t("table.error")}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        <RefreshCwIcon data-icon="inline-start" />
        {t("common.retry")}
      </Button>
    </div>
  ) : data?.length === 0 ? (
    empty
  ) : null

  return (
    <div className="flex flex-col gap-4">
      {(onSearch || filters || toggles.length > 0) && (
        <DataTableToolbar
          search={search}
          onSearch={onSearch}
          filters={filters}
          columns={toggles}
        />
      )}
      {selection && count > 0 && (
        <BulkActionBar count={count} onClear={() => selection.onChange({})}>
          {selection.actions}
        </BulkActionBar>
      )}
      <div
        className="rounded-xl bg-card"
        aria-busy={loading}
        data-slot="data-table"
      >
        {message ?? (
          <>
            <div className={mobileOnly}>
              <Table aria-label={label}>
                <TableHeader>
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id} className="hover:bg-transparent">
                      {selection && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={table.getIsAllRowsSelected()}
                            indeterminate={table.getIsSomeRowsSelected()}
                            onCheckedChange={(v) =>
                              table.toggleAllRowsSelected(v)
                            }
                            aria-label={t("table.select_all")}
                          />
                        </TableHead>
                      )}
                      {group.headers.map((header, i) => {
                        const key = header.column.columnDef.meta?.sortKey
                        const end =
                          header.column.columnDef.meta?.align === "end"
                        const dir =
                          sort === `${key}_asc`
                            ? "asc"
                            : sort === `${key}_desc`
                              ? "desc"
                              : undefined
                        const content = header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )
                        return (
                          <TableHead
                            key={header.id}
                            aria-sort={
                              dir === "asc"
                                ? "ascending"
                                : dir === "desc"
                                  ? "descending"
                                  : undefined
                            }
                            className={cn(
                              !mobileCard &&
                                i === 0 &&
                                "max-md:sticky max-md:start-0 max-md:bg-card",
                              end && "text-end"
                            )}
                          >
                            {key && onSortChange ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="-ms-3"
                                onClick={() =>
                                  onSortChange(
                                    `${key}_${dir === "asc" ? "desc" : "asc"}`
                                  )
                                }
                              >
                                {content}
                                {dir === "asc" && (
                                  <ArrowUpIcon aria-hidden="true" />
                                )}
                                {dir === "desc" && (
                                  <ArrowDownIcon aria-hidden="true" />
                                )}
                              </Button>
                            ) : (
                              content
                            )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {loading
                    ? showSkeleton &&
                      Array.from({ length: SKELETON_ROWS }, (_, r) => (
                        <TableRow key={r} className="h-12 hover:bg-transparent">
                          <TableCell colSpan={colSpan}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="h-12"
                          data-state={
                            row.getIsSelected() ? "selected" : undefined
                          }
                        >
                          {selection && <TableCell>{check(row)}</TableCell>}
                          {row.getVisibleCells().map((cell, i) => (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                !mobileCard &&
                                  i === 0 &&
                                  "max-md:sticky max-md:start-0 max-md:bg-card",
                                cell.column.columnDef.meta?.align === "end" &&
                                  "text-end"
                              )}
                            >
                              <table.FlexRender cell={cell} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
            {mobileCard && (
              <ul className="flex flex-col gap-2 p-2 md:hidden">
                {loading
                  ? showSkeleton &&
                    Array.from({ length: SKELETON_ROWS }, (_, r) => (
                      <li key={r}>
                        <Skeleton className="h-20" />
                      </li>
                    ))
                  : rows.map((row) => (
                      <li key={row.id} className="flex items-start gap-3">
                        {selection && <div className="pt-4">{check(row)}</div>}
                        <div className="min-w-0 flex-1">
                          {mobileCard(row.original)}
                        </div>
                      </li>
                    ))}
              </ul>
            )}
          </>
        )}
      </div>
      <ResultsPagination
        page={page}
        pageCount={pageCount}
        hrefFor={hrefFor}
        onPageChange={onPageChange}
      />
    </div>
  )
}
