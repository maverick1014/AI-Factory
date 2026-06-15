#!/usr/bin/env node
/**
 * Arcade launcher generator.
 *
 * Scans the output root for generated games (each `generated/<run>/game/
 * index.html`), reads each run's metadata, and writes a single self-contained
 * `arcade.html` menu: a grid of every game with a "Play" action that opens the
 * game in-place, plus a persistent "← Back to menu" bar on every game screen.
 *
 * Run directly:  tsx src/arcade.ts [--out generated]
 * Or imported:   buildArcade('generated')
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { log } from './util/logger.js';

export interface ArcadeGame {
  id: string;
  title: string;
  genre: string;
  engine: string;
  idea: string;
  playability: number | null;
  fun: number | null;
  path: string;
  mtime: number;
}

export async function buildArcade(root = 'generated'): Promise<{ path: string; count: number }> {
  const games = await collectGames(root);
  const outPath = join(root, 'arcade.html');
  await writeFile(outPath, renderArcade(games), 'utf8');
  return { path: outPath, count: games.length };
}

async function collectGames(root: string): Promise<ArcadeGame[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const games: ArcadeGame[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runDir = join(root, entry.name);
    const indexPath = join(runDir, 'game', 'index.html');
    if (!existsSync(indexPath)) continue; // only directly-playable games

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let meta: any = {};
    const runJson = join(runDir, 'run.json');
    if (existsSync(runJson)) {
      try {
        meta = JSON.parse(await readFile(runJson, 'utf8'));
      } catch {
        /* ignore malformed run.json */
      }
    }

    let mtime = 0;
    try {
      mtime = (await stat(indexPath)).mtimeMs;
    } catch {
      /* ignore */
    }

    games.push({
      id: entry.name,
      title: titleOf(meta, entry.name),
      genre: typeof meta?.requirements?.genre === 'string' ? meta.requirements.genre : 'Game',
      engine: typeof meta?.architecture?.engine === 'string' ? meta.architecture.engine : '',
      idea: typeof meta?.idea === 'string' ? meta.idea : '',
      playability: numOrNull(meta?.testReport?.playability_score),
      fun: numOrNull(meta?.balance?.fun_score),
      path: `${entry.name}/game/index.html`,
      mtime,
    });
  }

  games.sort((a, b) => b.mtime - a.mtime);
  return games;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function titleOf(meta: any, id: string): string {
  const idea = typeof meta?.idea === 'string' ? meta.idea.trim() : '';
  if (idea) return idea.length > 70 ? idea.slice(0, 67) + '…' : idea;
  return prettifyId(id);
}

