import { parseBody } from "../body"

export function PageBody({ body }: { body: string }) {
  return (
    <div className="flex max-w-[65ch] flex-col gap-4">
      {parseBody(body).map((block, i) =>
        block.type === "h" ? (
          <h2 key={i} className="mt-4 text-title font-semibold">
            {block.text}
          </h2>
        ) : block.type === "ul" ? (
          <ul key={i} className="flex list-disc flex-col gap-2 ps-6 text-body">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="text-body">
            {block.text}
          </p>
        )
      )}
    </div>
  )
}
