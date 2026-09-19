import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Whether the viewport is narrow enough for the sidebar to become a drawer.
 *
 * `useSyncExternalStore` rather than the generated file's effect-plus-setState,
 * which the repository's `react-hooks` rules reject for cascading renders. A
 * media query is an external store in the exact sense the hook was added for,
 * so this is the shape React wants: subscribe, read, and supply a server
 * snapshot. `false` is the right snapshot because the server has no viewport
 * and the desktop layout is the one that renders without a drawer.
 */
function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
