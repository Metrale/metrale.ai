#!/usr/bin/env bash
# Vendor the brand files this repository uses from Metrale/metrale-assets, at a release tag, and pin them.
#
#   assets/take-assets.sh <metrale-assets checkout> <tag>   # then: cd site && node scripts/brand/kit.mjs, commit
#   assets/take-assets.sh --check [--upstream]              # CI: the vendored files are the pinned ones
#
# assets/brand.pin records the tag, its commit and every file's git blob id. --check fails when a
# vendored file was edited, added or removed by hand; --upstream also asks GitHub that the pinned
# commit holds exactly those blobs (needs gh with read access to metrale-assets).
#
# metrale-assets is the source of the brand. Nothing in assets/brand/ is drawn or retyped here: the
# site derives its icons, fonts, social card, logo artwork and palette from these files
# (site/scripts/brand/kit.mjs), and a unit test fails when a derived copy is behind them.
set -euo pipefail
cd "$(dirname "$0")"
dir=brand
pin=brand.pin
# What metrale.ai takes (site, blog, docs). Add a path here, re-run, then run kit.mjs.
FILES=(
  BRAND-GUIDELINES.md
  tokens/brand.json
  svg/mark.svg svg/mark-compact.svg svg/logo-horizontal.svg svg/logo-horizontal-ondark.svg
  favicon.ico favicon.svg site.webmanifest
  dark/apple-touch-icon-180.png dark/icon-192.png dark/icon-512.png dark/icon-maskable-512.png
  dark/og-image-1200x630.png dark/github-social-preview-1280x640.png
  fonts/manrope-latin-wght-normal.woff2 fonts/MANROPE-LICENSE.txt fonts/manrope-fallback.css
)

if [ "${1:-}" = "--check" ]; then
  [ -f "$pin" ] || { echo "take-assets: assets/$pin is missing" >&2; exit 1; }
  commit=$(sed -n 's/^commit=//p' "$pin")
  [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo "take-assets: assets/$pin is malformed" >&2; exit 1; }
  want=$(grep -E '^[0-9a-f]{40}  ' "$pin" | sort -k2)
  [ "$(sed 's/^[0-9a-f]*  //' <<<"$want" | sort)" = "$(printf '%s\n' "${FILES[@]}" | sort)" ] ||
    { echo "take-assets: assets/$pin does not list exactly the files this script takes (re-run it)" >&2; exit 1; }
  have=$(cd "$dir" && find . -type f | sed 's|^\./||' | sort | while read -r f; do printf '%s  %s\n' "$(git hash-object "$f")" "$f"; done | sort -k2)
  [ "$want" = "$have" ] || { echo "take-assets: assets/$dir differs from assets/$pin (edited by hand? re-run take-assets.sh)" >&2; diff <(echo "$want") <(echo "$have") >&2 || true; exit 1; }
  if [ "${2:-}" = "--upstream" ]; then
    up=$(gh api "repos/Metrale/metrale-assets/git/trees/$commit?recursive=1" --jq '.tree[] | select(.type=="blob") | "\(.sha)  \(.path)"' | sort -k2)
    while read -r line; do grep -qxF "$line" <<<"$up" || { echo "take-assets: upstream $commit lacks: $line" >&2; exit 1; }; done <<<"$want"
  fi
  echo "take-assets: assets/$dir == metrale-assets@$(sed -n 's/^tag=//p' "$pin") (${commit:0:12})${2:+, confirmed upstream}"
  exit 0
fi

[ $# -eq 2 ] || { echo "usage: take-assets.sh <metrale-assets checkout> <tag> | --check [--upstream]" >&2; exit 2; }
src=$1 tag=$2
git -C "$src" fetch -q --tags origin
commit=$(git -C "$src" rev-parse --verify "refs/tags/$tag^{commit}")
git -C "$src" tag -v "$tag" >/dev/null 2>&1 || { echo "take-assets: tag $tag is not a valid signed tag" >&2; exit 1; }
rm -rf -- "$dir"
mkdir -p "$dir"
git -C "$src" archive "$commit" "${FILES[@]}" | tar -x -C "$dir"
{
  printf 'tag=%s\ncommit=%s\n' "$tag" "$commit"
  for f in "${FILES[@]}"; do printf '%s  %s\n' "$(git -C "$src" rev-parse "$commit:$f")" "$f"; done
} > "$pin"
echo "vendored metrale-assets $tag (${commit:0:12}) into assets/$dir; now run: cd site && node scripts/brand/kit.mjs"
