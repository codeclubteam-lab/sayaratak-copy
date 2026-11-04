import type { Payment } from "@sayaratak/shared/schemas/billing"
import type { UploadRow } from "../types"

const escape = (s: string) =>
  s.replace(
    /[<>&"]/g,
    (ch) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch] ?? ch
  )

const row = (y: number, label: string, value: string) =>
  `<text x="80" y="${y}" font-size="30" fill="#6b7672">${label}</text><text x="80" y="${y + 50}" font-size="40" font-weight="600" fill="#1d2523">${escape(value)}</text>`

// A drawn Bankak transfer screen for one seeded payment, showing its own amount, note and transaction number so the admin can check them. `transactionShown` differs from the payment's on a rejected one (the reason the seed gives).
function receiptSvg(p: Payment, to: string, transactionShown: string) {
  const date = p.createdAt.slice(0, 16).replace("T", " ")
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280" font-family="system-ui, sans-serif">`,
    `<rect width="720" height="1280" fill="#f6f7f6"/>`,
    `<rect width="720" height="150" fill="#b3261e"/>`,
    `<text x="360" y="95" font-size="48" font-weight="700" fill="#fff" text-anchor="middle">Bankak</text>`,
    `<circle cx="360" cy="260" r="60" fill="#2f7d5b"/>`,
    `<path d="M330 262 l22 22 l40 -44" stroke="#fff" stroke-width="12" fill="none"/>`,
    `<text x="360" y="380" font-size="34" fill="#1d2523" text-anchor="middle">Transfer successful</text>`,
    `<text x="360" y="460" font-size="64" font-weight="700" fill="#1d2523" text-anchor="middle">${p.amount.toLocaleString("en-US")} SDG</text>`,
    `<rect x="40" y="510" width="640" height="700" rx="24" fill="#fff"/>`,
    row(580, "Transaction No.", transactionShown),
    row(700, "From", p.payerName),
    row(820, "To", to),
    row(940, "Note", p.reference),
    row(1060, "Date", date),
    `</svg>`,
  ].join("")
}

// Receipts of the seeded payments, stored like uploads so `/api/uploads/:id` serves them.
export function seedReceipts(
  payments: Payment[],
  to: string
): Map<string, UploadRow> {
  const uploads = new Map<string, UploadRow>()
  for (const p of payments) {
    const id = p.receiptUrl.split("/").pop() ?? p.id
    const shown =
      p.status === "rejected"
        ? p.transactionRef.slice(0, -1) +
          ((Number(p.transactionRef.slice(-1)) + 3) % 10)
        : p.transactionRef
    const svg = receiptSvg(p, to, shown)
    uploads.set(id, {
      id,
      name: `${id}.svg`,
      type: "image/svg+xml",
      bytes: new TextEncoder().encode(svg).buffer,
    })
  }
  return uploads
}
