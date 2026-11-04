// False on the server, under reduced motion and with data saver on (the root sets `data-data-saver` on <html>). Smooth scrolling and view transitions check it.
export const motionAllowed = () =>
  typeof window !== "undefined" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !document.documentElement.hasAttribute("data-data-saver")

export const coverName = "listing-cover"

// A view-transition-name may sit on one element only. On press, every holder loses it (on a detail page that is the current cover), then the pressed card's photo gets it, so the browser morphs that photo into the next page's cover.
export function markSharedCover(photo: Element | null | undefined) {
  if (!(photo instanceof HTMLElement) || !motionAllowed()) return
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-shared-cover]"
  )) {
    el.style.removeProperty("view-transition-name")
    el.removeAttribute("data-shared-cover")
  }
  photo.style.setProperty("view-transition-name", coverName)
  photo.setAttribute("data-shared-cover", "")
}

// A route change cross fades the page content. Navigations that only change search params (filters, sort, pages) do not move.
export const pageTransition = {
  types: ({ pathChanged }: { pathChanged: boolean }) =>
    pathChanged && motionAllowed() ? ["page"] : (false as const),
}
