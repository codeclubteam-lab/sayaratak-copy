import { useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"
import { CheckboxGroup } from "@/components/app/checkbox-group"
import { ChipMultiSelect } from "@/components/app/chip-multi-select"
import { ChipSingleSelect } from "@/components/app/chip-single-select"
import {
  CityDistrictFields,
  type CityDistrictValue,
} from "@/components/app/city-district-fields"
import { FieldError } from "@/components/app/field-error"
import { FormField } from "@/components/app/form-field"
import { MapCanvas } from "@/components/app/map-canvas"
import {
  MakeModelFields,
  type MakeModelValue,
} from "@/components/app/make-model-fields"
import { NumberField } from "@/components/app/number-field"
import { PasswordInput } from "@/components/app/password-input"
import { PhoneInput } from "@/components/app/phone-input"
import { PriceFields, type PriceValue } from "@/components/app/price-fields"
import { StepIndicator } from "@/components/app/step-indicator"
import { SubmitButton } from "@/components/app/submit-button"
import { WeeklyHoursEditor } from "@/components/app/weekly-hours-editor"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

vi.mock("@/components/app/map-canvas-impl", () => ({
  MapCanvasImpl: ({ label }: { label: string }) => (
    <div data-testid="map">{label}</div>
  ),
}))

beforeEach(() => resetDb())

function Num(props: Partial<React.ComponentProps<typeof NumberField>>) {
  const [v, setV] = useState<number | null>(null)
  return (
    <>
      <NumberField aria-label="n" {...props} value={v} onChange={setV} />
      <output>{String(v)}</output>
    </>
  )
}
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } })

describe("NumberField", () => {
  it("stores null when empty and converts Arabic digits", async () => {
    await renderShell(<Num />)
    const input = screen.getByLabelText("n")
    type(input, "٣٥")
    expect(document.querySelector("output")?.textContent).toBe("35")
    type(input, "")
    expect(document.querySelector("output")?.textContent).toBe("null")
    type(input, "12ab")
    expect(document.querySelector("output")?.textContent).toBe("12")
  })

  it("adds thousands separators while typing", async () => {
    await renderShell(<Num grouping />)
    const input = screen.getByLabelText("n")
    type(input, "1234567")
    expect((input as HTMLInputElement).value).toBe("1,234,567")
    type(input, "1,234,5678")
    expect(document.querySelector("output")?.textContent).toBe("12345678")
  })

  it("steps with the arrow keys inside min and max", async () => {
    await renderShell(<Num min={0} max={1000} step={500} />)
    const input = screen.getByLabelText("n")
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "ArrowUp" })
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(document.querySelector("output")?.textContent).toBe("1000")
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(document.querySelector("output")?.textContent).toBe("0")
  })

  it("accepts a decimal step", async () => {
    await renderShell(<Num step={0.5} />)
    type(screen.getByLabelText("n"), "2.5")
    expect(document.querySelector("output")?.textContent).toBe("2.5")
  })
})

