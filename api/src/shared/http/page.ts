const LIMIT_MAX = 24

/**
 * Page and page size from the raw query, as the mock's `pageParams`: `limit`
 * (1 to 24) wins for the rails, else `pageSize` up to `maxSize`, else the
 * default. Example: `?page=2&pageSize=500` with max 100 is page 2 of 100.
 */
export function pageParams(
  query: { page?: string; pageSize?: string; limit?: string },
  size: { default: number; max: number }
) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1)
  const limit = Math.floor(Number(query.limit))
  if (limit) return { page, pageSize: Math.min(LIMIT_MAX, Math.max(1, limit)) }
  const asked = Math.floor(Number(query.pageSize)) || size.default
  return { page, pageSize: Math.min(size.max, Math.max(1, asked)) }
}
