import { tileUrl } from "./map"

const CLOUDINARY_ORIGIN = "https://res.cloudinary.com"

const originOf = (url?: string) => {
  const trimmed = url?.trim()
  if (!trimmed) return ""
  try {
    return new URL(trimmed).origin
  } catch {
    return ""
  }
}

const unique = (values: string[]) =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].join(" ")

// One nonce per request: the router puts it on every inline script it renders (see router.tsx), the CSP allows only those.
export function buildCsp(
  nonce: string,
  options: { apiBaseUrl?: string; imageOrigins?: string } = {}
) {
  const api = originOf(
    options.apiBaseUrl ??
      (process.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL)
  )
  const images = unique([
    "'self'",
    "data:",
    "blob:",
    originOf(tileUrl.replace(/\{\w\}/g, "0")),
    CLOUDINARY_ORIGIN,
    api,
    ...(options.imageOrigins ?? process.env.IMAGE_ORIGINS ?? "").split(/\s+/),
  ])
  const media = unique(["'self'", "blob:", CLOUDINARY_ORIGIN, api])
  const connect = unique(["'self'", api])
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // React style props, Leaflet and the chart theme write inline styles.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    `media-src ${media}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}
