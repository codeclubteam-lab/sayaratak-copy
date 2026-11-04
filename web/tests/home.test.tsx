import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HomePage } from "@/features/home/components/home-page"
import { HeroSearch } from "@/features/home/components/hero-search"
import { heroSearchSchema } from "@/features/home/schemas"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

const center = { lat: 15.5007, lng: 32.5599 }
const page = (props: Partial<Parameters<typeof HomePage>[0]> = {}) => (
  <HomePage
    searchCity=""
    city="khartoum"
    center={center}
    geo={null}
    {...props}
  />
)

beforeEach(() => resetDb())
afterEach(() => {
  document.cookie = "geo=; Max-Age=0; Path=/"
  document.cookie = "city=; Max-Age=0; Path=/"
  vi.unstubAllGlobals()
})

describe("heroSearchSchema", () => {
  const ok = { kind: "vehicle", intent: "sale", maxPrice: null }
  it("accepts an empty search and a price", () => {
    expect(heroSearchSchema.safeParse(ok).success).toBe(true)
    expect(
      heroSearchSchema.safeParse({ ...ok, maxPrice: 5_000_000 }).success
    ).toBe(true)
  })
  it("rejects a negative or fractional price with a key", () => {
    expect(
      heroSearchSchema.safeParse({ ...ok, maxPrice: -1 }).error?.issues[0]
        ?.message
    ).toBe("validation.number")
    expect(
      heroSearchSchema.safeParse({ ...ok, maxPrice: 1.5 }).error?.issues[0]
        ?.message
    ).toBe("validation.integer")
  })
})

describe("HeroSearch", () => {
  it("goes to the search page with the chosen filters", async () => {
    const { router } = await renderShell(<HeroSearch city="" />)
    const city = await screen.findByRole("combobox", { name: "City" })
    await pick(city, "Omdurman")
    fireEvent.change(screen.getByRole("textbox", { name: "Highest price" }), {
      target: { value: "5000000" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Rent" }))
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    await waitFor(() =>
      expect(router.history.location.pathname).toBe("/en/search")
    )
    const search = new URLSearchParams(router.history.location.search)
    expect(search.get("kind")).toBe("vehicle")
    expect(search.get("intent")).toBe("rent")
    expect(search.get("city")).toBe("omdurman")
    expect(search.get("maxPrice")).toBe("5000000")
    expect(search.has("make")).toBe(false)
    // The city is remembered for the next visit.
    expect(document.cookie).toContain("city=omdurman")
  })

  it("hides buy and rent on the Parts tab and leaves the intent out of the URL", async () => {
    const { router } = await renderShell(<HeroSearch city="" />)
    expect(screen.getByRole("button", { name: "Rent" })).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: "Parts" }))
    expect(screen.queryByRole("button", { name: "Rent" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    await waitFor(() =>
      expect(router.history.location.pathname).toBe("/en/search")
    )
    const search = new URLSearchParams(router.history.location.search)
    expect(search.get("kind")).toBe("part")
    expect(search.has("intent")).toBe(false)
  })

  it("keeps the model disabled until a make is chosen", async () => {
    await renderShell(<HeroSearch city="" />)
    const model = await screen.findByRole("combobox", { name: "Model" })
    expect(model.hasAttribute("disabled")).toBe(true)
    const make = screen.getByRole("combobox", { name: "Make" })
    await pick(make, "Toyota")
    expect(screen.queryByRole("option", { name: "Other" })).toBeNull()
    await waitFor(() => expect(model.hasAttribute("disabled")).toBe(false))
  })

  it("starts from the city cookie", async () => {
    await renderShell(<HeroSearch city="bahri" />)
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "City" }).textContent
      ).toContain("Bahri")
    )
  })
})

