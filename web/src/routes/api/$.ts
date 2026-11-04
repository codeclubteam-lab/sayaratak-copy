import { createFileRoute } from "@tanstack/react-router"

// The mock stays server-only: it is imported on demand inside the handler, never at module level.
const handle = async ({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}) => {
  const { handleMock } = await import("@/mocks/router")
  return handleMock(request, `/${params._splat ?? ""}`)
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      PUT: handle,
      DELETE: handle,
    },
  },
})
