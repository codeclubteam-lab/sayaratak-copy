// Reads the OKLCH tokens from src/styles.css, converts to sRGB and prints the WCAG ratio of every pair in A5; fails below 4.5 (text) or 3 (UI parts).
import { readFileSync } from "node:fs"
import process from "node:process"

const css = readFileSync("src/styles.css", "utf8")
type Rgb = [number, number, number]

const token = (name: string): Rgb => {
  const m = css.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`))
  if (!m) throw new Error(`token --${name} not found`)
  const [l = 0, c = 0, h = 0] = (m[1] ?? "").split(/\s+/).map(Number)
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  // Round-trip through 8-bit sRGB, as a browser paints it.
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v))
    const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
    return Math.round(g * 255) / 255
  }) as Rgb
}

const luminance = (rgb: Rgb) => {
  const [r = 0, g = 0, b = 0] = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: Rgb, b: Rgb) => {
  const x = luminance(a)
  const y = luminance(b)
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}
// Alpha-composite a color over an opaque surface in sRGB.
const composite = (color: Rgb, base: Rgb, alpha: number): Rgb =>
  color.map((v, i) => v * alpha + (base[i] ?? 0) * (1 - alpha)) as Rgb

const table: Record<string, Rgb> = Object.fromEntries(
  [
    "background",
    "card",
    "foreground",
    "muted",
    "muted-foreground",
    "input",
    "primary",
    "primary-foreground",
    "accent",
    "accent-foreground",
    "signal",
    "signal-foreground",
    "deep",
    "deep-foreground",
    "deep-accent",
    "success",
    "warning",
    "destructive",
    "ring",
  ].map((n) => [n, token(n)])
)
const t = (name: string): Rgb => {
  const v = table[name]
  if (!v) throw new Error(`token ${name} missing`)
  return v
}

// [label, foreground, background, minimum]
const pairs: Array<[string, Rgb, Rgb, number]> = [
  ["foreground on background", t("foreground"), t("background"), 4.5],
  ["foreground on card", t("foreground"), t("card"), 4.5],
  [
    "muted-foreground on background",
    t("muted-foreground"),
    t("background"),
    4.5,
  ],
  ["muted-foreground on card", t("muted-foreground"), t("card"), 4.5],
  ["muted-foreground on muted", t("muted-foreground"), t("muted"), 4.5],
  ["primary-foreground on primary", t("primary-foreground"), t("primary"), 4.5],
  [
    "primary-foreground on primary/90 over card",
    t("primary-foreground"),
    composite(t("primary"), t("card"), 0.9),
    4.5,
  ],
  [
    "primary-foreground on primary/90 over background",
    t("primary-foreground"),
    composite(t("primary"), t("background"), 0.9),
    4.5,
  ],
  ["primary on card", t("primary"), t("card"), 4.5],
  ["primary on background", t("primary"), t("background"), 4.5],
  ["accent-foreground on accent", t("accent-foreground"), t("accent"), 4.5],
  ["signal-foreground on signal", t("signal-foreground"), t("signal"), 4.5],
  ["deep-foreground on deep", t("deep-foreground"), t("deep"), 4.5],
  ["deep-accent on deep", t("deep-accent"), t("deep"), 4.5],
  [
    "primary-foreground on destructive",
    t("primary-foreground"),
    t("destructive"),
    4.5,
  ],
  ["destructive on card", t("destructive"), t("card"), 4.5],
  [
    "badge success on its tint",
    t("success"),
    composite(t("success"), t("card"), 0.12),
    4.5,
  ],
  [
    "badge warning on its tint",
    t("warning"),
    composite(t("warning"), t("card"), 0.12),
    4.5,
  ],
  [
    "badge destructive on its tint",
    t("destructive"),
    composite(t("destructive"), t("card"), 0.12),
    4.5,
  ],
  [
    "badge primary on its tint",
    t("primary"),
    composite(t("primary"), t("card"), 0.12),
    4.5,
  ],
  ["input border on card", t("input"), t("card"), 3],
  ["input border on background", t("input"), t("background"), 3],
  ["ring on card", t("ring"), t("card"), 3],
  ["ring on background", t("ring"), t("background"), 3],
]

let failed = 0
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg)
  const bad = r < min
  if (bad) failed++
  console.log(
    `${bad ? "FAIL" : "ok  "} ${r.toFixed(1).padStart(5)}  (min ${min})  ${label}`
  )
}
if (failed) process.exit(1)
