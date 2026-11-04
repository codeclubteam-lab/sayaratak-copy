// Arabic-Indic (٠-٩) and Persian (۰-۹) digits end in the same 4 bits as 0-9, so one mask converts both.
export const normalizeDigits = (input: string) =>
  input.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 15))
