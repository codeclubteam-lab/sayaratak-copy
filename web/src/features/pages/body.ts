export type Block =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }

// The admin writes plain text: a blank line ends a block, `# ` starts a heading (h2, the page title is the h1), `- ` starts a list item. No HTML.
export function parseBody(body: string): Block[] {
  const blocks: Block[] = []
  let open: Block | undefined
  for (const raw of body.split("\n")) {
    const line = raw.trim()
    if (!line) {
      open = undefined
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h", text: line.slice(2).trim() })
      open = undefined
    } else if (line.startsWith("- ")) {
      if (open?.type !== "ul") blocks.push((open = { type: "ul", items: [] }))
      open.items.push(line.slice(2).trim())
    } else if (open?.type === "p") {
      open.text += ` ${line}`
    } else {
      blocks.push((open = { type: "p", text: line }))
    }
  }
  return blocks
}

// First paragraph, for the meta description.
export const bodySummary = (body: string) =>
  (parseBody(body).find((b) => b.type === "p")?.text ?? "").slice(0, 155)
