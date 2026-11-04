import type { Bilingual } from "@sayaratak/shared/schemas/fields"

/**
 * Text typed in one language, stored in both slots (A1 rule 8, the mock's
 * `both()`). The one place a translator would replace later.
 */
export function both(text: string): Bilingual {
  return { ar: text, en: text }
}
