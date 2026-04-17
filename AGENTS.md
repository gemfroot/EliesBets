<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Ship loop (OpenClaw workspace)

- **GitHub `master`** is canonical; **`git push`** before assuming the Linux `dev` clone matches.
- After substantive edits: run **Claude Code via MCP** (`user-claude-code-bridge` → `claude_code`) as the default review step — see the parent workspace rule **`openclaw-claude-code-ship-loop.mdc`** when using the full `.openclaw-dev` tree.
- Drop-in review prompt: **`docs/CURSOR_TO_CLAUDE_REVIEW_PROMPT.txt`** (adapt paths/commits as needed).
- Linux check: **`./scripts/verify-linux.sh`** (or `SKIP_CI=1` if deps are fresh); optional **`npm run smoke:prod`** / **`npm run check:static`** for quick gates.

Use **`@Codebase`** or **`@Folder`** when changing Azuro/wagmi/sports chain code so edits stay scoped.
