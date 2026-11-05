import { SQL } from "bun"
import { drizzle } from "drizzle-orm/bun-sql"

import * as schema from "~/shared/db/schema"

import { buildCases } from "./scale-cases"

/**
 * 10.6: `EXPLAIN (ANALYZE, BUFFERS)` of the heaviest queries, on the database `scale-seed.ts` made.
 * Calls the real query functions, so the SQL is the app's own. Each statement runs three times
 * and the last is shown (warm cache). Exits 1 when one is over 100 ms.
 *
 *   DATABASE_URL=postgres://.../sayaratak_scale bun scripts/scale-explain.ts [plans.txt]
 */
const url = Bun.env.DATABASE_URL ?? ""
if (!/_scale(\?.*)?$/.test(url)) {
  process.stderr.write("needs DATABASE_URL on a database ending in _scale\n")
  process.exit(1)
}
const TARGET_MS = 100

const client = new SQL({ url, max: 1 })
let captured: { text: string; params: unknown[] }[] = []
const ex = drizzle({
  client,
  schema,
  casing: "snake_case",
  logger: {
    logQuery: (text, params) => captured.push({ text, params }),
  },
})

const plans: string[] = []
let slow = 0
for (const [name, run] of buildCases(ex)) {
  captured = []
  await run()
  const statements = captured
  const lines: string[] = []
  for (const { text, params: values } of statements) {
    let plan = ""
    for (let pass = 0; pass < 3; pass++) {
      const rows = await client.unsafe(
        `explain (analyze, buffers) ${text}`,
        values as never[]
      )
      plan = rows.map((r: Record<string, string>) => r["QUERY PLAN"]).join("\n")
    }
    const ms = Number(/Execution Time: ([\d.]+) ms/.exec(plan)?.[1])
    const scans = [
      ...new Set(
        [
          ...plan.matchAll(
            /(Seq Scan|Index Only Scan|Index Scan|Bitmap Index Scan) (?:using |on )(\S+)/g
          ),
        ].map((m) => `${m[1]} ${m[2]}`)
      ),
    ]
    if (ms > TARGET_MS) slow++
    const rows = /actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/.exec(plan)?.[1]
    lines.push(
      `  ${ms.toFixed(1).padStart(7)} ms ${String(rows).padStart(6)} rows  ${scans.join(", ") || "-"}`
    )
    plans.push(`### ${name}\n${text}\n${plan}\n`)
  }
  process.stdout.write(`${name}\n${lines.join("\n")}\n`)
}
if (Bun.argv[2]) await Bun.write(Bun.argv[2], plans.join("\n"))
process.stdout.write(`\n${slow} statement(s) over ${TARGET_MS} ms\n`)
process.exit(slow > 0 ? 1 : 0)
