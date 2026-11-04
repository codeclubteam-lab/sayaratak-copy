import { createInstance } from "i18next"
import { initReactI18next } from "react-i18next"

import type { Locale } from "@sayaratak/shared/schemas/locale"

export const namespaces = [
  "common",
  "home",
  "search",
  "listing",
  "directory",
  "auth",
  "onboarding",
  "dashboard",
  "admin",
  "billing",
  "manager",
  "status",
  "validation",
  "toast",
  "error",
] as const

export type Messages = Record<string, Record<string, string>>

// A new instance per call: the server calls this once per request, so nothing leaks between visitors.
export function createI18n(locale: Locale, messages: Messages) {
  const i18n = createInstance()
  void i18n.use(initReactI18next).init({
    lng: locale,
    resources: { [locale]: messages },
    ns: [...namespaces],
    defaultNS: "common",
    fallbackNS: [...namespaces],
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    initAsync: false,
    react: { useSuspense: false },
  })
  return i18n
}
