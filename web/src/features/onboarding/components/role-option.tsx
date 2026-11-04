import { CheckIcon } from "lucide-react"

// One role as a photo tile, like the post wizard's type tiles. A native radio under the tile look: Tab enters the group on the chosen tile and the arrow keys move between tiles.
export function RoleOption({
  name,
  photo,
  title,
  description,
  checked,
  onChange,
}: {
  name: string
  photo: string
  title: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="group relative flex press cursor-pointer flex-col gap-3 rounded-xl p-1 has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span className="block aspect-4/3 overflow-hidden rounded-lg bg-muted outline-primary group-has-checked:outline-2">
        <img
          src={`/images/categories/${photo}-320.webp`}
          srcSet={`/images/categories/${photo}-320.webp 320w, /images/categories/${photo}-640.webp 640w`}
          sizes="(min-width: 1024px) 220px, 45vw"
          width={320}
          height={240}
          alt=""
          decoding="async"
          className="size-full object-cover mix-blend-multiply"
        />
      </span>
      <span className="flex flex-col px-0.5">
        <span className="text-ui font-medium group-has-checked:text-primary">
          {title}
        </span>
        <span className="text-caption text-muted-foreground">
          {description}
        </span>
      </span>
      <CheckIcon
        aria-hidden="true"
        className="absolute end-3 top-3 hidden size-6 rounded-full bg-primary p-1 text-primary-foreground group-has-checked:block"
      />
    </label>
  )
}
