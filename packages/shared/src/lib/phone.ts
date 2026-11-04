import { normalizeDigits } from "./digits"

// Turns what people type (any digits, spaces, 0912..., 912...) into +249XXXXXXXXX; anything else passes through for the schema to reject.
export function normalizePhone(input: string) {
  const s = normalizeDigits(input).replace(/[\s\-()[\]]/g, "")
  if (s.startsWith("00")) return `+${s.slice(2)}`
  if (/^0\d{9}$/.test(s)) return `+249${s.slice(1)}`
  if (/^[19]\d{8}$/.test(s)) return `+249${s}`
  return s
}

// "+249 91 234 5678" for display; callers render it with dir="ltr".
export function formatPhone(e164: string) {
  const m = /^\+249(\d{2})(\d{3})(\d{4})$/.exec(e164)
  return m ? `+249 ${m[1]} ${m[2]} ${m[3]}` : e164
}

// wa.me wants digits only; the optional text pre-fills the message.
export const toWhatsappUrl = (e164: string, text = "") =>
  `https://wa.me/${e164.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`
