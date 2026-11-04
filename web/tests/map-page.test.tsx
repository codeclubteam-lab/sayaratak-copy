import { useEffect, useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MapPage } from "@/features/map/components/map-page"
import { MapResults } from "@/features/map/components/map-results"
import { mapSearchSchema, type MapSearch } from "@/features/map/schemas"
import type { MapCanvasProps } from "@/components/app/map-canvas"
import { resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

// Leaflet needs a real browser. This stand-in reports a view of all Sudan once, draws each marker as a button with its shape, and shows the popup of the selected one.
const calls: MapCanvasProps[] = []
vi.mock("@/components/app/map-canvas-impl", () => ({
  MapCanvasImpl: (props: MapCanvasProps) => {
    calls.push(props)
    useEffect(() => {
      props.onMove?.({
        center: { lat: 15.5, lng: 32.56 },
        zoom: 6,
        bounds: { west: 20, south: 8, east: 39, north: 23 },
      })
    }, [])
    return (
      <div data-testid="map">
        {props.markers?.map((m) => (
          <button
            key={m.id}
            data-pin={m.shape}
            onClick={() => props.onSelect?.(m.id)}
          />
        ))}
        {props.selectedId && props.popup}
      </div>
    )
  },
}))

beforeEach(() => {
  resetDb()
  calls.length = 0
})

const pins = () =>
  [...document.querySelectorAll("[data-pin]")].map((p) =>
    p.getAttribute("data-pin")
  )
const lastCall = () => calls[calls.length - 1]

function Harness({ start = {} }: { start?: MapSearch }) {
  const [search, setSearch] = useState<MapSearch>(start)
  return (
    <>
      <MapPage search={search} onChange={setSearch} />
      <output data-testid="url">{JSON.stringify(search)}</output>
    </>
  )
}
const url = (): MapSearch => JSON.parse(screen.getByTestId("url").textContent)

describe("map search params", () => {
  it("layers has no default so /map stays clean, bad values are dropped", () => {
    expect(mapSearchSchema.parse({})).toEqual({
      intent: undefined,
      type: undefined,
      make: undefined,
      model: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minYear: undefined,
      maxYear: undefined,
      city: undefined,
      layers: undefined,
      lat: undefined,
      lng: undefined,
      zoom: undefined,
    })
    expect(mapSearchSchema.parse({ layers: [] }).layers).toBeUndefined()
    expect(mapSearchSchema.parse({ layers: ["x"] }).layers).toBeUndefined()
    expect(mapSearchSchema.parse({ layers: ["workshops"] }).layers).toEqual([
      "workshops",
    ])
  })
  it("zoom stays between 3 and 18, lat and lng are numbers", () => {
    expect(mapSearchSchema.parse({ zoom: "12" }).zoom).toBe(12)
    expect(mapSearchSchema.parse({ zoom: 2 }).zoom).toBeUndefined()
    expect(mapSearchSchema.parse({ zoom: 19 }).zoom).toBeUndefined()
    expect(mapSearchSchema.parse({ lat: "15.5" }).lat).toBe(15.5)
  })
})

describe("MapPage", () => {
  it("draws a distinct shape per kind and writes the view to the URL", async () => {
    await renderShell(<Harness />)
    await waitFor(() => expect(pins().length).toBeGreaterThan(3))
    expect(new Set(pins())).toEqual(
      new Set(["circle", "square", "diamond", "triangle"])
    )
    await waitFor(() =>
      expect(url()).toMatchObject({ lat: 15.5, lng: 32.56, zoom: 6 })
    )
  })

  it("layer chips change the pins and the last layer stays on", async () => {
    await renderShell(<Harness />)
    await waitFor(() => expect(pins().length).toBeGreaterThan(3))
    // Scoped to the chip group: a role query with a name is slow over a few hundred list buttons.
    const chip = (name: string) =>
      within(screen.getByRole("group", { name: "Show on the map" })).getByRole(
        "button",
        { name }
      )
    for (const name of ["Vehicles", "Workshops", "Mechanics"])
      fireEvent.click(chip(name))
    await waitFor(() => expect(new Set(pins())).toEqual(new Set(["square"])))
    expect(url().layers).toEqual(["dealerships"])
    fireEvent.click(chip("Dealerships"))
    expect(url().layers).toEqual(["dealerships"])
    expect(chip("Dealerships").getAttribute("aria-pressed")).toBe("true")
  })

  it("a row pans to its pin and opens the popup with a link to the page", async () => {
    await renderShell(<Harness start={{ layers: ["dealerships"] }} />)
    const side = await screen.findByRole("complementary")
    const rows = await within(side).findAllByRole("button")
    fireEvent.click(rows[0]!)
    const open = await screen.findByRole("link", { name: "Open" })
    expect(open.getAttribute("href")).toMatch(/^\/en\/dealerships\/./)
    // The map was told to go to the pin, close up.
    expect(lastCall()?.zoom).toBeGreaterThanOrEqual(14)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("link", { name: "Open" })).toBeNull()
  })

  it("a pin press selects it and opens the popup", async () => {
    await renderShell(<Harness start={{ layers: ["workshops"] }} />)
    await waitFor(() => expect(pins().length).toBeGreaterThan(0))
    fireEvent.click(document.querySelector("[data-pin]")!)
    expect(await screen.findByRole("link", { name: "Open" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Open" }).getAttribute("href")
    ).toMatch(/^\/en\/workshops\//)
  })

  it("below lg the list opens in a sheet, and pressing a row closes it and opens the popup", async () => {
    await renderShell(<Harness start={{ layers: ["workshops"] }} />)
    await waitFor(() => expect(pins().length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    const sheet = await screen.findByRole("dialog")
    fireEvent.click(
      within(sheet).getAllByRole("button", { name: /Workshop/ })[0]!
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(await screen.findByRole("link", { name: "Open" })).toBeTruthy()
  })

  it("with data saver on the map still loads at once, with no button first", async () => {
    await renderShell(<Harness start={{ layers: ["dealerships"] }} />, {
      prefs: { dataSaver: true, listingView: "grid" },
    })
    expect(await screen.findByTestId("map")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Load map" })).toBeNull()
    await waitFor(() => expect(pins().length).toBeGreaterThan(0))
  })

  it("Filters opens a dialog from md up and a bottom sheet below", async () => {
    const width = window.innerWidth
    try {
      for (const [w, slot] of [
        [1024, "dialog-content"],
        [500, "sheet-content"],
      ] as const) {
        window.innerWidth = w
        const { unmount } = await renderShell(
          <Harness start={{ layers: ["workshops"] }} />
        )
        fireEvent.click(screen.getByText("Filters", { selector: "button" }))
        const dialog = await screen.findByRole("dialog")
        expect(dialog.getAttribute("data-slot")).toBe(slot)
        unmount()
      }
    } finally {
      window.innerWidth = width
    }
  })

  it("the intent toggle writes to the URL", async () => {
    await renderShell(<Harness />)
    fireEvent.click(await screen.findByRole("button", { name: "Rent" }))
    expect(url().intent).toBe("rent")
  })

  it("choosing a city writes it to the URL and sends the map there", async () => {
    await renderShell(<Harness />)
    await pick(
      await screen.findByRole("combobox", { name: "City" }),
      "Port Sudan"
    )
    expect(url().city).toBe("port-sudan")
    await waitFor(() => expect(lastCall()?.center.lat).toBeCloseTo(19.6, 0))
    expect(lastCall()?.zoom).toBe(12)
  })
})

describe("MapResults", () => {
  const none = { pending: false, failed: false, stale: false }
  const noop = () => undefined
  it("over the cap it says how many there are", async () => {
    await renderShell(
      <MapResults
        {...none}
        items={[]}
        total={420}
        onPick={noop}
        onRetry={noop}
      />
    )
    expect(screen.getByText("Zoom in to see all 420")).toBeTruthy()
  })
  it("an empty area says so", async () => {
    await renderShell(
      <MapResults {...none} items={[]} total={0} onPick={noop} onRetry={noop} />
    )
    expect(screen.getByText(/Nothing in this area/)).toBeTruthy()
  })
  it("a failed load offers a retry", async () => {
    const retry = vi.fn()
    await renderShell(
      <MapResults
        {...none}
        failed
        items={[]}
        total={0}
        onPick={noop}
        onRetry={retry}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalled()
  })
})
