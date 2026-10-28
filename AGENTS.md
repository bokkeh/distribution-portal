## Imported Claude Cowork project instructions

## Project-specific deployment target

- This repository is `https://github.com/bokkeh/distribution-portal.git`.
- Production deploys from the `master` branch to the Vercel project `alex-6771s-projects/distribution-portal`.
- Use this deployment mapping only for this `distribution-portal` workspace; do not reuse it for other projects.

## Confirmed Vercel identity and deployment verification

- User reconfirmed the intended project from a screenshot on 2026-10-27: `https://vercel.com/alex-6771s-projects/distribution-portal`.
- Project ID: `prj_zTRrJvyzsm5AnnRfp41rLaJqrK5l`; team ID: `team_wUEjIsiSNqDRGcvEoBVwSJab`.
- A separate `alex-terrys-projects-d07f6914/distribution-portal` project also receives repository builds. It is NOT this workspace's production target. Do not change its environment or treat its build result as the intended portal's result.
- Both projects can publish the GitHub context `Vercel – distribution-portal`. Inspect all statuses for the exact released commit and require a success whose target URL starts with `https://vercel.com/alex-6771s-projects/distribution-portal/`. A latest-context result alone may refer to the other project.
- Connector or CLI access to the intended team can fail even while its GitHub integration deploys successfully. Do not switch projects to work around an access error. Use verified GitHub deployment/status evidence, and distinguish successful deployment from authenticated UI testing.
- Keep deployment facts and remaining stakeholder decisions in `docs/PROJECT_KNOWLEDGE.md`; keep this knowledge scoped to this repository. Never store credentials in these notes.
