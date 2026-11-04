import {
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"

// `sortKey` is the API sort base: a header click asks for `<sortKey>_asc`, then `<sortKey>_desc`. `align: "end"` lines numbers up at the end of the column, header included.
export type DataColumnMeta = { sortKey?: string; align?: "end" }

// Phantom value: only its type matters.
const meta: DataColumnMeta = {}

// Sorting, filtering and paging are the server's job (A6), so only selection and column visibility are registered.
export const dataTableFeatures = tableFeatures({
  rowSelectionFeature,
  columnVisibilityFeature,
  columnMeta: meta,
})

export type DataColumn<T extends RowData> = ColumnDef<
  typeof dataTableFeatures,
  T
>
