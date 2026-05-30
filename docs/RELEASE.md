# Releasing Pickwright

Releases are cut manually via the **Release** GitHub Actions workflow
(`.github/workflows/release.yml`). It builds Chrome + Firefox packages, signs
the Firefox build via AMO, and publishes a GitHub Release — but only after the
E2E suite passes.

## One-time setup

Add these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value | Where to get it |
|--------|-------|-----------------|
| `AMO_JWT_ISSUER` | AMO API key (JWT issuer) | https://addons.mozilla.org/developers/addon/api/key/ |
| `AMO_JWT_SECRET` | AMO API secret | same page (shown once on generation) |

> Until these exist, trigger the workflow with **`firefox_sign = false`** to ship
> an unsigned Firefox zip. `GITHUB_TOKEN` is provided automatically.

The Firefox add-on identity (`browser_specific_settings.gecko.id`) lives in
`src/manifest.json`. The `unlisted` signing channel auto-registers it with AMO
on first sign — no manual listing step required.

## Cutting a release

1. Go to **Actions → Release → Run workflow**.
2. Fill in the inputs:
   - **version** — e.g. `0.1.0` (a leading `v` is stripped automatically)
   - **release_branch** — defaults to `master`
   - **firefox_sign** — `true` once AMO secrets are set, otherwise `false`
3. Run it. The workflow will:
   - run the E2E suite (gate — release is skipped if it fails)
   - sync the version into `package.json` + `src/manifest.json`
   - build `dist/` (Chrome) and `dist-firefox/` (Firefox) with per-browser manifests
   - zip both, and AMO-sign the Firefox build into a `.xpi`
   - commit the version bump back to the branch and push tag `v<version>`
   - create a GitHub Release with the Chrome zip, Firefox zip, and signed `.xpi`

## Notes

- If `master` has branch protection blocking direct pushes, allow the
  `github-actions[bot]` to push, or the version-bump commit step will fail.
- Local build equivalents: `npm run build:chrome`, `npm run build:firefox`,
  `npm run set-version <version>`.
