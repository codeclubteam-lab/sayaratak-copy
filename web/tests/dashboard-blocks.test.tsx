import { useState } from "react"
import { InboxIcon } from "lucide-react"
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import type { RowSelectionState } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import type { DataColumn } from "@/lib/table"
import { AreaChartCard } from "@/components/app/area-chart-card"
import { BarChartCard } from "@/components/app/bar-chart-card"
import { CopyButton } from "@/components/app/copy-button"
import { DataTable } from "@/components/app/data-table"
import { DateRangeSelect } from "@/components/app/date-range-select"
import { EmptyState } from "@/components/app/empty-state"
import { RowActions } from "@/components/app/row-actions"
import { StatCard } from "@/components/app/stat-card"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

type Row = { id: string; name: string; price: number }
const data: Row[] = [
  { id: "a", name: "Alpha", price: 3 },
  { id: "b", name: "Beta", price: 1 },
  { id: "c", name: "Gamma", price: 2 },
]
const columns: DataColumn<Row>[] = [
  { accessorKey: "name", header: "Name", enableHiding: false },
  { accessorKey: "price", header: "Price", meta: { sortKey: "price" } },
]

function Table(
  props: Partial<Parameters<typeof DataTable<Row>>[0]> & {
    onSort?: (s: string) => void
  }
) {
  const [selection, setSelection] = useState<RowSelectionState>({})
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      label="Rows"
      onSortChange={props.onSort}
      selection={{
        value: selection,
        onChange: setSelection,
        actions: <button type="button">Bulk go</button>,
      }}
      empty={<EmptyState icon={InboxIcon} title="Nothing here" />}
      page={1}
      pageCount={1}
      hrefFor={() => "/"}
      onPageChange={() => {}}
      {...props}
    />
  )
}

describe("DataTable", () => {
  it("renders rows and reports sort clicks, flipping direction", async () => {
    const onSort = vi.fn()
    await renderShell(<Table onSort={onSort} />)
    expect(screen.getAllByRole("row")).toHaveLength(4)
    fireEvent.click(screen.getByRole("button", { name: "Price" }))
    expect(onSort).toHaveBeenCalledWith("price_asc")
  })
  it("a second click on the active column flips to descending", async () => {
    const onSort = vi.fn()
    await renderShell(<Table onSort={onSort} sort="price_asc" />)
    fireEvent.click(screen.getByRole("button", { name: "Price" }))
    expect(onSort).toHaveBeenCalledWith("price_desc")
  })
  it("sets aria-sort from the sort prop", async () => {
    await renderShell(<Table onSort={() => {}} sort="price_desc" />)
    expect(
      screen
        .getByRole("columnheader", { name: "Price" })
        .getAttribute("aria-sort")
    ).toBe("descending")
  })
  it("select all shows the bulk bar with a count, clear hides it", async () => {
    await renderShell(<Table />)
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all rows on this page" })
    )
    const bar = await screen.findByRole("region", {
      name: "Actions for selected rows",
    })
    expect(within(bar).getByText("3 selected")).toBeTruthy()
    expect(within(bar).getByRole("button", { name: "Bulk go" })).toBeTruthy()
    fireEvent.click(
      within(bar).getByRole("button", { name: "Clear selection" })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Actions for selected rows" })
      ).toBeNull()
    )
  })
  it("shows the empty node for no rows", async () => {
    await renderShell(<Table data={[]} />)
    expect(screen.getByText("Nothing here")).toBeTruthy()
  })
  it("shows the error state with a retry button", async () => {
    const onRetry = vi.fn()
    await renderShell(<Table error onRetry={onRetry} />)
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalled()
  })
  it("shows skeleton rows only after 150 ms of loading", async () => {
    vi.useFakeTimers()
    const { container } = await renderShell(<Table data={undefined} loading />)
    expect(container.querySelectorAll("[data-slot=skeleton]")).toHaveLength(0)
    await act(() => vi.advanceTimersByTimeAsync(160))
    expect(
      container.querySelectorAll("[data-slot=skeleton]").length
    ).toBeGreaterThan(0)
    vi.useRealTimers()
  })
  it("hides a column from the column menu", async () => {
    await renderShell(<Table />)
    fireEvent.click(screen.getByRole("button", { name: "Columns" }))
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Price" })
    )
    await waitFor(() =>
      expect(screen.queryByRole("columnheader", { name: "Price" })).toBeNull()
    )
  })
  it("renders the mobile card for each row when given", async () => {
    await renderShell(<Table mobileCard={(r) => <p>card {r.name}</p>} />)
    expect(screen.getByText("card Alpha")).toBeTruthy()
  })
})

describe("RowActions", () => {
  it("lists destructive actions last and confirms before running them", async () => {
    const remove = vi.fn()
    const edit = vi.fn()
    await renderShell(
      <RowActions
        label="Alpha"
        actions={[
          {
            key: "del",
            label: "Delete",
            onSelect: remove,
            destructive: { title: "Delete Alpha?" },
          },
          { key: "edit", label: "Edit", onSelect: edit },
        ]}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Actions for Alpha" }))
    const items = await screen.findAllByRole("menuitem")
    expect(items.map((i) => i.textContent)).toEqual(["Edit", "Delete"])
    fireEvent.click(items[1]!)
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      })
    )
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe("StatCard", () => {
  it("shows the change against the previous period", async () => {
    await renderShell(<StatCard label="Views" value={1500} previous={1000} />)
    expect(screen.getByText("1,500")).toBeTruthy()
    expect(screen.getByText(/\+50%/)).toBeTruthy()
  })
  it("reads a tiny drop as 0%, never -0%", async () => {
    await renderShell(<StatCard label="Views" value={999} previous={1000} />)
    expect(screen.getByText(/0%/).textContent).not.toContain("-")
  })
  it("hides the change when the previous period is 0", async () => {
    await renderShell(<StatCard label="Views" value={5} previous={0} />)
    expect(screen.queryByText(/%/)).toBeNull()
  })
})

describe("DateRangeSelect", () => {
  it("reports the chosen range", async () => {
    const onChange = vi.fn()
    await renderShell(<DateRangeSelect value="30d" onChange={onChange} />)
    await pick(screen.getByLabelText("Period"), "Last 7 days")
    expect(onChange).toHaveBeenCalledWith("7d")
  })
})

describe("charts", () => {
  const series = [{ key: "views", label: "Views" }]
  it("shows the empty line, the error with retry and a loading skeleton", async () => {
    const onRetry = vi.fn()
    const empty = await renderShell(
      <AreaChartCard title="Views" data={[]} series={series} />
    )
    expect(screen.getByText("No data for this period yet.")).toBeTruthy()
    empty.unmount()
    const failed = await renderShell(
      <BarChartCard title="Views" series={series} error onRetry={onRetry} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalled()
    failed.unmount()
    const { container } = await renderShell(
      <BarChartCard title="Views" series={series} loading />
    )
    expect(container.querySelector("[data-slot=skeleton]")).toBeTruthy()
  })
})

describe("CopyButton", () => {
  it("writes the value to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await renderShell(<CopyButton value="L-1000" label="Copy ID" />)
    fireEvent.click(screen.getByRole("button", { name: "Copy ID" }))
    expect(writeText).toHaveBeenCalledWith("L-1000")
  })
})
