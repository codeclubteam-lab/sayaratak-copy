import { useState } from "react"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Plan } from "@sayaratak/shared/schemas/billing"
import { listingSchema, type Listing } from "@sayaratak/shared/schemas/listing"
import { AuthShell } from "@/components/app/auth-shell"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { DatePicker } from "@/components/app/date-picker"
import { FocusedTopBar } from "@/components/app/focused-top-bar"
import { LimitMeter } from "@/components/app/limit-meter"
import { ListingGrid } from "@/components/app/listing-grid"
import { ListingPickerDialog } from "@/components/app/listing-picker-dialog"
import { ListingPreview } from "@/components/app/listing-preview"
import { ListingRail } from "@/components/app/listing-rail"
import { LocationBlock } from "@/components/app/location-block"
import { PasswordHint } from "@/components/app/password-hint"
import { strongPassword } from "@/components/app/password-suggest"
import { passwordSchema } from "@sayaratak/shared/schemas/fields"
import { PhoneList, type PhoneRow } from "@/components/app/phone-list"
import { PlansGrid } from "@/components/app/plans-grid"
import { ProfilePreview } from "@/components/app/profile-preview"
import { PromotionOption } from "@/components/app/promotion-option"
import { StepHeader } from "@/components/app/step-header"
import { StickyFooter } from "@/components/app/sticky-footer"
import { UsageMeter } from "@/components/app/usage-meter"
import { db, resetDb } from "@/mocks/db"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

const listings = (n = 3): Listing[] =>
  db.listings
    .filter((l) => l.kind === "vehicle")
    .slice(0, n)
    .map((l) => listingSchema.parse(l))
const plan = (id: string, patch: Partial<Plan> = {}): Plan => ({
  id,
  audience: "dealership",
  name: { ar: `باقة ${id}`, en: `Plan ${id}` },
  price: 50000,
  durationDays: 30,
  listingLimit: 20,
  features: [{ ar: "ميزة", en: "Feature" }],
  featuredCredits: 0,
  enabled: true,
  sortOrder: 1,
  ...patch,
})

// Renders a second UI inside a fresh provider tree, since `rerender` would drop the providers.
const swap = async (ui: React.ReactNode) => {
  cleanup()
  return renderShell(ui)
}

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

describe("Breadcrumbs", () => {
  it("links all but the last item and writes BreadcrumbList JSON-LD", async () => {
    const { container } = await renderShell(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cars", href: "/vehicles/cars/sale" },
          { label: "Hilux" },
        ]}
      />
    )
    expect(
      screen.getByRole("link", { name: "Cars" }).getAttribute("href")
    ).toBe("/en/vehicles/cars/sale")
    expect(screen.getByText("Hilux").getAttribute("href")).toBeNull()
    expect(
      screen
        .getByText("Hilux")
        .closest("[aria-current]")
        ?.getAttribute("aria-current")
    ).toBe("page")
    const ld = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.textContent
    )
    expect(ld["@type"]).toBe("BreadcrumbList")
    expect(ld.itemListElement).toHaveLength(3)
    expect(ld.itemListElement[2].item).toBeUndefined()
  })
})

describe("listing lists", () => {
  it("rail shows the see-all link and one card per listing", async () => {
    await renderShell(
      <ListingRail title="Latest" href="/parts" listings={listings()} />
    )
    expect(screen.getByRole("heading", { name: "Latest" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "See all" }).getAttribute("href")
    ).toBe("/en/parts")
    expect(screen.getAllByRole("article")).toHaveLength(3)
  })

  it("grid follows the view prop", async () => {
    await renderShell(<ListingGrid listings={listings()} view="row" />)
    expect(screen.getByRole("list").className).toContain("grid-cols-1")
    await swap(<ListingGrid listings={listings()} view="grid" />)
  })
})

describe("LocationBlock", () => {
  it("shows the address and a map button only when there is a pin", async () => {
    await renderShell(
      <LocationBlock cityId="x" address="Street 1" location={null} />
    )
    expect(screen.getByText(/Street 1/)).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
    await swap(
      <LocationBlock
        cityId="x"
        address="Street 1"
        location={{ lat: 15.5, lng: 32.5 }}
      />
    )
    const button = screen.getByRole("button", { name: "View on map" })
    fireEvent.click(button)
    expect(
      screen
        .getByRole("button", { name: "Hide map" })
        .getAttribute("aria-expanded")
    ).toBe("true")
  })
})

describe("PhoneList", () => {
  function Harness() {
    const [rows, setRows] = useState<PhoneRow[]>([{ value: "" }])
    return <PhoneList value={rows} onChange={setRows} />
  }
  it("keeps one to three rows", async () => {
    await renderShell(<Harness />)
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull()
    const add = () => screen.getByRole("button", { name: "Add a phone number" })
    fireEvent.click(add())
    fireEvent.click(add())
    expect(screen.getAllByRole("textbox")).toHaveLength(3)
    expect(
      screen.queryByRole("button", { name: "Add a phone number" })
    ).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Remove phone number 2" })
    )
    // The page behind the dialog is hidden from role queries, and the row is still there.
    expect(screen.getAllByRole("textbox", { hidden: true })).toHaveLength(3)
    await confirmRemove("Remove phone number 2?")
    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2))
  })
})