describe("PhoneInput and PasswordInput", () => {
  it("converts digits as you type and normalizes on blur", async () => {
    function Harness() {
      const [v, setV] = useState("")
      return (
        <>
          <PhoneInput aria-label="phone" value={v} onChange={setV} />
          <output>{v}</output>
        </>
      )
    }
    await renderShell(<Harness />)
    const input = screen.getByLabelText("phone")
    expect(input.closest("div")?.getAttribute("dir")).toBe("ltr")
    type(input, "٠٩١٢٣٤٥٦٧٨")
    expect(document.querySelector("output")?.textContent).toBe("0912345678")
    fireEvent.blur(input)
    expect(document.querySelector("output")?.textContent).toBe("+249912345678")
    expect((input as HTMLInputElement).value).toBe("912345678")
  })

  it("shows and hides the password", async () => {
    await renderShell(<PasswordInput aria-label="pw" defaultValue="secret12" />)
    const input = screen.getByLabelText("pw")
    expect(input.getAttribute("type")).toBe("password")
    fireEvent.click(screen.getByRole("button", { name: "Show password" }))
    expect(input.getAttribute("type")).toBe("text")
    expect(
      screen
        .getByRole("button", { name: "Hide password" })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })
})

describe("FieldError and FormField", () => {
  it("translates the key and links label, control and error", async () => {
    await renderShell(
      <FormField label="Name" error="validation.required">
        {(c) => <input {...c} />}
      </FormField>
    )
    const input = screen.getByLabelText("Name")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toBe("This field is required")
    expect(input.getAttribute("aria-describedby")).toBe(alert.id)
  })

  it("renders nothing without a message, and Arabic when asked", async () => {
    const { container, unmount } = await renderShell(<FieldError />)
    expect(container.querySelector("[role=alert]")).toBeNull()
    unmount()
    await renderShell(<FieldError message="validation.required" />, {
      locale: "ar",
    })
    expect(screen.getByRole("alert").textContent).toBe("هذا الحقل مطلوب")
  })
})

describe("dependent selects", () => {
  it("clears the district when the city changes", async () => {
    function Harness() {
      const [v, setV] = useState<CityDistrictValue>({
        cityId: "",
        districtId: null,
      })
      return (
        <>
          <CityDistrictFields value={v} onChange={setV} />
          <output>{JSON.stringify(v)}</output>
        </>
      )
    }
    await renderShell(<Harness />)
    const [city, district] = screen.getAllByRole("combobox")
    expect(district!.hasAttribute("disabled")).toBe(true)
    await pick(city!, "Khartoum")
    await waitFor(() => expect(district!.hasAttribute("disabled")).toBe(false))
    const d = db.taxonomy.districts.find((x) => x.cityId === "khartoum")!
    await pick(district!, d.name.en)
    expect(document.querySelector("output")?.textContent).toContain(d.id)
    await pick(city!, "Omdurman")
    expect(
      JSON.parse(document.querySelector("output")?.textContent ?? "{}")
    ).toEqual({ cityId: "omdurman", districtId: null })
  })

  it("keeps ids and free text apart for make and model", async () => {
    function Harness() {
      const [v, setV] = useState<MakeModelValue>({
        makeId: null,
        modelId: null,
        makeOther: null,
        modelOther: null,
      })
      return (
        <>
          <MakeModelFields value={v} onChange={setV} />
          <output>{JSON.stringify(v)}</output>
        </>
      )
    }
    await renderShell(<Harness />)
    const out = () =>
      JSON.parse(document.querySelector("output")?.textContent ?? "{}")
    const make = screen.getByRole("combobox")
    await pick(make, "Other")
    expect(out()).toEqual({
      makeId: null,
      modelId: null,
      makeOther: "",
      modelOther: "",
    })
    fireEvent.change(screen.getByLabelText("Type the make"), {
      target: { value: "Geely" },
    })
    fireEvent.change(screen.getByLabelText("Type the model"), {
      target: { value: "Coolray" },
    })
    expect(out()).toMatchObject({ makeOther: "Geely", modelOther: "Coolray" })
    await pick(make, "Toyota")
    expect(out()).toEqual({
      makeId: "toyota",
      modelId: null,
      makeOther: null,
      modelOther: null,
    })
    await pick(screen.getAllByRole("combobox")[1]!, "Other")
    expect(out()).toMatchObject({ modelId: null, modelOther: "" })
    expect(screen.getByLabelText("Type the model")).toBeTruthy()
  })
})

describe("price, chips and checkboxes", () => {
  it("formats the price while typing and toggles negotiable", async () => {
    function Harness() {
      const [v, setV] = useState<PriceValue>({ price: null, negotiable: false })
      return (
        <>
          <PriceFields value={v} onChange={setV} />
          <output>{JSON.stringify(v)}</output>
        </>
      )
    }
    await renderShell(<Harness />)
    const input = screen.getByLabelText("Price")
    type(input, "١٢٣٤٥")
    expect((input as HTMLInputElement).value).toBe("12,345")
    fireEvent.click(screen.getByRole("checkbox", { name: "Negotiable" }))
    expect(document.querySelector("output")?.textContent).toBe(
      '{"price":12345,"negotiable":true}'
    )
  })

  it("single chips behave as radios, multi chips honor max", async () => {
    const opts = ["a", "b", "c"].map((v) => ({ value: v, label: v }))
    function Harness() {
      const [one, setOne] = useState<string | null>(null)
      const [many, setMany] = useState<string[]>([])
      return (
        <>
          <ChipSingleSelect
            legend="One"
            options={opts}
            value={one}
            onChange={setOne}
          />
          <ChipMultiSelect
            legend="Many"
            options={opts}
            value={many}
            onChange={setMany}
            max={2}
            error="validation.select_min"
          />
          <output>{`${one}|${many.join()}`}</output>
        </>
      )
    }
    await renderShell(<Harness />)
    const [one, many] = screen.getAllByRole("group")
    fireEvent.click(within(one!).getByLabelText("b"))
    fireEvent.click(within(one!).getByLabelText("c"))
    expect(within(one!).getByLabelText("c")).toHaveProperty("checked", true)
    expect(within(one!).getAllByRole("radio")).toHaveLength(3)
    for (const l of ["a", "b", "c"])
      fireEvent.click(within(many!).getByLabelText(l))
    expect(document.querySelector("output")?.textContent).toBe("c|a,b")
    expect(within(many!).getByRole("alert").textContent).toBe(
      "Choose at least one option"
    )
  })

  it("checkbox group reports changes and its error", async () => {
    const onChange = vi.fn()
    await renderShell(
      <CheckboxGroup
        legend="Contact"
        options={[{ value: "call", label: "Call" }]}
        value={[]}
        onChange={onChange}
        error="validation.contact_required"
      />
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "Call" }))
    expect(onChange).toHaveBeenCalledWith(["call"])
    expect(screen.getByRole("alert").textContent).toBe(
      "Add a phone number or an email"
    )
  })
})

