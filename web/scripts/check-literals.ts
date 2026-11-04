// Fails on JSX text and on aria-label, title, placeholder, alt string literals that are not wrapped in t(). Text with no letters (punctuation, digits) is fine.
import { readFileSync, readdirSync } from "node:fs"
import process from "node:process"
import ts from "typescript"

const attrs = new Set(["aria-label", "title", "placeholder", "alt"])
const skip = [
  "src/components/ui/",
  "src/routeTree.gen.ts",
  "src/mocks/",
  "src/components/app/dev-panel.tsx",
]
const keep = new Set(["Ctrl K", "SY-527294"])
const hasLetters = /\p{L}/u

let failed = 0
const report = (sf: ts.SourceFile, node: ts.Node, text: string) => {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
  console.error(`${sf.fileName}:${line + 1}: ${text.trim().slice(0, 60)}`)
  failed++
}

for (const file of readdirSync("src", { recursive: true, encoding: "utf8" })) {
  const path = `src/${file}`
  if (!path.endsWith(".tsx") || skip.some((s) => path.startsWith(s))) continue
  const sf = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxText(node) &&
      hasLetters.test(node.text) &&
      !keep.has(node.text.trim())
    )
      report(sf, node, node.text)
    else if (
      ts.isJsxAttribute(node) &&
      attrs.has(node.name.getText()) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      hasLetters.test(node.initializer.text)
    )
      report(sf, node, node.getText())
    ts.forEachChild(node, visit)
  }
  visit(sf)
}
if (failed) process.exit(1)
