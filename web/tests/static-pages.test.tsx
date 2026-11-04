import { Suspense } from "react"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { bodySummary, parseBody } from "@/features/pages/body"
import { ContactDetails } from "@/features/pages/components/contact-details"
import { ContactForm } from "@/features/pages/components/contact-form"
import { SitePageView } from "@/features/pages/components/site-page-view"
import { pageHead } from "@/features/pages/loader"
import { contactFormSchema } from "@/features/pages/schemas"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => resetDb())

describe("parseBody", () => {
  it("blank lines split paragraphs, # is a heading, - is a list", () => {
    expect(parseBody("One\nstill one\n\n# Head\n- a\n- b\n\nTwo\n- c")).toEqual(
      [
        { type: "p", text: "One still one" },
        { type: "h", text: "Head" },
        { type: "ul", items: ["a", "b"] },
        { type: "p", text: "Two" },
        { type: "ul", items: ["c"] },
      ]
    )
  })
  it("no HTML: tags stay text", () => {
    expect(parseBody("<b>x</b>")).toEqual([{ type: "p", text: "<b>x</b>" }])
  })
  it("empty body, and a summary from the first paragraph only", () => {
    expect(parseBody("  \n\n")).toEqual([])
    expect(bodySummary("# H\nfirst\n\nsecond")).toBe("first")
  })
})

describe("contactFormSchema", () => {
  const ok = {
    name: "Omar",
    contact: "0912345601",
    subject: "general",
    message: "Hello, I need help.",
  }
  it("takes a phone or an email, and the four subjects", () => {
    expect(contactFormSchema.safeParse(ok).success).toBe(true)
    expect(
      contactFormSchema.safeParse({
        ...ok,
        contact: "a@b.co",
        subject: "business",
      }).success
    ).toBe(true)
  })
  it("errors are keys", () => {
    const issue = (patch: object) =>
      contactFormSchema.safeParse({ ...ok, ...patch }).error?.issues[0]?.message
    expect(issue({ name: "O" })).toBe("validation.name_min")
    expect(issue({ contact: "" })).toBe("validation.required")
    expect(issue({ contact: "nope" })).toBe("validation.identifier")
    expect(issue({ message: "short" })).toBe("validation.message_min")
    expect(issue({ message: "x".repeat(1001) })).toBe("validation.too_long")
    expect(issue({ subject: "other" })).toBeTruthy()
  })
})

describe("pageHead", () => {
  it("is indexable with canonical and both languages", () => {
    const head = pageHead({
      locale: "en",
      slug: "about",
      title: "About us",
      description: "d",
    }) as { meta: object[]; links: { rel: string; href: string }[] }
    expect(head.meta).toContainEqual({ title: "About us | Sayaratak" })
    expect(head.meta.some((m) => "name" in m && m.name === "robots")).toBe(
      false
    )
    expect(head.links.find((l) => l.rel === "canonical")?.href).toMatch(
      /\/en\/about$/
    )
    expect(head.links.filter((l) => l.rel === "alternate")).toHaveLength(3)
  })
})

describe("SitePageView", () => {
  it("one h1 with the page title, headings from # lines are h2, lists are lists", async () => {
    await renderShell(
      <Suspense fallback={null}>
        <SitePageView slug="privacy" />
      </Suspense>
    )
    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy policy" })
    ).toBeTruthy()
    expect(
      screen.getByRole("heading", { level: 2, name: "Your rights" })
    ).toBeTruthy()
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2)
  })
  it("reads the Arabic title and body in the Arabic locale", async () => {
    await renderShell(
      <Suspense fallback={null}>
        <SitePageView slug="terms" />
      </Suspense>,
      { locale: "ar" }
    )
    expect(
      await screen.findByRole("heading", { level: 1, name: "الشروط والأحكام" })
    ).toBeTruthy()
  })
})

describe("ContactForm", () => {
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), {
      target: { value },
    })
  it("shows a key-translated error per bad field and stores nothing", async () => {
    await renderShell(<ContactForm />)
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))
    expect(await screen.findByText("This field is required")).toBeTruthy()
    expect(screen.getByText("Enter at least 2 characters")).toBeTruthy()
    expect(screen.getByText("Write a longer message")).toBeTruthy()
    expect(db.contacts).toHaveLength(0)
  })
  it("sends, stores the message with a normalized phone, then offers Send another", async () => {
    await renderShell(<ContactForm />)
    fill("Your name", "Omar")
    fill("Phone or email", "0912345601")
    fill("Message", "My listing is not showing.")
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))
    expect(await screen.findByText("Message sent")).toBeTruthy()
    expect(db.contacts).toHaveLength(1)
    expect(db.contacts[0]).toMatchObject({
      name: "Omar",
      contact: "+249912345601",
      subject: "general",
      message: "My listing is not showing.",
    })
    fireEvent.click(screen.getByRole("button", { name: "Send another" }))
    expect(
      await screen.findByRole("button", { name: "Send message" })
    ).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>(/^Your name/).value).toBe("")
  })
})

describe("ContactDetails", () => {
  it("phone, WhatsApp and email are links, the address is text", async () => {
    await renderShell(<ContactDetails />)
    const c = db.settings.contact
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: c.phone }).getAttribute("href")
      ).toBe(`tel:${c.phone}`)
    )
    expect(
      screen.getByRole("link", { name: c.email }).getAttribute("href")
    ).toBe(`mailto:${c.email}`)
    expect(
      screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")
    ).toMatch(/^https:\/\/wa\.me\//)
    expect(screen.getByText(c.address)).toBeTruthy()
  })
})
