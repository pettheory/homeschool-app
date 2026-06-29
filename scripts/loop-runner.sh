#!/usr/bin/env bash
# loop-runner.sh — launch a headless Claude "loop" in an isolated git worktree, streaming
# progress to .loops/<loop>.stream.jsonl so an orchestrator session can tail it. The worktree
# lives OUTSIDE the repo (sibling dir) to avoid nesting.
#
# Usage: scripts/loop-runner.sh <loop> <target> <base-branch>
#   build  <slug> <base>   → new branch feat/<slug> off <base>, deps installed; implements the spec
#   review <pr#> <base>    → detached worktree on <base>; reviews PR #<pr#> via gh (no edits)
# The prompt template is docs/loops/prompts/<loop>.txt with __SLUG__/__TARGET__/__BASE__ filled in.
set -uo pipefail
LOOP="${1:?loop name}"; TARGET="${2:?target (spec slug or PR number)}"; BASE="${3:?base branch}"
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
SAFE="$(echo "$TARGET" | tr '/#' '--')"
WT="${ROOT}-loops/${LOOP}-${SAFE}"
LOGDIR="$ROOT/.loops"; mkdir -p "$LOGDIR"
STREAM="$LOGDIR/${LOOP}.stream.jsonl"; DEPS="$LOGDIR/${LOOP}.deps.log"
PROMPT="$(sed "s|__SLUG__|$TARGET|g; s|__TARGET__|$TARGET|g; s|__BASE__|$BASE|g" "$ROOT/docs/loops/prompts/${LOOP}.txt")"

: > "$STREAM"
log(){ echo "[runner] $*" >> "$STREAM"; }
log "loop=$LOOP target=$TARGET base=$BASE"
git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true

if [ "$LOOP" = "review" ]; then
  log "detached worktree on $BASE (read-only review)"
  git -C "$ROOT" fetch origin >>"$STREAM" 2>&1 || true
  git -C "$ROOT" worktree add --detach "$WT" "$BASE" >>"$STREAM" 2>&1 || { log "FATAL: worktree add failed"; exit 1; }
else
  log "preparing worktree at $WT (new branch feat/$TARGET off $BASE)"
  git -C "$ROOT" branch -D "feat/$TARGET" 2>/dev/null || true
  git -C "$ROOT" worktree add -b "feat/$TARGET" "$WT" "$BASE" >>"$STREAM" 2>&1 || { log "FATAL: worktree add failed"; exit 1; }
  [ -f "$ROOT/.env" ] && cp "$ROOT/.env" "$WT/.env"
  log "installing deps (see ${LOOP}.deps.log)"
  ( cd "$WT" && { npm ci || npm install; } ) >"$DEPS" 2>&1 || log "WARN: dependency install reported errors"
fi

log "launching: claude -p (headless, --permission-mode bypassPermissions)"
( cd "$WT" && claude -p "$PROMPT" --output-format stream-json --verbose --permission-mode bypassPermissions ) >>"$STREAM" 2>&1
log "claude exited $?"
log "DONE"
