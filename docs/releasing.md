# Releasing

Each release is a version in `package.json`, an entry in
[CHANGELOG.md](../CHANGELOG.md), a git tag `vX.Y.Z` on `main`, and a GitHub
release with the same notes. There is no CI, so checks run locally first.

1. On the release branch, run the checks:
   ```bash
   npx tsc --noEmit && npm run lint && npm test
   PW_CHROMIUM_PATH=/path/to/chromium npm run test:e2e   # path optional on a normal machine
   ```
2. Bump `version` in `package.json` (and the two matching lines in
   `package-lock.json`): minor for new features, patch for fixes.
3. Add the version to the top of `CHANGELOG.md`: what golfers can now do, then
   what isn't real yet.
4. Merge to `main`, then tag the merge commit and publish the release:
   ```bash
   git tag -a v0.2.0 -m "v0.2.0" <merge-sha> && git push origin v0.2.0
   gh release create v0.2.0 --title "v0.2.0: the whole app" --notes-file notes.md
   ```
