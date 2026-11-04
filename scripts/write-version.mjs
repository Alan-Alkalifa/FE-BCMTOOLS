// Writes public/version.json before the build, so the deployed app serves /version.json with the
// commit it was built from (the deploy workflows wait for it). APP_VERSION is set by CI and the
// Docker build; Vercel's own builds give VERCEL_GIT_COMMIT_SHA.
import { writeFileSync } from 'node:fs'

const version = process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev'
writeFileSync(new URL('../public/version.json', import.meta.url), `${JSON.stringify({ version })}\n`)
console.log(`version.json: ${version}`)
