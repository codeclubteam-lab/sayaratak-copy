import { useRouterState } from "@tanstack/react-router"

// The address of a wizard step: this page with another `step`, every other param kept.
export function useStepHref() {
  const location = useRouterState({ select: (s) => s.location })
  return (id: string) => {
    const params = new URLSearchParams(location.searchStr)
    params.set("step", id)
    return `${location.pathname}?${params}`
  }
}