function prettifyId(id: string): string {
  const noStamp = id.replace(/-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '');
  const words = noStamp.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function renderArcade(games: ArcadeGame[]): string {
  const data = JSON.stringify(games).replace(/</g, '\\u003c');
  return ARCADE_HTML.replace('/*__GAMES__*/null', data);
}

const ARCADE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI Game Factory — Arcade</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: radial-gradient(1200px 600px at 50% -10%, #14233f 0%, #05060d 60%);
         color: #cfe9ff; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  header { padding: 28px 24px 8px; text-align: center; }
  header h1 { margin: 0; font-size: 26px; letter-spacing: 3px; }
  header p { margin: 6px 0 0; opacity: .6; font-size: 13px; }
  main { padding: 20px clamp(16px, 4vw, 48px) 60px; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); max-width: 1100px; margin: 0 auto; }
  .card { background: #0c1426; border: 1px solid #1b2a44; border-radius: 12px; padding: 16px; display: flex; flex-direction: column;
          gap: 10px; transition: transform .12s ease, border-color .12s ease; cursor: pointer; }
  .card:hover { transform: translateY(-3px); border-color: #46e6ff66; }
  .card h3 { margin: 0; font-size: 16px; line-height: 1.3; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #14233f; border: 1px solid #24375c; opacity: .9; }
  .idea { font-size: 12px; opacity: .55; line-height: 1.4; flex: 1; }
  .scores { display: flex; gap: 14px; font-size: 12px; opacity: .8; }
  .play { margin-top: 4px; align-self: flex-start; background: #46e6ff; color: #04121c; border: none; font-weight: 700;
          padding: 8px 16px; border-radius: 8px; cursor: pointer; }
  .play:hover { background: #6fefff; }
  .empty { text-align: center; opacity: .6; max-width: 460px; margin: 60px auto; line-height: 1.6; }
  code { background: #0c1426; border: 1px solid #1b2a44; border-radius: 5px; padding: 1px 6px; font-size: 12px; }

  #player { position: fixed; inset: 0; background: #05060d; display: none; flex-direction: column; z-index: 10; }
  #player.open { display: flex; }
  .bar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: #0c1426; border-bottom: 1px solid #1b2a44; }
  .bar button { background: #14233f; color: #cfe9ff; border: 1px solid #24375c; border-radius: 8px; padding: 8px 14px;
                font-weight: 600; cursor: pointer; font-size: 14px; }
  .bar button:hover { border-color: #46e6ff; color: #fff; }
  .bar .now { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar a { color: #46e6ff; font-size: 13px; text-decoration: none; opacity: .85; }
  .bar a:hover { opacity: 1; }
  iframe { flex: 1; width: 100%; border: 0; background: #05060d; }
</style>
</head>
<body>
<header>
  <h1>🕹️ AI GAME FACTORY — ARCADE</h1>
  <p id="subtitle"></p>
</header>
<main>
  <div id="grid" class="grid"></div>
  <div id="empty" class="empty" hidden>
    No games yet. Generate one with <code>npm run demo</code> or <code>/build-game &lt;idea&gt;</code>,
    then refresh this page.
  </div>
</main>

<section id="player" aria-hidden="true">
  <div class="bar">
    <button id="back" type="button">← Back to menu</button>
    <span class="now" id="now"></span>
    <a id="open" href="#" target="_blank" rel="noopener">Open in new tab ↗</a>
  </div>
  <iframe id="frame" title="game" allow="autoplay; gamepad; fullscreen"></iframe>
</section>

<script>
const GAMES = /*__GAMES__*/null || [];

const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const subtitle = document.getElementById('subtitle');
const player = document.getElementById('player');
const frame = document.getElementById('frame');
const now = document.getElementById('now');
const openLink = document.getElementById('open');

subtitle.textContent = GAMES.length
  ? GAMES.length + (GAMES.length === 1 ? ' game' : ' games') + ' ready to play'
  : '';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function card(game) {
  const el = document.createElement('div');
  el.className = 'card';
  const chips = [game.genre, game.engine].filter(Boolean)
    .map((c) => '<span class="chip">' + esc(c) + '</span>').join('');
  const scores = [];
  if (game.playability != null) scores.push('🎮 ' + game.playability + '/100');
  if (game.fun != null) scores.push('✨ ' + game.fun + '/100');
  el.innerHTML =
    '<h3>' + esc(game.title) + '</h3>' +
    '<div class="chips">' + chips + '</div>' +
    (game.idea ? '<div class="idea">' + esc(game.idea) + '</div>' : '<div class="idea"></div>') +
    (scores.length ? '<div class="scores">' + scores.map((s) => '<span>' + s + '</span>').join('') + '</div>' : '') +
    '<button class="play" type="button">▶ Play</button>';
  el.addEventListener('click', () => play(game));
  return el;
}

function play(game) {
  frame.src = game.path;
  now.textContent = game.title;
  openLink.href = game.path;
  player.classList.add('open');
  player.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => frame.focus(), 0);
}

function backToMenu() {
  player.classList.remove('open');
  player.setAttribute('aria-hidden', 'true');
  frame.src = 'about:blank'; // stop the running game
  document.body.style.overflow = '';
}

document.getElementById('back').addEventListener('click', backToMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && player.classList.contains('open')) backToMenu();
});

if (GAMES.length === 0) {
  empty.hidden = false;
} else {
  for (const game of GAMES) grid.appendChild(card(game));
}
</script>
</body>
</html>
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let out = 'generated';
  const i = args.findIndex((a) => a === '--out' || a === '-o');
  if (i !== -1 && args[i + 1]) out = args[i + 1]!;

  const { path, count } = await buildArcade(out);
  log.success(`Arcade built: ${path} (${count} game${count === 1 ? '' : 's'})`);
  log.info(`Open ${path} in your browser to play.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
