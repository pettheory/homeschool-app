#!/usr/bin/env bash
# loop-runner.sh — launch a headless, autonomous Claude "loop" against ONE spec in an
# isolated git worktree, streaming progress to .loops/<loop>.stream.jsonl so an orchestrator
# session can tail it. The worktree lives OUTSIDE the repo (sibling dir) to avoid nesting.
#
# Usage: scripts/loop-runner.sh <loop> <slug> <base-branch>
#   <loop>  prompt template name under docs/loops/prompts/<loop>.txt  (e.g. build)
#   <slug>  spec slug under docs/specs/<slug>.md                      (e.g. nato-phonetic-letters)
#   <base>  branch/ref the worktree (and the loop's PR) is based on   (e.g. feat/foo)
set -uo pipefail
LOOP="${1:?loop name}"; SLUG="${2:?spec slug}"; BASE="${3:?base branch}"
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
WT="${ROOT}-loops/${SLUG}"
LOGDIR="$ROOT/.loops"; mkdir -p "$LOGDIR"
STREAM="$LOGDIR/${LOOP}.stream.jsonl"
DEPS="$LOGDIR/${LOOP}.deps.log"
PROMPT="$(sed "s|__SLUG__|$SLUG|g; s|__BASE__|$BASE|g" "$ROOT/docs/loops/prompts/${LOOP}.txt")"

: > "$STREAM"
log(){ echo "[runner] $*" >> "$STREAM"; }
log "loop=$LOOP slug=$SLUG base=$BASE"
log "preparing worktree at $WT"
git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
git -C "$ROOT" branch -D "feat/$SLUG" 2>/dev/null || true
if ! git -C "$ROOT" worktree add -b "feat/$SLUG" "$WT" "$BASE" >>"$STREAM" 2>&1; then
  log "FATAL: worktree add failed"; exit 1
fi
[ -f "$ROOT/.env" ] && cp "$ROOT/.env" "$WT/.env"
log "installing deps (see ${LOOP}.deps.log)"
( cd "$WT" && { npm ci || npm install; } ) >"$DEPS" 2>&1 || log "WARN: dependency install reported errors"
log "launching: claude -p (headless, --permission-mode bypassPermissions)"
( cd "$WT" && claude -p "$PROMPT" --output-format stream-json --verbose --permission-mode bypassPermissions ) >>"$STREAM" 2>&1
log "claude exited $?"
log "DONE"
