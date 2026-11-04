# Make logos

Colour brand marks for the makes in the taxonomy, shown by `MakeLogo` (`src/components/app/make-logo.tsx`) as plain `<img>` tags.

## Files

- One `<make id>.svg` per make (`land-rover.svg`, `mercedes.svg`). Made from the originals in `assets-src/Car-logos/`, which stay untouched.
- Each file has a tight `viewBox` cropped to the artwork and no `width` or `height`, so `object-contain` fits it in the same box as every other logo. Editor metadata is stripped and the paths are minified (`svgo --multipass --precision 1`; 256 KB for all 55, 95 KB gzipped).
- A make without a file shows its English initial in a grey box (lists, grids, dropdowns) or nothing (headings, spec rows).

## Adding or replacing a logo

1. Crop the SVG to its artwork (set `viewBox`, drop `width` and `height`), minify it, and save it here as `<make id>.svg`.
2. Add the id to the `logos` set at the top of `make-logo.tsx`. `tests/make-logo.test.tsx` fails when a file has no id there.

## Sources and licences

- All makes except the five below: the colour "Logo" icons of `@cardog-icons/core` (https://icons.cardog.ai), MIT licence, Copyright (c) 2024 Cardog.
- Suzuki, Peugeot, Isuzu, TVS, Yamaha: supplied by the project owner in `assets-src/Car-logos/`; their origin and licence are not recorded.

The marks are trademarks of their owners and appear only to name the make a listing is for.
