// Mock `capPaid` (web/src/mocks/search.ts), ported as is so the interleave is identical.
const HOUR_MS = 3_600_000
const PAGE = 24

// Hash of the listing id and the hour: Featured listings take turns, in an
// order that changes every hour and stays the same while a buyer pages through.
function turn(id: string, now: number) {
  let h = Math.floor(now / HOUR_MS)
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16_777_619)
  return h >>> 0
}

/**
 * Featured listings never fill a whole page: each page of 24 opens with a row
 * of up to 4 Featured, then a Featured leads each later row of 4; the rest go
 * by ranking. Leftover Featured move to later pages, still ahead of their peers.
 * `organic` is in ranking order and may be cut after the last slot needed.
 * Example: 6 Featured, page 1 is F F F F o o o o F o o o F o o o ...
 */
export function capPaid(
  featured: string[],
  organic: string[],
  now = Date.now()
) {
  const paid = [...featured].sort((a, b) => turn(a, now) - turn(b, now))
  const rest = [...organic]
  const out: string[] = []
  const total = paid.length + rest.length
  for (let i = 0; i < total; i++) {
    const slot = i % PAGE
    const order = slot < 4 || slot % 4 === 0 ? [paid, rest] : [rest, paid]
    const next = order.find((ids) => ids.length > 0)?.shift()
    if (next) out.push(next)
  }
  return out
}
