// Screenshots of every route in both languages (review pack, 14.11) plus the design checks that need a rendered page (14.2):
// a card inside a card, more than one primary button, a shadow or border outside the places A5 allows, banned type.
// Needs the production server on port 3100 (`bun run build && PORT=3100 bun run start`).
// Usage: bun run shots [--widths 390,768,1280] [--out docs/screens] [--only /admin]
import { mkdirSync } from "node:fs"
import process from "node:process"
import { parseArgs } from "node:util"
import { chromium } from "@playwright/test"

import { roleCookies } from "../e2e/auth"
import { routesFor } from "../e2e/routes"
import type { Role } from "../e2e/routes"

const { values } = parseArgs({
  options: {
    widths: { type: "string", default: "390,1280" },
    out: { type: "string", default: "docs/screens" },
    only: { type: "string", default: "" },
    locales: { type: "string", default: "ar,en" },
  },
})
const base = "http://localhost:3100"
const widths = values.widths.split(",").map(Number)
// Rendered findings that A5 or a logged deviation allows (the same cases as scripts/audit-design-allow.ts), matched against "<path>: <issue>".
const allowed = [
  /: border .*span "\+249"/, // dial code box of the phone field, a form control
  /^\/(?:ar|en): shadow: div/, // home search card floats over the banner (Deviations: 6.1 hero)
  /^\/(?:ar|en)\/auth.*: shadow: img/, // hairline ring on the auth panel screenshot (Deviations: Auth panel carousel)
]

const roles: Array<Role> = [
  "anon",
  "user",
  "dealer",
  "workshop",
  "mechanic",
  "admin",
]

// Runs in the page. Floating layers, form controls and the components/ui primitives are where A5 allows shadows and borders.
const inspect = () => {
  const probe = (prop: string) => {
    const el = document.createElement("div")
    el.style.color = `var(${prop})`
    document.body.append(el)
    const value = getComputedStyle(el).color
    el.remove()
    return value
  }
  const card = probe("--card")
  const primary = probe("--primary")
  const floating =
    "[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[data-slot$=content],[data-sonner-toaster],.leaflet-container,.shadow-floating"
  const control =
    "a,input,textarea,select,button,[role=combobox],[role=switch],[role=checkbox],[role=radio],[data-slot=input-group],[data-slot^=input-otp]"
  const issues = new Set<string>()
  const name = (el: Element) => {
    const text = el.textContent.trim().replace(/\s+/g, " ").slice(0, 40)
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${text}"`
  }
  const visible = [...document.body.querySelectorAll("*")].filter(
    (el) => el.checkVisibility() && !el.closest(floating)
  )
  const primaries: Array<string> = []
  for (const el of visible) {
    const s = getComputedStyle(el)
    // A card is a white block with the card radius; badges and chips (full radius) and small tiles are not.
    const cardLike = (e: Element, st: CSSStyleDeclaration) =>
      st.backgroundColor === card &&
      parseFloat(st.borderRadius) >= 12 &&
      parseFloat(st.borderRadius) < 100 &&
      e.getBoundingClientRect().width >= 120 &&
      e.getBoundingClientRect().height >= 60
    const isCard = cardLike(el, s)
    if (isCard && el.parentElement) {
      let up: Element | null = el.parentElement
      while (up && up !== document.body) {
        if (cardLike(up, getComputedStyle(up))) {
          issues.add(`card in card: ${name(el)}`)
          break
        }
        up = up.parentElement
      }
    }
    // Pressed toggles and selected chips also take the primary fill (Deviations "Pressed toggles"); they are not actions.
    if (
      el.matches("button,a") &&
      el.closest("main") &&
      !el.matches(
        "[aria-pressed],[aria-selected],[aria-current],[role=radio],[role=tab]"
      ) &&
      s.backgroundColor === primary
    )
      primaries.push(name(el))
    if (
      s.boxShadow !== "none" &&
      !el.closest(control) &&
      !s.boxShadow.includes("inset")
    )
      issues.add(`shadow: ${name(el)}`)
    const sides = ["Top", "Right", "Bottom", "Left"] as const
    const drawn = sides.filter(
      (side) =>
        parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) >
          0 &&
        s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" &&
        !s
          .getPropertyValue(`border-${side.toLowerCase()}-color`)
          .endsWith(", 0)") &&
        s.getPropertyValue(`border-${side.toLowerCase()}-color`) !==
          "rgba(0, 0, 0, 0)"
    )
    // Row dividers and sticky lines are single top or bottom lines; anything else must be a form control.
    const lineOnly =
      drawn.every((d) => d === "Top" || d === "Bottom") && drawn.length === 1
    if (
      drawn.length &&
      !lineOnly &&
      !el.matches(control) &&
      !el.closest(control)
    )
      issues.add(`border ${drawn.join("+")}: ${name(el)}`)
    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
    )
    if (hasText) {
      if (s.textTransform === "uppercase") issues.add(`uppercase: ${name(el)}`)
      if (s.fontStyle === "italic") issues.add(`italic: ${name(el)}`)
      if (s.letterSpacing !== "normal" && parseFloat(s.letterSpacing) !== 0)
        issues.add(`letter-spacing ${s.letterSpacing}: ${name(el)}`)
      if (!["400", "500", "600"].includes(s.fontWeight))
        issues.add(`weight ${s.fontWeight}: ${name(el)}`)
    }
  }
  if (primaries.length > 1)
    issues.add(`primary buttons: ${primaries.join(", ")}`)
  return [...issues]
}

const browser = await chromium.launch({ channel: "chrome" })
let failed = 0
for (const role of roles) {
  const context = await browser.newContext()
  if (role !== "anon") await context.addCookies(await roleCookies(role, base))
  const page = await context.newPage()
  for (const route of routesFor(role)) {
    // Public pages once (as anon); each role adds only its own dashboard.
    if (
      role !== "anon" &&
      !/^\/(?:account|dealer|workshop|mechanic|admin|post|onboarding)(?:[/?]|$)/.test(
        route
      )
    )
      continue
    if (values.only && !route.startsWith(values.only)) continue
    for (const locale of values.locales.split(","))
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`${base}/${locale}${route}`, {
          waitUntil: "networkidle",
        })
        const file = `${route || "/home"}`
          .replace(/[/?=:&]+/g, "-")
          .replace(/^-|-$/g, "")
        const dir = `${values.out}/${width}`
        mkdirSync(dir, { recursive: true })
        await page.screenshot({
          path: `${dir}/${locale}-${file}.png`,
          fullPage: true,
        })
        // Type, cards and buttons do not change with width; check once per language.
        if (width !== widths[widths.length - 1]) continue
        for (const issue of await page.evaluate(inspect)) {
          const line = `/${locale}${route}: ${issue}`
          if (allowed.some((a) => a.test(line))) continue
          console.error(line)
          failed++
        }
      }
  }
  await context.close()
}
await browser.close()
if (failed) process.exit(1)
