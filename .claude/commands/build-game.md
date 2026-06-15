---
description: Run the 15-agent AI Game Factory pipeline on a game idea (Claude-driven, no API key).
argument-hint: <game idea>
---

You are the **Build Orchestrator** for the AI Game Factory. Drive the full
15-stage pipeline for the game idea below by delegating each stage to its
dedicated subagent via the Task tool. This runs entirely on Claude Code — no
API key, no external services.

## Game idea
$ARGUMENTS

If the idea above is empty, ask the user for a one-line game idea and stop.

## Run directory
1. Make a slug from the idea (lowercase, hyphenated, ~40 chars) and a UTC
   timestamp, then create the run directory:
   ```
   generated/<slug>-<timestamp>/
     artifacts/
     game/src/modules/
     game/src/ui/
   ```
   Use a single `mkdir -p` (Bash). Call this path `RUN_DIR` and pass it to every
   subagent. Every subagent reads its inputs from and writes its outputs under
   `RUN_DIR`.

## Pipeline (run in this order)

Delegate each stage with the Task tool, setting the subagent to the name below
and telling it the exact `RUN_DIR`. Wait for a stage to finish before starting
one that depends on it. Stages with no dependency on each other may be spawned
in parallel (multiple Task calls in one message).

1. **gf-pm** — give it the game idea verbatim. Writes `artifacts/requirements.json`.
2. **gf-architect** — reads requirements. Writes `artifacts/architecture.json`.
3. **gf-planner** — reads requirements + architecture. Writes `artifacts/tasks.json`.
4. **gf-assets** — reads requirements. Writes `artifacts/assets.json`.
   *(4 may run in parallel with 3.)*
5. **gf-image-prompts** — reads assets. Writes `artifacts/image-prompts.json`.
6. **gf-audio** — reads requirements + assets. Writes `artifacts/audio.json`.
7. **gf-gameplay** — read `artifacts/tasks.json`, take the tasks with
   `"type": "code"` (cap at 6). For **each** code task, spawn `gf-gameplay` with
   that single task object and the target path `game/src/modules/<task.id>.ts`.
   Spawn them in parallel. Each writes one TypeScript module.
8. **gf-ui** — reads requirements + architecture, knows the module paths from
   step 7. Writes `game/src/ui/Hud.ts`.
9. **gf-review** — reads every file under `game/src/`. Writes `artifacts/review.json`.
10. **gf-fix** — for each `artifacts/review.json` issue with severity `high` or
    `medium`, spawn `gf-fix` on the referenced file. It overwrites the file with
    corrected code. Skip if there are no medium/high issues.
11. **gf-builder** — reads architecture + the list of files under `game/src/`.
    Writes the browser scaffolding into `game/` (`index.html`, `package.json`,
    `tsconfig.json`, `README.md`, and any entry/bootstrap file).
12. **gf-tester** — reads requirements + architecture + the build README. Writes
    `artifacts/test-report.json`.
13. **gf-balance** — reads requirements. Writes `artifacts/balance.json`.
14. **gf-deploy** — reads architecture + build README. Writes `artifacts/deployment.json`.
15. **gf-analytics** — reads requirements. Writes `artifacts/analytics.json`.
    *(12–15 are independent and may run in parallel.)*

## Finish
Write `RUN_DIR/report.md` summarizing: idea, genre, engine, task count, files
generated, review issue counts by severity, playability score, fun score, and
how to run the game. Then tell the user the `RUN_DIR` path and how to play
(open `game/index.html`, or `cd game && npm install && npm run dev` for a
modular build).

Keep your own commentary minimal — the subagents do the work and write the
artifacts; your job is orchestration and the final summary.