describe("PlansGrid", () => {
  const plans = [plan("a"), plan("b", { listingLimit: undefined })]
  it("select mode is a radio group", async () => {
    const onChange = vi.fn()
    await renderShell(
      <PlansGrid
        mode="select"
        label="Plans"
        plans={plans}
        value="a"
        onChange={onChange}
      />
    )
    const group = screen.getByRole("radiogroup", { name: "Plans" })
    expect(within(group).getAllByRole("radio")).toHaveLength(2)
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: /Plan a/ }).checked
    ).toBe(true)
    fireEvent.click(screen.getByRole("radio", { name: /Plan b/ }))
    expect(onChange).toHaveBeenCalledWith("b")
    // Both cards carry the same rows, so they line up. A dealership's listing limit reads as vehicles.
    expect(screen.getAllByText("Vehicles")).toHaveLength(2)
    expect(screen.getByText("20")).toBeTruthy()
    expect(screen.getByText("No limit")).toBeTruthy()
  })

  it("action mode: no button on the current plan, upgrade above it, switch below", async () => {
    const onAction = vi.fn()
    const three = [
      plan("free", { price: 0 }),
      plan("mid", { price: 50000, featuredCredits: 3 }),
      plan("top", { price: 90000, featuredCredits: 10 }),
    ]
    await renderShell(
      <PlansGrid
        mode="action"
        plans={three}
        currentId="top"
        onAction={onAction}
      />
    )
    expect(screen.getByText("Your current plan")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Switch to Plan mid" }))
    expect(onAction).toHaveBeenCalledWith("mid")
    expect(screen.getByText("3 a month")).toBeTruthy()
    expect(screen.getAllByLabelText("Not included")).toHaveLength(1)
    expect(
      screen.getByText(
        "Your account returns to this plan when a paid plan ends."
      )
    ).toBeTruthy()
  })

  it("marks the first paid plan recommended and blocks a second payment", async () => {
    const onAction = vi.fn()
    await renderShell(
      <PlansGrid
        mode="action"
        plans={[
          plan("free", { price: 0 }),
          plan("mid"),
          plan("top", { price: 90000 }),
        ]}
        currentId="free"
        pendingIds={["top"]}
        onAction={onAction}
      />
    )
    expect(screen.getByText("Recommended")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Plan mid" }))
    expect(onAction).toHaveBeenCalledWith("mid")
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Payment under review",
      }).disabled
    ).toBe(true)
  })

  it("renders Arabic names", async () => {
    await renderShell(
      <PlansGrid mode="action" plans={plans} onAction={() => {}} />,
      { locale: "ar" }
    )
    expect(screen.getByText("باقة a")).toBeTruthy()
  })
})

describe("meters", () => {
  it("UsageMeter shows used of limit and the bar value", async () => {
    await renderShell(<UsageMeter label="Listings" used={12} limit={20} />)
    expect(screen.getByText("12 of 20")).toBeTruthy()
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("12")
  })

  it("UsageMeter without a limit has no bar", async () => {
    await renderShell(<UsageMeter label="Listings" used={4} limit={null} />)
    expect(screen.queryByRole("meter")).toBeNull()
    expect(screen.getByText("4 used, no limit")).toBeTruthy()
  })

  it("LimitMeter warns and shows the action at the cap", async () => {
    await renderShell(
      <LimitMeter
        label="L"
        used={5}
        limit={20}
        action={<a href="/x">Upgrade</a>}
      />
    )
    expect(screen.queryByRole("status")).toBeNull()
    await swap(
      <LimitMeter
        label="L"
        used={20}
        limit={20}
        action={<a href="/x">Upgrade</a>}
      />
    )
    expect(screen.getByRole("status")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Upgrade" })).toBeTruthy()
  })
})

describe("PromotionOption", () => {
  it("is a radio with the paid badge, effect, duration and price", async () => {
    const onSelect = vi.fn()
    await renderShell(
      <PromotionOption
        name="p"
        value="featured-7"
        type="featured"
        durationDays={7}
        price={15000}
        selected={false}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByRole("radio"))
    expect(onSelect).toHaveBeenCalled()
    expect(
      screen.getByText("Featured", { selector: "span.bg-signal" })
    ).toBeTruthy()
    expect(screen.getByText("7 days")).toBeTruthy()
    expect(screen.getByText(/15,000/)).toBeTruthy()
  })
  it("a bump shows One time and no paid badge", async () => {
    await renderShell(
      <PromotionOption
        name="p"
        value="bump"
        type="bump"
        durationDays={0}
        price={5000}
        selected={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText("One time")).toBeTruthy()
    expect(document.querySelector("span.bg-signal")).toBeNull()
  })
})

describe("PasswordHint", () => {
  it("marks each rule as it is met", async () => {
    await renderShell(<PasswordHint value="" />)
    const rule = (name: string) => screen.getByText(name).closest("li")!
    expect(rule("A digit").textContent).toContain("not met")
    await swap(<PasswordHint value="abcdefg1" />)
    expect(rule("At least 8 characters").textContent).not.toContain("not met")
    expect(rule("A digit").textContent).not.toContain("not met")
    expect(
      screen.getByRole("list").parentElement!.getAttribute("aria-live")
    ).toBe("polite")
    expect(screen.getByText("Good")).toBeTruthy()
    await swap(<PasswordHint value="abcdefghijk1" />)
    expect(screen.getByText("Strong")).toBeTruthy()
  })

  it("suggests a 16 character password that passes the rules", () => {
    for (let i = 0; i < 20; i++) {
      const pw = strongPassword()
      expect(pw).toHaveLength(16)
      expect(passwordSchema.safeParse(pw).success).toBe(true)
    }
  })
})

describe("DatePicker", () => {
  it("opens a calendar that starts the week on Saturday and returns a Date", async () => {
    const onChange = vi.fn()
    await renderShell(<DatePicker onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: /Choose a date/ }))
    const headers = await screen.findAllByText(/^(Sa|Su|Mo|Tu|We|Th|Fr)$/)
    expect(headers[0]!.textContent).toMatch(/Sa/)
    fireEvent.click(screen.getAllByRole("button", { name: /^(\w+day), / })[10]!)
    expect(onChange.mock.calls[0]![0]).toBeInstanceOf(Date)
  })
})

