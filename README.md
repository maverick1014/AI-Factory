# AI Game Factory

An **AI-driven game production pipeline**. Give it a one-line game idea and a
chain of 15 specialized agents turns it into a structured, buildable web game —
requirements, architecture, a task plan, gameplay + UI code, asset/audio specs,
image prompts, a code review + auto-fix pass, playtest and balance reports, a
build manifest, and deployment + analytics configs.

Every agent emits **machine-readable output** that the next agent consumes,
exactly as in the design spec. The whole run is written to disk as JSON
artifacts plus a runnable `game/` project.

```
idea ──▶ PM ──▶ Architect ──▶ Planner ──▶ Asset Spec ──▶ Image Prompts
                                  │            │
                                  ▼            ▼
                             Gameplay×N      Audio
                                  │
                                  ▼
              UI ──▶ Review ──▶ Auto-Fix ──▶ Builder ──▶ Tester
                                                  │
                                                  ▼
                                   Balance ──▶ Deployment ──▶ Analytics
                                                  │
                                                  ▼
                                  artifacts/  +  game/  +  report.md
```

## Quick start

```bash
npm install

# Offline — no API key needed, generates a real playable demo game:
npm run demo

# Your own idea (offline mock):
npx tsx src/index.ts --mock --idea "A roguelike where you play a sentient teapot"

# Live mode (uses the Anthropic API):
export ANTHROPIC_API_KEY=sk-ant-...
npx tsx src/index.ts --idea "A 2D platformer about a delivery drone"
```

Output lands in `generated/<slug>-<timestamp>/`. Open `report.md` for a summary,
or `game/index.html` to play (in mock mode the demo game runs with zero install).

## How it works

The factory ([`src/factory.ts`](src/factory.ts)) runs the agents in dependency
order and threads each output into the next via a shared `RunContext`. Each
agent is just a system prompt + an output contract:

| # | Agent | Input | Output |
|---|-------|-------|--------|
| 1 | Product Manager | idea | requirements (genre, core loop, mechanics, …) |
| 2 | System Architect | requirements | engine, modules, classes, data flow |
| 3 | Task Planner | reqs + architecture | atomic build tasks |
| 4 | Asset Spec | requirements | sprites / animations / audio / effects |
| 5 | Image Prompt | assets | SDXL/Midjourney prompts |
| 6 | Audio Design | reqs + assets | music + SFX briefs |
| 7 | Gameplay Code | one task + architecture | TypeScript module (one per code task) |
| 8 | UI | reqs + architecture | HUD / menu / score code |
| 9 | Code Review | generated code | issues with severity + fix |
| 10 | Auto-Fix | code + issues | corrected code (medium/high issues) |
| 11 | Builder | code + architecture | folder structure, entry, dependency wiring |
| 12 | Tester | reqs + build | bugs, playability score |
| 13 | Fun / Balance | requirements | fun score, pacing adjustments |
| 14 | Deployment | architecture + build | build command, hosting, env vars |
| 15 | Analytics | requirements | events, funnels, retention metrics |

The verbatim agent prompts live in
[`src/agents/prompts.ts`](src/agents/prompts.ts); their output schemas (used for
structured JSON output) are in [`src/agents/schemas.ts`](src/agents/schemas.ts).

### Live vs. mock

- **Live mode** calls the Anthropic Messages API (`claude-opus-4-8` by default)
  with adaptive thinking, per-agent effort, structured outputs for the JSON
  agents, and streaming for the larger code/build responses. See
  [`src/llm/anthropic.ts`](src/llm/anthropic.ts).
- **Mock mode** ([`src/llm/mock.ts`](src/llm/mock.ts)) is fully offline and
  deterministic. It produces a coherent set of artifacts plus a genuinely
  **playable** zero-dependency canvas game (Asteroid Dodger), so the entire
  pipeline can be exercised — and demoed — without any credentials or network.

The factory falls back to mock automatically when `ANTHROPIC_API_KEY` is unset.

## Output layout

```
generated/<run>/
├── artifacts/            # every agent output as JSON
│   ├── requirements.json
│   ├── architecture.json
│   ├── tasks.json
│   ├── assets.json
│   ├── image-prompts.json
│   ├── audio.json
│   ├── review.json
│   ├── test-report.json
│   ├── balance.json
│   ├── deployment.json
│   └── analytics.json
├── game/                 # generated source + build scaffolding
│   ├── index.html        # entry (playable directly in mock mode)
│   ├── package.json
│   ├── src/modules/*.ts  # one module per gameplay code task
│   └── src/ui/Hud.ts
├── report.md             # human-readable summary
└── run.json              # full machine-readable run context
```

## CLI options

```
-i, --idea <text>        The game idea to produce.
-o, --out <dir>          Output root directory (default: generated).
    --name <slug>        Override the run folder name.
    --mock               Force offline mock mode (no API key required).
    --model <id>         Model id for live mode (default: claude-opus-4-8).
    --max-code-tasks <n> Cap gameplay code tasks generated (default: 8).
-h, --help               Show this help.
```

Environment: `ANTHROPIC_API_KEY` (required for live runs), `FACTORY_MODEL`
(default model override), `FACTORY_MOCK=1` (force mock).

## Scripts

| Script | Action |
|--------|--------|
| `npm run dev -- --idea "..."` | Run the factory via `tsx` (no build step). |
| `npm run demo` | Offline demo run (mock mode). |
| `npm run build` | Compile to `dist/`. |
| `npm run typecheck` | Type-check without emitting. |
| `npm start -- --idea "..."` | Run the compiled CLI. |
| `npm run clean` | Remove `dist/` and `generated/`. |

## Design notes

- **Faithful to the spec.** The 15 agent prompts are reproduced verbatim and
  prefixed with the shared global production rule.
- **Resilient.** Product Manager and System Architect are required; every other
  stage is best-effort — a single agent failing degrades the run rather than
  aborting it. JSON parsing tolerates fenced/sloppy output and retries once.
- **MVP-first.** A registry-driven agent runner keeps the orchestrator small;
  the pipeline wiring is explicit and easy to extend.

## Requirements

Node.js ≥ 20.6 (uses the built-in `.env` loader). Built with TypeScript and the
official `@anthropic-ai/sdk`.
