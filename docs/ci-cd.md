# CI/CD: DEV/name → DEV-BCMTOOLS → PROD-BCMTOOLS (frontend on Vercel)

The full guide, for both repos (setup of GitHub, Vercel, the servers and ngrok; releases,
hotfixes and rollbacks) is `docs/ci-cd.md` in **BE-BCMTOOLS**. This page is the frontend part.

| When | What happens | Workflow |
| --- | --- | --- |
| Pull request into DEV-BCMTOOLS or PROD-BCMTOOLS | `lint`, `typecheck`, `build`, `e2e`, `security`, `secrets` | `ci.yml` |
| Merge into DEV-BCMTOOLS | Vercel Preview; the DEV domain (`DEV_DOMAIN`) points at it; `/version.json` shows the commit; smoke tests against the real DEV backend; status `deploy-dev` | `deploy-dev.yml` → `vercel-deploy.yml` |
| Merge into PROD-BCMTOOLS | Gate (`scripts/ci/prod-gate.sh`), CI, Vercel production, smoke tests, tag + GitHub Release | `deploy-prod.yml` |
| Roll back | Vercel Instant Rollback | `rollback.yml` |

- Vercel's own Git deployments are off for DEV-BCMTOOLS and PROD-BCMTOOLS (`vercel.json`), so a
  commit reaches DEV or PROD only through these workflows, after CI. Pull requests from DEV/name
  branches still get Vercel's automatic previews.
- `middleware.ts` sends `/api/*` to `BACKEND_URL` (the environment's ngrok domain) with the
  header `x-bcm-edge-key` = `BACKEND_EDGE_KEY`; the backend's ngrok policy refuses calls without it.
- `npm run build` writes `public/version.json` (`APP_VERSION`, or Vercel's commit SHA) first.
- GitHub settings: repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
  `VERCEL_AUTOMATION_BYPASS_SECRET`; variables `PROD_APPROVERS`, `DEV_URL`, `DEV_DOMAIN`,
  `PROD_URL`, optional `VERCEL_CLI_VERSION` (default latest) and `NPM_AUDIT_BLOCKING`
  (`true` once `npm audit --omit=dev --audit-level=high` is clean: 5 high advisories on 4 Nov 2026,
  fixed by `npm audit fix` in its own pull request).
