<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project workflow

- After each small, self-contained change, run the checks appropriate to it, then commit
  and push it to GitHub. This is the owner's standing authorization for commits and pushes
  in this project; do not ask again for each change.
- Keep each commit coherent and working. Do not commit unfinished edits or failing checks.
- Commit only changes belonging to the current task; preserve unrelated user work.
- Use the repository's existing GitHub author identity when no local identity is configured.
- Do not force-push. If a push is rejected, inspect the remote changes and integrate safely.
- New feature proposals outside the approved task still require the owner's approval.