describe("ListingPickerDialog", () => {
  it("lists the seller's approved listings and returns one id", async () => {
    const onSelect = vi.fn()
    await renderShell(
      <ListingPickerDialog
        open
        onOpenChange={() => {}}
        onSelect={onSelect}
        title="Pick"
      />,
      { role: "dealership" }
    )
    const rows = await screen.findAllByRole("button", { name: /SDG|\d/ })
    expect(rows.length).toBeGreaterThan(0)
    fireEvent.click(rows[0]!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(typeof onSelect.mock.calls[0]![0]).toBe("string")
  })

  it("shows an error when the list cannot load", async () => {
    await renderShell(
      <ListingPickerDialog
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
        title="Pick"
      />
    )
    expect(await screen.findByText(/Could not load your listings/)).toBeTruthy()
  })
})

describe("ProfilePreview", () => {
  it("shows the typed name, or a placeholder when empty", async () => {
    await renderShell(<ProfilePreview variant="workshop" name="" />)
    expect(screen.getByText("Your name")).toBeTruthy()
    expect(screen.getByText("No reviews yet")).toBeTruthy()
    await swap(<ProfilePreview variant="mechanic" name="Ahmed" />)
    expect(screen.getByText("Ahmed")).toBeTruthy()
    expect(screen.getByText("Mechanic")).toBeTruthy()
  })
})

describe("ListingPreview", () => {
  it("has no heart and no link, in full and compact form", async () => {
    const l = listings(1)[0]!
    await renderShell(<ListingPreview listing={l} />)
    expect(screen.getByText(l.title)).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
    await swap(<ListingPreview listing={l} compact />)
    expect(screen.getByText(l.title)).toBeTruthy()
    expect(screen.queryByRole("article")).toBeNull()
  })
})

describe("focused flow pieces", () => {
  it("StepHeader takes focus when the step changes, not on mount", async () => {
    function Harness() {
      const [step, setStep] = useState(1)
      return (
        <>
          <StepHeader title={`Step ${step}`} step={step} />
          <button onClick={() => setStep(2)}>next</button>
        </>
      )
    }
    await renderShell(<Harness />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(document.activeElement).not.toBe(h1)
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 })
    )
  })

  it("TopBar runs its action and has no nav links", async () => {
    const onClick = vi.fn()
    await renderShell(
      <FocusedTopBar action={{ label: "Save and exit", onClick }} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Save and exit" }))
    expect(onClick).toHaveBeenCalled()
    expect(screen.queryByRole("navigation")).toBeNull()
  })

  it("StickyFooter shows Back only with a handler", async () => {
    const onBack = vi.fn()
    await renderShell(
      <StickyFooter skip={<button>Skip</button>}>
        <button>Next</button>
      </StickyFooter>
    )
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull()
    await swap(
      <StickyFooter onBack={onBack}>
        <button>Next</button>
      </StickyFooter>
    )
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(onBack).toHaveBeenCalled()
  })

  it("AuthShell has the form, the carousel and a language switch", async () => {
    await renderShell(
      <AuthShell>
        <button>Go</button>
      </AuthShell>
    )
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy()
    expect(screen.getByText("See what is working")).toBeTruthy()
    // Four slides, the second picked by its dot.
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 2" }))
    expect(
      screen
        .getByText("A plan that grows with you")
        .closest("[aria-hidden]")
        ?.getAttribute("aria-hidden")
    ).toBe("false")
    expect(screen.getByRole("button", { name: /Pause/ })).toBeTruthy()
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "العربية" })).toBeTruthy()
    )
  })
})
