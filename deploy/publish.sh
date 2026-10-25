#!/usr/bin/env bash
# Build and push dist/ to the gh-pages branch. No history kept: Pages only
# needs the latest build, and the sources live on main.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
remote="$(git remote get-url origin)"
tmp="$(mktemp -d)"
cp -R dist/. "$tmp"
cd "$tmp"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@dropbots.local" commit -q -m "deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f -q "$remote" gh-pages
cd - >/dev/null
rm -rf "$tmp"
echo "published gh-pages"
