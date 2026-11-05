import { Hono } from "hono"

const CONFIGURATION = JSON.stringify({
  hideClientButton: true,
  hideTestRequestButton: true,
  showDeveloperTools: "never",
  agent: { disabled: true },
  proxyUrl: "",
  telemetry: false,
  withDefaultFonts: false,
})

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sayaratak API reference</title>
</head>
<body>
  <script id="api-reference" data-url="/api/v1/openapi.json"
    data-configuration='${CONFIGURATION}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`

/** A18: a read-only contract page for local development, never served in production. */
export function docsRoutes(appEnv: string) {
  const routes = new Hono()
  if (appEnv !== "production") routes.get("/docs", (c) => c.html(PAGE))
  return routes
}