describe("hours, steps and submit", () => {
  const start: WeeklyHours = Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: false,
    open: "08:00",
    close: "17:00",
  }))
  function Hours() {
    const [v, setV] = useState(start)
    return <WeeklyHoursEditor value={v} onChange={setV} />
  }
  const closed = (day: string) =>
    within(screen.getByRole("group", { name: day })).getByRole("checkbox")

  it("starts the week on Saturday and applies presets", async () => {
    await renderShell(<Hours />)
    const days = screen
      .getAllByRole("group")
      .filter((g) => g.getAttribute("aria-label"))
    expect(days.map((g) => g.getAttribute("aria-label"))[0]).toBe("Saturday")
    fireEvent.click(
      screen.getByRole("button", { name: "Sat to Thu, 8:00 to 17:00" })
    )
    expect(closed("Friday").getAttribute("aria-checked")).toBe("true")
    expect(closed("Saturday").getAttribute("aria-checked")).toBe("false")
  })

  it("disables times for a closed day and copies one day to all", async () => {
    await renderShell(<Hours />)
    fireEvent.click(closed("Monday"))
    const mon = screen.getByRole("group", { name: "Monday" })
    expect(within(mon).getByLabelText("Opens, Monday")).toHaveProperty(
      "disabled",
      true
    )
    type(screen.getByLabelText("Opens, Saturday"), "09:30")
    fireEvent.click(
      screen.getByRole("button", { name: "Copy to all days, Saturday" })
    )
    expect(screen.getByLabelText("Opens, Wednesday")).toHaveProperty(
      "value",
      "09:30"
    )
    expect(closed("Monday").getAttribute("aria-checked")).toBe("false")
  })

  it("flags a row that opens after it closes", async () => {
    await renderShell(<Hours />)
    type(screen.getByLabelText("Closes, Sunday"), "07:00")
    expect(
      screen.getByLabelText("Closes, Sunday").getAttribute("aria-invalid")
    ).toBe("true")
  })

  it("shows the step and a busy submit button", async () => {
    await renderShell(
      <>
        <StepIndicator current={2} total={5} />
        <SubmitButton pending>Save</SubmitButton>
      </>
    )
    expect(screen.getByText("Step 2 of 5")).toBeTruthy()
    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toHaveProperty("disabled", true)
    expect(button.getAttribute("aria-busy")).toBe("true")
  })
})

describe("MapCanvas", () => {
  const props = { center: { lat: 15.5, lng: 32.5 }, label: "Map" }

  it("loads the map straight away by default", async () => {
    await renderShell(<MapCanvas {...props} />)
    expect(await screen.findByTestId("map")).toBeTruthy()
  })

  it("waits for a tap with data saver on", async () => {
    await renderShell(<MapCanvas {...props} />, {
      prefs: { dataSaver: true, listingView: "grid" },
    })
    expect(screen.queryByTestId("map")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Load map" }))
    expect(await screen.findByTestId("map")).toBeTruthy()
  })
})