describe("HomePage", () => {
  it("leads with the banner, then the search card that carries the heading", async () => {
    await renderShell(page())
    const [banner] = await screen.findAllByRole("link", {
      name: /Browse cars/,
    })
    const form = screen
      .getByRole("heading", { level: 1 })
      .closest("form") as HTMLElement
    expect(form.querySelector("[role=combobox]")).toBeTruthy()
    expect(
      banner!.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("shows the heading, eight tiles with counts, the rails and the bands", async () => {
    await renderShell(page())
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Find your next vehicle in Sudan",
      })
    ).toBeTruthy()
    for (const title of [
      "Featured",
      "Near you",
      "Newly added",
      "Cars for rent",
      "Verified dealerships",
      "Top workshops",
      "Top mechanics",
    ])
      expect(await screen.findByRole("heading", { name: title })).toBeTruthy()
    const tiles = within(
      screen.getByRole("region", { name: "Browse by category" })
    ).getAllByRole("link")
    expect(tiles).toHaveLength(8)
    // Counts arrive with the queries: the Cars tile shows the number of cars.
    const cars = db.listings.filter(
      (l) =>
        l.moderation === "approved" &&
        l.vehicleType === "car" &&
        l.status !== "sold" &&
        l.status !== "rented"
    ).length
    await waitFor(() =>
      expect(
        within(tiles[0]!).getByText(
          String(cars).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        )
      ).toBeTruthy()
    )
    expect(tiles[0]?.getAttribute("href")).toBe("/en/vehicles/cars/sale")
    expect(tiles[5]?.getAttribute("href")).toBe("/en/parts")
  })

  it("links every rail to a real list and rail photos load lazily", async () => {
    await renderShell(page())
    const featured = (
      await screen.findByRole("heading", { name: "Featured" })
    ).closest("section")!
    const seeAll = within(featured).getByRole("link", { name: "See all" })
    expect(seeAll.getAttribute("href")).toContain("/en/search?featured=true")
    await waitFor(() =>
      expect(featured.querySelectorAll("img").length).toBeGreaterThan(0)
    )
    const images = [...featured.querySelectorAll("img")]
    expect(images.length).toBeGreaterThanOrEqual(4)
    for (const img of images.slice(0, 4))
      expect(img.getAttribute("loading")).toBe("lazy")
    const dealers = (
      await screen.findByRole("heading", { name: "Verified dealerships" })
    ).closest("section")!
    expect(
      within(dealers)
        .getByRole("link", { name: "All dealerships" })
        .getAttribute("href")
    ).toBe("/en/dealerships")
  })

  it("leaves out a rail with no listings", async () => {
    for (const l of db.listings) l.moderation = "removed"
    await renderShell(page())
    await waitFor(() =>
      expect(
        screen.getAllByRole("heading", { level: 2 }).length
      ).toBeGreaterThan(1)
    )
    expect(screen.queryByRole("heading", { name: "Featured" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Newly added" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Cars for rent" })).toBeNull()
    expect(
      await screen.findByRole("heading", { name: "Verified dealerships" })
    ).toBeTruthy()
  })

  it("offers the post button to buyers and dealers but not to workshops", async () => {
    const { unmount } = await renderShell(page())
    expect(
      await screen.findByRole("link", { name: "Post a listing" })
    ).toBeTruthy()
    unmount()
    await renderShell(page(), { role: "workshop" })
    await screen.findByRole("heading", { name: "Verified dealerships" })
    expect(screen.queryByRole("link", { name: "Post a listing" })).toBeNull()
  })

  it("shows a retry when a section fails and recovers", async () => {
    document.cookie = "mock_fail=500; Path=/"
    await renderShell(page())
    expect(
      (await screen.findAllByText("This section did not load.")).length
    ).toBeGreaterThan(0)
    document.cookie = "mock_fail=; Max-Age=0; Path=/"
    for (const retry of screen.getAllByRole("button", { name: "Try again" }))
      fireEvent.click(retry)
    await waitFor(() =>
      expect(screen.queryAllByText("This section did not load.")).toHaveLength(
        0
      )
    )
  })
})

describe("Near you", () => {
  const position = { coords: { latitude: 15.6, longitude: 32.5 } }
  // jsdom has no geolocation: define one for the test and remove it after.
  const stub = (result: "granted" | "denied") =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          ok: (p: typeof position) => void,
          fail: (e: { code: number; PERMISSION_DENIED: number }) => void
        ) =>
          result === "granted"
            ? ok(position)
            : fail({ code: 1, PERMISSION_DENIED: 1 }),
      },
    })
  afterEach(() => Reflect.deleteProperty(navigator, "geolocation"))

  it("follows the city until the visitor shares a position, then offers a radius", async () => {
    stub("granted")
    await renderShell(page())
    const section = (
      await screen.findByRole("heading", { name: "Near you" })
    ).closest("section")!
    expect(within(section).getByText("Showing Khartoum")).toBeTruthy()
    fireEvent.click(
      within(section).getByRole("button", { name: "Use my location" })
    )
    const radius = await within(section).findByRole("combobox", {
      name: "Distance",
    })
    expect(radius.textContent).toContain("25 km")
    expect(document.cookie).toContain("geo=")
    await pick(radius, "Within 5 km")
    await waitFor(() =>
      expect(
        within(section)
          .getByRole("link", { name: "See all" })
          .getAttribute("href")
      ).toContain("radius=5")
    )
    fireEvent.click(
      within(section).getByRole("button", { name: "Show Khartoum instead" })
    )
    expect(within(section).getByText("Showing Khartoum")).toBeTruthy()
    expect(document.cookie).not.toContain("geo=15")
  })

  it("keeps the city when permission is refused", async () => {
    stub("denied")
    await renderShell(page())
    const section = (
      await screen.findByRole("heading", { name: "Near you" })
    ).closest("section")!
    fireEvent.click(
      within(section).getByRole("button", { name: "Use my location" })
    )
    expect(
      await within(section).findByText("Location is blocked. Showing Khartoum.")
    ).toBeTruthy()
    expect(
      within(section).queryByRole("combobox", { name: "Distance" })
    ).toBeNull()
  })

  it("starts on a saved position and says so when nothing is near", async () => {
    await renderShell(page({ geo: { lat: 3, lng: 3 } }))
    const section = (
      await screen.findByRole("heading", { name: "Near you" })
    ).closest("section")!
    expect(
      await within(section).findByText(
        "No listings within 25 km. Try a larger distance."
      )
    ).toBeTruthy()
    expect(
      within(section).getByRole("combobox", { name: "Distance" })
    ).toBeTruthy()
  })
})
