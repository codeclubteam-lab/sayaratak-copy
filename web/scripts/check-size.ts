// Prints gzip size of every JS chunk in the production build; fails over budget (A1 rule 10).
import { readFileSync, readdirSync } from "node:fs"
import process from "node:process"
import { gzipSync } from "node:zlib"

const dir = ".output/public/assets"
// ponytail: entry = `index-*.js`; if the home route gets its own chunk, point the 200 KB limit at that instead (raised from 180 in step 2.3, see Decisions)
// ponytail: `chart-impl-*` is the lazy Recharts chunk (about 105 KB gzip, only dashboards load it), so it gets its own 120 KB limit (step 4.6, see Decisions)
const limit = (name: string) =>
  name.startsWith("index-") ? 200 : name.startsWith("chart-impl-") ? 120 : 80

let failed = 0
for (const name of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const kb = gzipSync(readFileSync(`${dir}/${name}`)).length / 1024
  const over = kb > limit(name)
  console.log(
    `${over ? "FAIL" : "ok  "} ${kb.toFixed(1)} KB  ${name} (max ${limit(name)})`
  )
  if (over) failed++
}
if (failed) process.exit(1)
