import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"

// Colour brand marks in public/images/makes/<make id>.svg, cropped to the artwork (no width or height, a tight viewBox). Add a file there and its id below to give a make a logo.
const logos = new Set([
  "acura",
  "alfa-romeo",
  "aston-martin",
  "audi",
  "bentley",
  "bmw",
  "bugatti",
  "buick",
  "byd",
  "cadillac",
  "chevrolet",
  "chrysler",
  "dodge",
  "ferrari",
  "fiat",
  "ford",
  "genesis",
  "gmc",
  "honda",
  "hummer",
  "hyundai",
  "infiniti",
  "isuzu",
  "jaguar",
  "jeep",
  "kia",
  "koenigsegg",
  "lamborghini",
  "land-rover",
  "lexus",
  "lincoln",
  "lotus",
  "lucid",
  "maserati",
  "mazda",
  "mclaren",
  "mercedes",
  "mini",
  "mitsubishi",
  "nissan",
  "pagani",
  "peugeot",
  "polestar",
  "porsche",
  "ram",
  "rivian",
  "rolls-royce",
  "subaru",
  "suzuki",
  "tesla",
  "toyota",
  "tvs",
  "volkswagen",
  "volvo",
  "yamaha",
])

// One box per size for every logo, so rows and tiles line up; `object-contain` fits wide wordmarks and round badges alike. `lg` fills whatever box the tile gives it.
const sizes = {
  sm: { box: "h-6 w-10", letter: "text-caption", w: 40, h: 24 },
  md: { box: "h-10 w-14", letter: "text-ui", w: 56, h: 40 },
  lg: { box: "size-full", letter: "text-title", w: 56, h: 40 },
} as const

// Decorative: the make name always sits beside it. A make without a file shows the first letter of `name` when it is given (lists and grids, where a gap would break the column), and nothing otherwise (headings). Pass the English name: the Latin initial matches the badge on the car, and an Arabic initial reads as a stray mark.
export function MakeLogo({
  id,
  name,
  size = "sm",
}: {
  id?: string | null
  name?: string
  size?: keyof typeof sizes
}) {
  const { box, letter, w, h } = sizes[size]
  const uploaded = useQuery(taxonomyQuery).data?.makes.find(
    (m) => m.id === id
  )?.logoUrl
  if (uploaded || (id && logos.has(id)))
    return (
      <img
        src={uploaded || `/images/makes/${id}.svg`}
        width={w}
        height={h}
        alt=""
        loading={size === "md" ? "eager" : "lazy"}
        decoding="async"
        className={`${box} shrink-0 object-contain`}
      />
    )
  if (!name) return null
  return (
    <span
      aria-hidden
      className={`${box} ${letter} grid shrink-0 place-items-center rounded-lg bg-muted font-semibold text-muted-foreground`}
    >
      <bdi>{name.charAt(0)}</bdi>
    </span>
  )
}
