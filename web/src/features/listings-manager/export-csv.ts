// A leading = + - @ would run as a formula in Excel, so such a cell starts with a quote.
const cell = (value: string | number) => {
  const text = String(value)
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
}

// The byte order mark makes Excel read the file as UTF-8, so Arabic titles survive.
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const text = rows.map((row) => row.map(cell).join(",")).join("\r\n")
  const url = URL.createObjectURL(
    new Blob(["﻿", text], { type: "text/csv;charset=utf-8" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
