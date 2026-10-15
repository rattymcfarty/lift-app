#!/bin/bash
# Push current branch of lift-app and lift-kb to EVERY configured remote
# (origin + any mirror you added with `git remote add backup <url>`).
set -euo pipefail
for r in lift-app lift-kb; do
  d="$HOME/lift/$r"
  [ -d "$d/.git" ] || { echo "skip $r"; continue; }
  for remote in $(git -C "$d" remote); do
    echo "== $r -> $remote"
    git -C "$d" push "$remote" HEAD
  done
done
