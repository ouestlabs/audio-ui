#!/usr/bin/env bash
# PostToolUse: format the one file Claude just wrote. Formatter and import
# sorting only: the linter would strip an import whose usage lands in the next edit.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc | *.css) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" && bunx biome check --write --linter-enabled=false \
  --no-errors-on-unmatched "$file" >/dev/null 2>&1
exit 0
