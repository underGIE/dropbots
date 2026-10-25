# Deploying

Today: a branch deploy. `npm run deploy` builds the site and pushes `dist/` to
the `gh-pages` branch; GitHub Pages serves it at https://undergie.github.io/dropbots/.

`github-pages.yml` is the Actions version (build + test on every push to main,
with the Supabase keys as repository secrets). It is parked here because the
`gh` token on this Mac has no `workflow` scope. To switch to it once:

```bash
gh auth refresh -h github.com -s workflow
```

then move the file back to `.github/workflows/deploy.yml`, push, and set
Settings → Pages → Source to "GitHub Actions".
