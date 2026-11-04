import { normalizePhone } from "@sayaratak/shared/lib/phone"

// Lowercase email or E.164 phone, the same value the API looks accounts up by.
export const normalizeIdentifier = (value: string) =>
  value.includes("@") ? value.trim().toLowerCase() : normalizePhone(value)
