import { SQL } from "bun"

/**
 * 10.6: a load run on search and listing pages against a running API on the scale database.
 * Plain `fetch` workers (the plan names `oha`; the same URLs work there). Exits 1 when the
 * overall p95 is over 300 ms or any request fails or answers 5xx.
 *
 *   DATABASE_URL=postgres://.../sayaratak_scale PORT=4100 bun src/index.ts &
 *   DATABASE_URL=postgres://.../sayaratak_scale bun scripts/scale-load.ts http://localhost:4100 [seconds] [concurrency]
 */
const url = Bun.env.DATABASE_URL ?? ""
if (!/_scale(\?.*)?$/.test(url)) {
  process.stderr.write("needs DATABASE_URL on a database ending in _scale\n")
  process.exit(1)
}
const [base = "http://localhost:4100", seconds = "60", workers = "50"] =
  Bun.argv.slice(2)
const P95_MS = 300

const sql = new SQL({ url, max: 1 })
const slugs: string[] = (
  await sql`select slug from listings l where moderation = 'approved' and not exists (select 1 from "user" u where u.id = l.owner_user_id and u.banned) order by random() limit 500`
).map((row: { slug: string }) => row.slug)
await sql.close()

const pick = <T>(list: T[]) =>
  list[Math.floor(Math.random() * list.length)] as T
const search = (query: string) => () => `/api/v1/listings?${query}`
const pages = Array.from({ length: 40 }, (_, i) => i + 1)

// Each class is a kind of page the web asks for; the weights are rough shares of traffic.
const classes: { name: string; weight: number; path: () => string }[] = [
  {
    name: "search: default",
    weight: 3,
    path: search("kind=vehicle&intent=sale"),
  },
  {
    name: "search: page N",
    weight: 2,
    path: () => `/api/v1/listings?kind=vehicle&intent=sale&page=${pick(pages)}`,
  },
  {
    name: "search: filters",
    weight: 3,
    path: search(
      "kind=vehicle&type=car&city=khartoum&make=toyota&minPrice=5000000&sort=newest"
    ),
  },
  {
    name: "search: q",
    weight: 2,
    path: () =>
      `/api/v1/listings?kind=vehicle&q=${pick(["toyota", "nissan", "تويوتا", "clean", "نظيفة"])}`,
  },
  { name: "search: parts", weight: 1, path: search("kind=part") },
  {
    name: "listing page",
    weight: 6,
    path: () => `/api/v1/listings/${pick(slugs)}`,
  },
]
const bag = classes.flatMap((c) => Array<typeof c>(c.weight).fill(c))
const times = new Map<string, number[]>(classes.map((c) => [c.name, []]))
const failures = new Map<string, number>()

const deadline = Date.now() + Number(seconds) * 1000
async function worker() {
  while (Date.now() < deadline) {
    const kind = pick(bag)
    const start = performance.now()
    try {
      const res = await fetch(base + kind.path())
      await res.arrayBuffer()
      if (res.status >= 400) throw new Error(String(res.status))
      times.get(kind.name)?.push(performance.now() - start)
    } catch (error) {
      const key = `${kind.name}: ${(error as Error).message}`
      failures.set(key, (failures.get(key) ?? 0) + 1)
    }
  }
}
await Promise.all(Array.from({ length: Number(workers) }, worker))

const at = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0
const row = (name: string, list: number[]) => {
  const s = [...list].sort((a, b) => a - b)
  process.stdout.write(
    `${name.padEnd(18)} ${String(s.length).padStart(7)} req  p50 ${at(s, 0.5).toFixed(0).padStart(4)}  p95 ${at(s, 0.95).toFixed(0).padStart(4)}  p99 ${at(s, 0.99).toFixed(0).padStart(4)} ms\n`
  )
  return at(s, 0.95)
}
for (const [name, list] of times) row(name, list)
const all = [...times.values()].flat()
const p95 = row("all", all)
const failed = [...failures.values()].reduce((sum, n) => sum + n, 0)
process.stdout.write(
  `${(all.length / Number(seconds)).toFixed(0)} req/s, ${failed} failed\n`
)
for (const [key, n] of failures) process.stdout.write(`  ${n} x ${key}\n`)
process.exit(p95 > P95_MS || failed > 0 ? 1 : 0)
