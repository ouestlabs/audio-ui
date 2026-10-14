@../AGENTS.md

## Claude Code

Everything above applies as is; this part covers only what is specific to Claude Code.

- **Skills**: the workflow skills in `.claude/skills/` load on their own when a task matches. The repo's canonical copy lives there; `.agents/skills` is a symlink to it for other agents.
- **Format hook**: after every Edit/Write, `.claude/hooks/format.sh` formats that one file with Biome and sorts its imports. It runs the formatter only, never the linter, so an import you add before the code that uses it survives. Lint fixes (unused imports and the rest) happen when you run `bun run lint:fix` at the end.
- **Browser checks**: use the Playwright MCP tools to look at a page or a component on the dev server (:4000).
- **Next.js**: `apps/www/CLAUDE.md` loads the bundled Next.js docs index when you work in `apps/www`; what you remember about Next.js may be out of date for this version.
