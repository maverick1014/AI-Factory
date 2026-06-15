#!/usr/bin/env node
/**
 * AI Game Factory — CLI.
 *
 * Usage:
 *   ai-game-factory --idea "A roguelike where you play a sentient teapot"
 *   ai-game-factory "A 2D platformer about a delivery drone" --out builds
 *   ai-game-factory --idea "..." --mock        # offline, no API key needed
 */

import { existsSync } from 'node:fs';

import { GameFactory } from './factory.js';
import { createClient } from './llm/index.js';
import { log } from './util/logger.js';

interface Cli {
  idea?: string;
  out: string;
  name?: string;
  mock: boolean;
  model?: string;
  maxCodeTasks?: number;
  help: boolean;
}

function parseArgs(argv: string[]): Cli {
  const cli: Cli = { out: 'generated', mock: false, help: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '-h':
      case '--help':
        cli.help = true;
        break;
      case '--mock':
        cli.mock = true;
        break;
      case '-i':
      case '--idea':
        cli.idea = argv[++i];
        break;
      case '-o':
      case '--out':
        cli.out = argv[++i] ?? cli.out;
        break;
      case '--name':
        cli.name = argv[++i];
        break;
      case '--model':
        cli.model = argv[++i];
        break;
      case '--max-code-tasks':
        cli.maxCodeTasks = Number(argv[++i]);
        break;
      default:
        if (arg.startsWith('-')) {
          log.warn(`unknown flag: ${arg}`);
        } else {
          positional.push(arg);
        }
    }
  }

  if (!cli.idea && positional.length > 0) {
    cli.idea = positional.join(' ');
  }
  return cli;
}

const USAGE = `AI Game Factory — turn a game idea into a structured, buildable web game.

Usage:
  ai-game-factory --idea "<your game idea>" [options]
  ai-game-factory "<your game idea>" [options]

Options:
  -i, --idea <text>        The game idea to produce.
  -o, --out <dir>          Output root directory (default: generated).
      --name <slug>        Override the run folder name.
      --mock               Force offline mock mode (no API key required).
      --model <id>         Model id for live mode (default: claude-opus-4-8).
      --max-code-tasks <n> Cap gameplay code tasks generated (default: 8).
  -h, --help               Show this help.

Environment:
  ANTHROPIC_API_KEY        Required for live runs. Without it the factory
                           automatically falls back to mock mode.
  FACTORY_MODEL            Default model override.
  FACTORY_MOCK=1           Force mock mode.
`;

async function main(): Promise<void> {
  // Load .env if present (Node >= 20.6 / 21.7+ built-in; guarded for older).
  if (existsSync('.env') && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile('.env');
    } catch {
      /* ignore malformed .env */
    }
  }

  const cli = parseArgs(process.argv.slice(2));

  if (cli.help) {
    console.log(USAGE);
    return;
  }
  if (!cli.idea || cli.idea.trim().length === 0) {
    console.log(USAGE);
    log.error('No game idea provided. Pass --idea "<text>".');
    process.exitCode = 1;
    return;
  }

  const client = createClient({ mock: cli.mock, model: cli.model });
  if (client.mode === 'mock' && !cli.mock && process.env.FACTORY_MOCK !== '1') {
    log.warn('ANTHROPIC_API_KEY not set — running in offline mock mode.');
  }

  const factory = new GameFactory({
    idea: cli.idea.trim(),
    client,
    outDir: cli.out,
    name: cli.name,
    maxCodeTasks: cli.maxCodeTasks,
  });

  const result = await factory.run();
  log.info(`Open ${result.runDir}/report.md for a summary.`);
}

main().catch((err) => {
  log.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exitCode = 1;
});
