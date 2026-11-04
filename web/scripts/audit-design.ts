// Design audit (14.2): fails on class names and literals that break A5 and A5b in src/** outside components/ui.
// Cards nested in cards and more than one primary button are checked on the rendered pages (scripts/audit-screens.ts).
import { readFileSync, readdirSync } from "node:fs"
import process from "node:process"
import { allowed } from "./audit-design-allow"
import { physical } from "./patterns"

type Rule = { name: string; test: (u: string, raw: string) => boolean }

const sizes = "(?:none|sm|md|lg|xl|[2-4]xl|full|\\[[^\\]]+\\])"
const corners = "(?:t|b|s|e|l|r|ss|se|es|ee|tl|tr|bl|br)"
const palette =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)"

const rules: Rule[] = [
  {
    name: "border",
    // Width utilities only; colors alone draw nothing. border-b, border-t and divide-y (row dividers) are the allowed lines.
    test: (u) =>
      /^border(?:-(?:x|y|s|e|l|r))?(?:-(?:[1-9]\d*|\[[^\]]+\]))?$/.test(u) ||
      /^border-(?:t|b)-(?:[1-9]\d*|\[[^\]]+\])$/.test(u),
  },
  {
    name: "shadow",
    test: (u) => /^shadow(?:-|$)/.test(u) && u !== "shadow-none",
  },
  {
    name: "gradient, blur, glass",
    test: (u) => /gradient|^backdrop-blur|^blur(?:-|$)/.test(u),
  },
  {
    name: "motion",
    test: (u, raw) =>
      (/^animate-/.test(u) && !/^animate-(?:spin|heart-pop|none)$/.test(u)) ||
      u === "transition-all" ||
      /^transition-\[(?:height|width|[^\]]*(?:height|width))/.test(u) ||
      /^(?:duration|delay)-(?:\d|\[\d)/.test(u) ||
      /^will-change/.test(u) ||
      (/hover:/.test(raw) && /^-?(?:translate|scale)/.test(u)),
  },
  {
    name: "tokens",
    test: (u) =>
      new RegExp(
        `^(?:bg|text|border|ring|fill|stroke|outline|divide|from|via|to|decoration|caret|accent)-${palette}(?:-\\d+)?(?:/\\d+)?$`
      ).test(u),
  },
  {
    name: "radius",
    test: (u) =>
      new RegExp(`^rounded(?:-${corners})?(?:-${sizes})?$`).test(u) &&
      !new RegExp(
        `^rounded(?:-${corners})?-(?:lg|xl|full|none|\\[inherit\\])$`
      ).test(u),
  },
  {
    name: "type",
    test: (u) =>
      /^(?:uppercase|capitalize|italic)$/.test(u) ||
      (/^tracking-/.test(u) && u !== "tracking-normal") ||
      /^font-(?:thin|extralight|light|bold|extrabold|black)$/.test(u) ||
      /^text-(?:xs|sm|base|lg|xl|[2-9]xl)$/.test(u) ||
      /^text-\[\d/.test(u),
  },
  { name: "spacing", test: (u) => /-\[[^\]]*\d+px/.test(u) },
]

// Raw colors inside any string (inline styles, SVG strings).
const rawColor = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/
// A dot, or a slash or pipe in JSX text or a join(), joining meta values, for example {" · "}.
const metaJoin =
  /[·•]|\{\s*["'`]\s*[|/]\s*["'`]\s*\}|join\(\s*["'`]\s*[|/]\s*["'`]\s*\)/

// The utility after its variants ("md:hover:-translate-y-1" -> "-translate-y-1"), without "!".
function bare(token: string) {
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    if (token[i] === "[") depth++
    else if (token[i] === "]") depth--
    else if (token[i] === ":" && depth === 0) start = i + 1
  }
  return token.slice(start).replace(/^!|!$/g, "")
}

const skip = ["src/components/ui/", "src/routeTree.gen.ts", "src/mocks/"]
const findings: string[] = []

function report(path: string, line: number, rule: string, what: string) {
  if (
    allowed.some(
      (a) => a.file === path && a.rule === rule && what.includes(a.match)
    )
  )
    return
  findings.push(`${path}:${line}: [${rule}] ${what}`)
}

for (const file of readdirSync("src", { recursive: true, encoding: "utf8" })) {
  const path = `src/${file}`
  if (!/\.tsx?$/.test(path) || skip.some((s) => path.startsWith(s))) continue
  const lines = readFileSync(path, "utf8").split("\n")
  lines.forEach((text, i) => {
    const line = i + 1
    if (/^\s*(?:\/\/|\/?\*)/.test(text)) return
    if (rawColor.test(text)) report(path, line, "tokens", text.trim())
    if (physical.test(text)) report(path, line, "direction", text.trim())
    if (metaJoin.test(text)) report(path, line, "meta lines", text.trim())
    // An outline link needs cn() to drop the base border-transparent, or its border disappears (Deviations "14.2 outline").
    if (
      /buttonVariants\(\{[^}]*outline/.test(text) &&
      !/cn\(\s*buttonVariants/.test(text) &&
      !/cn\($/.test(lines[i - 1]?.trim() ?? "")
    )
      report(path, line, "outline link", text.trim())
    for (const raw of text.split(/[\s"'`{}()]+/)) {
      const u = bare(raw)
      for (const rule of rules)
        if (rule.test(u, raw)) report(path, line, rule.name, raw)
    }
  })
}

// styles.css defines the tokens and the motion helpers, so only the bans that hold everywhere apply.
readFileSync("src/styles.css", "utf8")
  .split("\n")
  .forEach((text, i) => {
    if (
      /gradient\(|backdrop-filter|filter:\s*blur|transition:\s*all|will-change/.test(
        text
      )
    )
      report("src/styles.css", i + 1, "styles", text.trim())
  })

for (const f of findings) console.error(f)
if (findings.length) {
  console.error(`\n${findings.length} design findings`)
  process.exit(1)
}
console.log("audit:design: no findings")
