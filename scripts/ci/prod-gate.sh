#!/usr/bin/env bash
# The checks before anything is deployed to PROD (same script in FE-BCMTOOLS and BE-BCMTOOLS):
#   1. the run is on PROD-BCMTOOLS
#   2. the person who started it (or merged into PROD-BCMTOOLS) is on PROD_APPROVERS
#   3. it is inside the release window, weekdays 09:00-16:00 WIB, unless a hotfix reason is given
#   4. the same files were deployed to DEV and found healthy there (status `deploy-dev` on a
#      commit with the same tree: on DEV-BCMTOOLS, or a hotfix/* branch run through Deploy DEV)
# Prints dev_sha=<that DEV commit> to $GITHUB_OUTPUT. Needs GH_TOKEN, PROD_APPROVERS, ACTOR, REF,
# HOTFIX_REASON (may be empty) and a checkout with every branch's history (fetch-depth: 0).
set -euo pipefail

fail() { echo "::error::$1"; exit 1; }

[ "${REF}" = "refs/heads/PROD-BCMTOOLS" ] || fail "PROD deploys run only on PROD-BCMTOOLS (this run is on ${REF})."

approvers=",$(echo "${PROD_APPROVERS:-}" | tr '[:upper:]' '[:lower:]' | tr -d ' '),"
actor="$(echo "${ACTOR:?}" | tr '[:upper:]' '[:lower:]')"
[ "${approvers}" != ",," ] || fail "The repository variable PROD_APPROVERS is empty: name who may release to PROD."
case "${approvers}" in
  *",${actor},"*) echo "Approver: ${ACTOR}" ;;
  *) fail "${actor} is not on PROD_APPROVERS, so can't release to PROD." ;;
esac

day=$(TZ=Asia/Jakarta date +%u)   # 1 = Monday ... 7 = Sunday
hour=$(TZ=Asia/Jakarta date +%H)
if [ "${day}" -le 5 ] && [ "${hour#0}" -ge 9 ] && [ "${hour#0}" -lt 16 ]; then
  echo "Inside the release window ($(TZ=Asia/Jakarta date '+%a %H:%M') WIB)."
elif [ -n "${HOTFIX_REASON:-}" ]; then
  echo "::warning::Outside the release window; hotfix reason: ${HOTFIX_REASON}"
else
  fail "Outside the release window (weekdays 09:00-16:00 WIB). For a hotfix, run Deploy PROD by hand and give the reason."
fi

tree=$(git rev-parse "HEAD^{tree}")
dev_sha=""
mapfile -t refs < <(git for-each-ref --format='%(refname)' refs/remotes/origin/DEV-BCMTOOLS 'refs/remotes/origin/hotfix/')
[ "${#refs[@]}" -gt 0 ] || fail "No DEV-BCMTOOLS branch in the checkout (fetch-depth: 0 is needed)."
for sha in $(git rev-list -n 500 "${refs[@]}"); do
  [ "$(git rev-parse "${sha}^{tree}")" = "${tree}" ] || continue
  state=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${sha}/status" \
    --jq '[.statuses[] | select(.context == "deploy-dev")][0].state // ""')
  if [ "${state}" = "success" ]; then
    dev_sha="${sha}"
    break
  fi
done
[ -n "${dev_sha}" ] || fail "These files were never deployed to DEV and found healthy. Merge DEV-BCMTOOLS into PROD-BCMTOOLS only after Deploy DEV is green."
echo "Same files as DEV commit ${dev_sha}."
echo "dev_sha=${dev_sha}" >> "${GITHUB_OUTPUT}"
