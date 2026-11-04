import { env } from "~/env"

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const
// A12: logs never hold passwords, codes, cookies, tokens or full emails.
const SECRET_KEY = /pass|secret|token|cookie|authorization|otp/i
// Secrets written as `password=hunter2` inside free text, such as an error message.
const SECRET_PAIR = /\b(pass\w*|secret|token|otp|cookie)=\S+/gi
// A12 mask: ali@mail.sd becomes a***@mail.sd.
const EMAIL = /([^\s@"'<>,;:])[^\s@"'<>,;:]*@([\w-]+(?:\.[\w-]+)+)/g
const REDACTED = "[redacted]"

type Level = keyof typeof LEVELS
type Fields = Record<string, unknown>

/** One JSON line per call, below `level` dropped. Tests pass their own `write`. */
export function createLogger(level: Level, write: (line: string) => void) {
  const at =
    (lineLevel: Level) =>
    (msg: string, fields: Fields = {}) => {
      if (LEVELS[lineLevel] < LEVELS[level]) return
      const line = { time: new Date().toISOString(), level: lineLevel, msg }
      write(`${JSON.stringify({ ...line, ...maskFields(fields) })}\n`)
    }
  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
  }
}

export const log = createLogger(env.LOG_LEVEL, (line) => {
  process.stdout.write(line)
})

export function maskFields(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      SECRET_KEY.test(key) ? REDACTED : maskValue(value),
    ])
  )
}

function maskValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(SECRET_PAIR, `$1=${REDACTED}`)
      .replace(EMAIL, "$1***@$2")
  }
  // JSON.stringify turns an Error into {}, so keep what a reader needs.
  if (value instanceof Error) {
    const { name, message, stack } = value
    return maskFields({ name, message, stack })
  }
  if (Array.isArray(value)) return value.map(maskValue)
  if (value && typeof value === "object") return maskFields({ ...value })
  return value
}
