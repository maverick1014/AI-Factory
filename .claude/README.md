# AI Game Factory — Claude Code mode

This directory turns the factory into a **Claude Code subagent workflow**, so
you can run the whole 15-agent pipeline **on your Claude Pro/Max subscription —
no Anthropic API key, no GPT, no extra billing.**

It's an alternative front-end to the same pipeline as the TypeScript CLI; here
Claude Code itself is the runtime.

## Usage

Open this repo in Claude Code (CLI, VS Code, or JetBrains) and run:

```
/build-game A cozy farming game where you grow glowing mushrooms
```

The `/build-game` command ([commands/build-game.md](commands/build-game.md))
acts as the **Build Orchestrator**: it creates a fresh run directory under
`generated/`, then delegates each stage to its subagent in dependency order,
passing each output forward via files. When it finishes you get the same layout
as the CLI:

```
generated/<run>/
├── artifacts/   # one JSON file per agent
├── game/        # generated source + runnable scaffolding
└── report.md    # summary
```

## The subagents

Each file in [`agents/`](agents/) is one stage of the pipeline, carrying the
verbatim agent prompt plus an explicit input/output file contract:

| Subagent | Stage |
|----------|-------|
| `gf-pm` | Product Manager → requirements |
| `gf-architect` | System Architect → architecture |
| `gf-planner` | Task Planner → tasks |
| `gf-assets` | Asset Spec |
| `gf-image-prompts` | Image Prompt Engineering |
| `gf-audio` | Audio Design |
| `gf-gameplay` | Gameplay Code (one module per code task) |
| `gf-ui` | UI / HUD |
| `gf-review` | Code Review |
| `gf-fix` | Auto-Fix |
| `gf-builder` | Build Orchestrator (browser scaffolding) |
| `gf-tester` | Game Testing |
| `gf-balance` | Fun / Balance |
| `gf-deploy` | Deployment |
| `gf-analytics` | Analytics |

Each subagent runs in its **own isolated context** and hands off through the
run directory's files, mirroring how the TypeScript orchestrator threads a
shared `RunContext`.

## When to use which front-end

| | TypeScript CLI (`src/`) | Claude Code subagents (`.claude/`) |
|---|---|---|
| Runtime | Anthropic API (`ANTHROPIC_API_KEY`) | Claude Code on your Pro/Max plan |
| Cost | Pay-as-you-go API usage | Covered by your subscription |
| Run with | `npx tsx src/index.ts --idea "..."` | `/build-game <idea>` in Claude Code |
| Best for | automation / scripting / CI | interactive use without API billing |

Both produce the same kind of output.
