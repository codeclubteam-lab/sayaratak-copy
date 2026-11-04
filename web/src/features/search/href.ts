import { defaultStringifySearch } from "@tanstack/react-router"

import type { SearchParams } from "@sayaratak/shared/search/schemas"

// A path without the locale, wrapped in `localeHref` by callers. It uses the encoding the router writes, so the search page's validateSearch reads it back (arrays and numbers keep their type).
export const searchPath = (params: Partial<SearchParams>) =>
  `/search${defaultStringifySearch(params)}`
