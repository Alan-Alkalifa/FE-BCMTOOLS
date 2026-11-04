#!/usr/bin/env bash
# Tags the PROD release vYYYY.MM.DD (WIB date), or vYYYY.MM.DD.2, .3 ... for later releases that
# day, and publishes a GitHub Release with notes from the merged pull requests.
# Needs GH_TOKEN and a checkout with tags (fetch-depth: 0).
set -euo pipefail
git fetch --quiet --tags
base="v$(TZ=Asia/Jakarta date +%Y.%m.%d)"
tag="${base}"
n=1
while git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; do
  n=$((n + 1))
  tag="${base}.${n}"
done
gh release create "${tag}" --target "${GITHUB_SHA}" --title "${tag}" --generate-notes
echo "Released ${tag}"
echo "tag=${tag}" >> "${GITHUB_OUTPUT}"
