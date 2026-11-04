import { useTranslation } from "react-i18next"

import type { Locale } from "@sayaratak/shared/schemas/locale"

// Thin wrapper so components get `t` and the active locale from one place. Called in nearly every component, so the locale is a plain comparison, not a schema parse.
export function useT() {
  const { t, i18n } = useTranslation()
  const locale: Locale = i18n.language === "en" ? "en" : "ar"
  return { t, locale }
}
