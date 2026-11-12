export type DeploymentConfig = { apiBaseUrl: string; appOrigin: string }

export function readDeploymentConfig(
  source: Record<string, string | undefined>
): DeploymentConfig {
  const deployed = source.NODE_ENV === "production"
  const apiBaseUrl = readOrigin(
    "API_BASE_URL",
    source.API_BASE_URL,
    deployed ? undefined : "http://localhost:4000"
  )
  const appOrigin = readOrigin(
    "APP_ORIGIN",
    source.APP_ORIGIN,
    deployed ? undefined : "http://localhost:3000"
  )
  if (apiBaseUrl === appOrigin)
    throw new Error(
      "API_BASE_URL must differ from APP_ORIGIN to prevent recursion"
    )
  const browserBase = source.VITE_API_BASE_URL ?? ""
  if (
    browserBase !== "" &&
    browserBase !== "/" &&
    readOrigin("VITE_API_BASE_URL", browserBase) !== appOrigin
  )
    throw new Error(
      "VITE_API_BASE_URL must match APP_ORIGIN or be root-relative"
    )
  return { apiBaseUrl, appOrigin }
}

function readOrigin(key: string, raw?: string, fallback?: string) {
  const value = raw || fallback
  if (value && URL.canParse(value)) {
    const url = new URL(value)
    if (
      ["http:", "https:"].includes(url.protocol) &&
      (value === url.origin || value === `${url.origin}/`)
    )
      return url.origin
  }
  // Do not echo values: a malformed origin may contain credentials.
  throw new Error(`${key} must be an explicit HTTP(S) origin without a path`)
}
