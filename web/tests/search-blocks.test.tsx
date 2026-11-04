import { useState } from "react"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { applyDraft, clearFilters, toDraft } from "@/features/search/filters"
import {
  searchParamsSchema,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"
import { ActiveFilterChips } from "@/components/app/active-filter-chips"
import { EmptyResults } from "@/components/app/empty-results"
import { FilterPanel } from "@/components/app/filter-panel"
import { ResultsPagination } from "@/components/app/results-pagination"
import { SortSelect } from "@/components/app/sort-select"
import { resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

const base = searchParamsSchema.parse({})

describe("filter helpers", () => {
  it("applyDraft drops empties, swaps a reversed range, resets the page", () => {
    const d = {
      ...toDraft({ ...base, page: 3 }),
      minPrice: 900,
      maxPrice: 100,
      fuel: ["diesel" as const],
    }
    const out = applyDraft({ ...base, page: 3 }, d, undefined)
    expect(out).toMatchObject({ minPrice: 100, maxPrice: 900, page: 1 })
    expect(out.fuel).toEqual(["diesel"])
    expect(out.city).toBeUndefined()
    expect(out.radius).toBeUndefined()
  })
  it("radius takes the city center as origin", () => {
    const out = applyDraft(
      base,
      { ...toDraft(base), city: "c1", radius: 25 },
      { lat: 15.5, lng: 32.5 }
    )
    expect(out).toMatchObject({ radius: 25, lat: 15.5, lng: 32.5 })
  })
  it("clearFilters keeps q, kind and sort", () => {
    const out = clearFilters({
      ...base,
      q: "hilux",
      sort: "price_asc",
      minPrice: 5,
      fuel: ["petrol"],
    })
    expect(out).toMatchObject({
      q: "hilux",
      sort: "price_asc",
      kind: "vehicle",
    })
    expect(out.minPrice).toBeUndefined()
    expect(out.fuel).toBeUndefined()
  })
})

function Harness({ start }: { start: SearchParams }) {
  const [params, setParams] = useState(start)
  return (
    <>
      <FilterPanel params={params} onApply={setParams} className="" />
      <ActiveFilterChips params={params} onChange={setParams} />
      <SortSelect
        value={params.sort}
        options={["relevance", "price_asc"]}
        onChange={(sort) => setParams({ ...params, sort })}
      />
      <EmptyResults params={params} onChange={setParams} />
      <ResultsPagination
        page={params.page}
        pageCount={9}
        hrefFor={(p) => `?page=${p}`}
        onPageChange={(page) => setParams({ ...params, page })}
      />
      <output>{JSON.stringify(params)}</output>
    </>
  )
}
const out = () => JSON.parse(screen.getByRole("status").textContent)

describe("search blocks", () => {
  it("the panel writes the draft once it settles, chips remove one filter, clear all resets", async () => {
    await renderShell(<Harness start={{ ...base, page: 4 }} />)
    fireEvent.change(await screen.findByLabelText("Lowest price"), {
      target: { value: "5000" },
    })
    fireEvent.click(screen.getByLabelText("Petrol"))
    await waitFor(
      () =>
        expect(out()).toMatchObject({
          minPrice: 5000,
          fuel: ["petrol"],
          page: 1,
        }),
      { timeout: 3000 }
    )
    const chip = (
      await screen.findAllByRole("button", { name: "Remove Petrol" })
    )[0]!
    fireEvent.click(chip)
    await waitFor(() => expect(out().fuel).toBeUndefined())
    expect(out().minPrice).toBe(5000)
    fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0]!)
    await waitFor(() => expect(out().minPrice).toBeUndefined())
  })
  it("sort, pagination and suggestions update the params", async () => {
    await renderShell(<Harness start={{ ...base, maxPrice: 10, page: 4 }} />)
    await pick(await screen.findByLabelText("Sort by"), "Price: low to high")
    await waitFor(() => expect(out().sort).toBe("price_asc"))
    fireEvent.click(screen.getByRole("link", { name: "Go to page 5" }))
    await waitFor(() => expect(out().page).toBe(5))
    expect(
      screen.getByRole("link", { name: "Go to page 9" }).getAttribute("href")
    ).toBe("?page=9")
    fireEvent.click(
      screen.getAllByRole("button", { name: /^Remove .*10/ }).at(-1)!
    )
    await waitFor(() => expect(out().maxPrice).toBeUndefined())
  })
})
