# Vendored from databricks-solutions/solution-builder

Upstream: https://github.com/databricks-solutions/solution-builder
Commit:   711fa032b676c2023f7d239a8c1ebabda8ded508
Committed: 2026-08-19T12:51:59-07:00
Copied:   2026-08-24 (shallow clone)

Licensed under the **DB license** — see `LICENSE` here, and `NOTICE.md` for upstream
third-party attributions. That licence permits copying/modifying/redistributing for use
within or connecting to the Databricks Services (this is a Databricks App), and requires
that a copy of the licence travels with it, that modified files say so prominently, and
that attribution notices are retained. Hence this directory.

## Files taken as-is

| File | Upstream path | Used for |
|---|---|---|
| `architecture-viewer.html` | `.claude/skills/databricks-architecture/renderer/architecture-viewer.html` | The self-contained @xyflow/react architecture renderer (built by upstream's `scripts/build-arch-standalone.sh` from `app/src/demo_prompt_generator/ui/components/project/platform-diagram`). Reads its diagram from an inline `<script type="application/json" id="architecture">` block. |
| `render-arch.mjs` | same directory | Upstream's headless PNG render loop. Kept for reference; not used at runtime. |
| `LICENSE`, `NOTICE.md` | repo root | Licence + third-party attributions. |

**This directory is the pristine copy — nothing here is edited.** `scripts/build-arch.mjs`
reads `architecture-viewer.html` from here, swaps in `arch/isaac-supervisor.arch.json` plus a
self-hosted `@font-face` for DM Sans, and writes the result to `app/static/arch/` with a
"modified" banner at the top of the generated file.

## Files adapted (modified copies, marked in their own headers)

| Our file | Upstream path | Change |
|---|---|---|
| `client/src/architecture/Flow.tsx` | `.claude/skills/databricks-solution-builder/app/app_template/client/src/architecture/Flow.tsx` | Stage/Connector/Fork/FlowKeyframes kept; added `Join`, `Return`, and an optional `label` on `Connector`. |
| `client/src/architecture/icons.tsx` | `…/app_template/client/src/architecture/icons.tsx` (+ `AgentLoopFlow.tsx` for `OperatorIcon`) | Kept SOLID/LIGHT, AgentBricksIcon, AppsIcon, AgentsIcon, OperatorIcon; added new two-tone glyphs for the rig (channel, poller browser, cmux pane, project agents, standby pool, mail, phone, pulse). |
| `app/server.mjs` | `…/app_template/server/lib/user.ts`, `server/lib/auth.ts`, `server/routes/config.ts` | Identity logic ported to zero-dependency Node (see "Zero runtime npm dependencies" in the main README for why no Express/appkit). |
