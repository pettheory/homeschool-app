#!/usr/bin/env bash
# ac-credential-helper.sh — a git credential helper that mints a short-lived GitHub
# installation token from Agent Central for pettheory/homeschool-app on demand.
#
# Secrets live in <git-common-dir>/ac/env (inside .git, never committed):
#     AC_HUB=https://<your-agent-central-host>
#     AC_BEARER=<the Agent Central session token>
#
# Wired per-repo with:
#   git config --local credential.helper ""        # drop inherited helpers
#   git config --local --add credential.helper "!bash <abs path>/scripts/ac-credential-helper.sh"
#
# Lifecycle: the AC session token (AC_BEARER) is short-lived. When it expires, git auth in
# this repo starts failing — request a fresh Agent Central session, get it approved, and
# rewrite <git-common-dir>/ac/env with the new AC_BEARER. The repo GRANT lasts longer than the
# session, so no new repo approval is needed until the grant expires.
#
# Outputs nothing on any failure, so a broken/expired session fails the git op loudly
# rather than silently falling back to the wrong GitHub account.
[ "$1" = "get" ] || exit 0
GD="$(git rev-parse --git-common-dir 2>/dev/null)" || exit 0
case "$GD" in /*) : ;; *) GD="$(cd "$GD" 2>/dev/null && pwd)" || exit 0 ;; esac
ENV="$GD/ac/env"
[ -f "$ENV" ] || exit 0
# shellcheck disable=SC1090
. "$ENV"
[ -n "${AC_HUB:-}" ] && [ -n "${AC_BEARER:-}" ] || exit 0
RESP="$(curl -sS -m 20 -X POST "$AC_HUB/v1/github/token?hub_key=homeschool-app" \
  -H "Authorization: Bearer $AC_BEARER" -H "Content-Type: application/json" \
  -d '{"repository":"pettheory/homeschool-app","permission_profile":"branch-and-pr-work"}' 2>/dev/null)" || exit 0
TOKEN="$(printf '%s' "$RESP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).token||"")}catch(e){}})' 2>/dev/null)"
[ -n "$TOKEN" ] || exit 0
printf 'username=x-access-token\npassword=%s\n' "$TOKEN"
