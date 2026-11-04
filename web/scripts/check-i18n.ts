// Fails when a key is missing in one language, a plural key lacks a form, a key is defined twice, or src/** or packages/shared uses a key that does not exist.
import { readdirSync, readFileSync } from "node:fs"
import process from "node:process"

const forms = {
  ar: ["zero", "one", "two", "few", "many", "other"],
  en: ["one", "other"],
} as const
const pluralSuffix = /_(zero|one|two|few|many|other)$/

// The A6 table: which file may hold each key prefix. Prefixes that sat in another file before this map existed (`status`, `toast`, `error`, `condition`, `fuel`, `transmission`, `reviews`, `admin`, `billing` keys in `error`) keep it.
const fileOf: Record<string, string[]> = {
  common: ["common"],
  nav: ["common"],
  footer: ["common"],
  pages: ["common"],
  table: ["common"],
  hours: ["common"],
  form: ["common"],
  color: ["common"],
  status: ["common", "status"],
  toast: ["common", "toast"],
  error: ["common", "error"],
  condition: ["common", "listing"],
  fuel: ["common", "listing"],
  transmission: ["common", "listing"],
  home: ["home"],
  search: ["search"],
  map: ["search"],
  listing: ["listing"],
  post: ["listing"],
  spec: ["listing"],
  feature: ["listing"],
  reviews: ["listing", "error"],
  directory: ["directory"],
  auth: ["auth"],
  ads: ["billing"],
  onboarding: ["onboarding"],
  dashboard: ["dashboard"],
  messages: ["dashboard"],
  notifications: ["dashboard"],
  settings: ["dashboard"],
  reviews_manager: ["dashboard"],
  verification: ["dashboard"],
  analytics: ["dashboard"],
  admin: ["admin", "error"],
  billing: ["billing", "error"],
  manager: ["manager"],
  promotion: ["billing"],
  validation: ["validation"],
}

let failed = 0
const fail = (msg: string) => {
  console.error(msg)
  failed++
}

// Every key of one language, with the file it came from, flagging keys defined in two files.
function load(lang: keyof typeof forms) {
  const keys = new Map<string, string>()
  for (const file of readdirSync(`src/messages/${lang}`)) {
    const json = JSON.parse(
      readFileSync(`src/messages/${lang}/${file}`, "utf8")
    ) as Record<string, string>
    for (const key of Object.keys(json)) {
      if (!/^[a-z_]+\.[a-z0-9_]+$/.test(key))
        fail(`${lang}/${file}: bad key "${key}"`)
      const allowed = fileOf[key.split(".")[0] ?? ""]
      if (!allowed)
        fail(`${lang}/${file}: "${key}" has a prefix that is not in the A6 map`)
      else if (!allowed.includes(file.replace(".json", "")))
        fail(`${lang}/${file}: "${key}" belongs in ${allowed.join(" or ")}`)
      if (keys.has(key))
        fail(`${lang}: "${key}" is in ${keys.get(key)} and ${file}`)
      keys.set(key, file)
    }
  }
  return keys
}

const loaded = { ar: load("ar"), en: load("en") }
const bases = {
  ar: new Map<string, Set<string>>(),
  en: new Map<string, Set<string>>(),
}
for (const lang of ["ar", "en"] as const) {
  for (const key of loaded[lang].keys()) {
    const m = pluralSuffix.exec(key)
    const base = m ? key.slice(0, m.index) : key
    bases[lang].set(
      base,
      (bases[lang].get(base) ?? new Set()).add(m?.[1] ?? "")
    )
  }
}

for (const [a, b] of [
  ["ar", "en"],
  ["en", "ar"],
] as const) {
  for (const base of bases[a].keys()) {
    if (!bases[b].has(base)) fail(`"${base}" exists in ${a} but not in ${b}`)
  }
}
for (const lang of ["ar", "en"] as const) {
  for (const [base, have] of bases[lang]) {
    if (!have.has("") || have.size > 1) {
      for (const f of forms[lang]) {
        if (!have.has(f)) fail(`${lang}: plural key "${base}" lacks _${f}`)
      }
    }
  }
}

// Key literals in source: t("a.b") calls plus any string that starts with a known group, such as Zod messages.
const groups = new Set([...bases.en.keys()].map((k) => k.split(".")[0]))
const tCall = /\bt\(\s*["'`]([a-z]+\.[a-z0-9_]+)["'`]/g
const literal = new RegExp(
  `["'\`]((?:${[...groups].join("|")})\\.[a-z0-9_]+)["'\`]`,
  "g"
)
const sourceFiles = [
  ...readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter(
      (f) => !f.startsWith("components/ui/") && !f.startsWith("messages/")
    )
    .map((f) => `src/${f}`),
  ...readdirSync("../packages/shared/src", {
    recursive: true,
    encoding: "utf8",
  }).map((f) => `../packages/shared/src/${f}`),
]
for (const file of sourceFiles) {
  if (!/\.tsx?$/.test(file)) continue
  const text = readFileSync(file, "utf8")
  const used = new Set(
    [tCall, literal].flatMap((re) =>
      [...text.matchAll(re)].map((m) => m[1] as string)
    )
  )
  for (const key of used) {
    for (const lang of ["ar", "en"] as const) {
      if (!bases[lang].has(key)) fail(`${file}: "${key}" is missing in ${lang}`)
    }
  }
}

if (failed) process.exit(1)
console.log(`i18n ok: ${bases.en.size} keys in ar and en`)
