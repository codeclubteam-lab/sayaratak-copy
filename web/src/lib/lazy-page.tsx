import type { AsyncRouteComponent } from "@tanstack/react-router"

// Route component for a route factory (`billingRoute(role)` and the like): the file-route splitter cannot see through a factory, so the page is loaded with `lazyRouteComponent` and the props are bound here. The router still preloads the chunk with the route.
export const withProps = <TProps extends object>(
  Page: AsyncRouteComponent<TProps>,
  props: TProps
) => Object.assign(() => <Page {...props} />, { preload: Page.preload })
