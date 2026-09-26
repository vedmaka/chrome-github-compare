#!/usr/bin/env bash
set -Eeuo pipefail

# Export Store artwork from the user-supplied source images in the repository root
asset_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
command -v magick >/dev/null || { printf 'ImageMagick magick is required\n' >&2; exit 1; }

for source in icon.png img1.png img2.png img3.png; do
  [[ -s "$asset_root/$source" ]] || { printf 'Missing source image: %s\n' "$source" >&2; exit 1; }
done

mkdir -p "$asset_root/assets/icons" "$asset_root/store-assets"

for size in 16 32 48 128; do
  inner=$((size * 3 / 4))
  magick "$asset_root/icon.png" -resize "${inner}x${inner}" \
    -background none -gravity center -extent "${size}x${size}" -strip \
    "$asset_root/assets/icons/icon-${size}.png"
done

for number in 1 2; do
  magick "$asset_root/img${number}.png" -resize '1280x800^' \
    -gravity center -crop '1280x800+0+0' +repage -strip \
    "$asset_root/store-assets/screenshot-${number}-1280x800.png"
done

magick "$asset_root/img3.png" -resize '1400x560^' \
  -gravity center -crop '1400x560+0+0' +repage -strip \
  "$asset_root/store-assets/marquee-promo-1400x560.png"

magick -size '440x280' 'xc:#0d1117' \
  '(' "$asset_root/icon.png" -resize '180x180' ')' \
  -gravity center -composite -strip \
  "$asset_root/store-assets/small-promo-440x280.png"

printf 'Exported four icons, two screenshots, and two promo images\n'
