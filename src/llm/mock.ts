import type {
  AnalyticsConfig,
  Architecture,
  AssetSpec,
  AudioDesign,
  BalanceReport,
  BuildManifest,
  DeploymentConfig,
  GameTask,
  ImagePrompts,
  Requirements,
  ReviewReport,
  TaskPlan,
  TestReport,
} from '../types.js';
import type { CompletionRequest, LlmClient } from './types.js';

/**
 * Offline client. Produces a coherent set of artifacts for a small arcade
 * "asteroid dodger" so the entire pipeline — and a genuinely runnable game —
 * can be exercised without an API key. Deterministic by design.
 */
export class MockClient implements LlmClient {
  readonly mode = 'mock' as const;
  readonly model = 'mock';

  async complete(req: CompletionRequest): Promise<string> {
    switch (req.agentId) {
      case 'pm':
        return json(requirements(req.context.idea));
      case 'architect':
        return json(architecture);
      case 'planner':
        return json(taskPlan);
      case 'gameplay':
        return gameplayCode(req.payload as GameTask | undefined);
      case 'ui':
        return hudCode;
      case 'assetspec':
        return json(assetSpec);
      case 'imageprompt':
        return json(imagePrompts);
      case 'audio':
        return json(audio);
      case 'review':
        return json(review);
      case 'fixer':
        return fixerCode(req.payload);
      case 'tester':
        return json(testReport);
      case 'balance':
        return json(balance);
      case 'builder':
        return json(buildManifest);
      case 'deployment':
        return json(deployment);
      case 'analytics':
        return json(analytics);
      default:
        return '{}';
    }
  }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function requirements(idea: string): Requirements {
  return {
    genre: 'Arcade / Reflex',
    core_loop:
      'Steer the ship left and right to dodge falling asteroids; survive as long as possible while the score climbs.',
    player_goal: `Survive the asteroid field and beat your high score. (Idea: ${idea})`,
    mechanics: [
      'horizontal ship movement',
      'timed asteroid spawning',
      'collision detection',
      'score-over-time',
      'difficulty ramp',
      'lives system',
    ],
    features: ['start menu', 'HUD with score and lives', 'game over screen', 'local high score'],
    platform: 'web',
    multiplayer: false,
    complexity: 'low',
  };
}

const architecture: Architecture = {
  engine: 'pixi',
  language: 'typescript',
  structure: {
    modules: [
      'core/GameLoop',
      'entities/Ship',
      'entities/Asteroid',
      'systems/Spawner',
      'systems/Collision',
      'state/GameStore',
    ],
    core_classes: ['GameLoop', 'Ship', 'Asteroid', 'Spawner', 'CollisionSystem', 'GameStore'],
    data_flow: [
      'input -> Ship.velocity',
      'GameLoop.tick -> Spawner -> Asteroid[]',
      'CollisionSystem -> GameStore (lives, score)',
      'GameStore.subscribe -> Hud render',
    ],
  },
  state_management: 'Single in-memory GameStore with a subscribe() observer list',
  rendering_strategy: 'requestAnimationFrame loop drawing each entity to the stage every frame',
  networking: 'none (single-player, fully offline)',
};

const taskPlan: TaskPlan = {
  tasks: [
    { id: 't1', name: 'Game loop', type: 'code', dependency: [], description: 'requestAnimationFrame loop exposing update(dt) and render() hooks.' },
    { id: 't2', name: 'Ship entity', type: 'code', dependency: ['t1'], description: 'Player ship with keyboard movement clamped to screen bounds.' },
    { id: 't3', name: 'Asteroid entity', type: 'code', dependency: ['t1'], description: 'Falling asteroid with velocity and off-screen disposal.' },
    { id: 't4', name: 'Spawner system', type: 'code', dependency: ['t3'], description: 'Time-based asteroid spawner with a difficulty ramp.' },
    { id: 't5', name: 'Collision system', type: 'code', dependency: ['t2', 't3'], description: 'Circle-vs-rect collision between ship and asteroids.' },
    { id: 't6', name: 'Game store', type: 'code', dependency: [], description: 'Score, lives and phase state with subscribe().' },
    { id: 't7', name: 'Sprite assets', type: 'asset', dependency: [], description: 'Ship, asteroid and starfield sprites.' },
    { id: 't8', name: 'Build config', type: 'config', dependency: [], description: 'Vite + TypeScript project configuration.' },
  ],
};

const assetSpec: AssetSpec = {
  sprites: [
    { name: 'ship', description: 'Small triangular player ship, cyan with a thruster glow, top-down view.' },
    { name: 'asteroid', description: 'Grey cratered rock, roughly circular, several size variants.' },
    { name: 'background', description: 'Dark space starfield with subtle parallax stars.' },
  ],
  animations: [
    { name: 'thruster', description: 'Looping flame flicker behind the ship.', frames: 4 },
    { name: 'explosion', description: 'Asteroid impact burst.', frames: 6 },
  ],
  audio: [
    { name: 'impact', description: 'Short crunchy collision hit.', type: 'sfx' },
    { name: 'ambient', description: 'Low droning space ambience loop.', type: 'music' },
  ],
  effects: [
    { name: 'screenshake', description: 'Brief camera shake on collision.' },
    { name: 'particle-trail', description: 'Particle trail behind the ship thruster.' },
  ],
};

const imagePrompts: ImagePrompts = {
  prompts: [
    { asset: 'ship', prompt: 'top-down minimalist cyan spaceship, triangular, neon thruster glow, flat vector game sprite, transparent background, centered, crisp edges' },
    { asset: 'asteroid', prompt: 'top-down grey cratered asteroid, circular silhouette, subtle rim light, flat vector game sprite, transparent background' },
    { asset: 'background', prompt: 'dark deep-space starfield, scattered small stars, faint nebula, seamless tileable, subtle parallax depth, game background' },
  ],
};

const audio: AudioDesign = {
  music: [
    { name: 'ambient', description: 'Sparse droning synth pad, tense but calm.', mood: 'tense-ambient', tempo: 'slow' },
  ],
  sfx: [
    { name: 'impact', description: 'Punchy low-frequency crunch.', trigger: 'ship hits asteroid' },
    { name: 'tick', description: 'Soft blip each survived second.', trigger: 'score increment' },
  ],
};

const review: ReviewReport = {
  issues: [
    { file: 'src/modules/t4.ts', problem: 'Spawn interval can reach zero, flooding the screen.', severity: 'medium', fix: 'Clamp the minimum spawn interval to ~250ms.' },
    { file: 'src/modules/t5.ts', problem: 'Collision uses bounding boxes only; corners over-trigger.', severity: 'low', fix: 'Use a circle-vs-rect test for the asteroid.' },
  ],
};

const testReport: TestReport = {
  bugs_found: ['Difficulty ramps slightly too fast after 60s.'],
  playability_score: 82,
  critical_failures: [],
};

const balance: BalanceReport = {
  fun_score: 78,
  issues: ['Reward feedback is thin once the score climbs.', 'No mid-run goal beyond survival.'],
  suggested_adjustments: ['Add a combo multiplier for near-misses.', 'Introduce a power-up every 30 seconds.'],
};

const deployment: DeploymentConfig = {
  build_command: 'npm run build',
  hosting: 'Static host (Netlify / Vercel / GitHub Pages)',
  cdn_assets: ['/assets/ship.png', '/assets/asteroid.png', '/assets/background.png'],
  env_vars: [],
};

const analytics: AnalyticsConfig = {
  events: ['game_start', 'asteroid_dodged', 'collision', 'game_over', 'new_high_score'],
  funnels: ['menu -> game_start -> first_collision -> game_over'],
  retention_metrics: ['D1 retention', 'sessions per user', 'average run duration'],
};

function gameplayCode(task: GameTask | undefined): string {
  const id = task?.id ?? 'tX';
  const snippet = GAMEPLAY_SNIPPETS[id];
  if (snippet) return snippet;
  return `// ${task?.name ?? 'Module'} (${id})\n// ${task?.description ?? ''}\nexport {};\n`;
}

function fixerCode(payload: unknown): string {
  const p = payload as { contents?: string } | undefined;
  return p?.contents ?? 'export {};\n';
}

const GAMEPLAY_SNIPPETS: Record<string, string> = {
  t1: `// Game loop — requestAnimationFrame with fixed update + render hooks.
export type Updatable = (dtMs: number) => void;
export type Renderable = () => void;

export class GameLoop {
  private last = 0;
  private rafId = 0;
  private running = false;

  constructor(private readonly update: Updatable, private readonly render: Renderable) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(now - this.last, 50);
      this.last = now;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
`,
  t2: `// Ship entity — horizontal movement clamped to screen bounds.
export class Ship {
  width = 34;
  height = 30;
  speed = 0.45; // px per ms
  private dir = 0;

  constructor(public x: number, public y: number, private readonly maxX: number) {}

  setDirection(dir: -1 | 0 | 1): void {
    this.dir = dir;
  }

  update(dtMs: number): void {
    this.x += this.dir * this.speed * dtMs;
    this.x = Math.max(this.width / 2, Math.min(this.maxX - this.width / 2, this.x));
  }
}
`,
  t3: `// Asteroid entity — falls down the screen, flagged dead when off-screen.
export class Asteroid {
  dead = false;
  constructor(
    public x: number,
    public y: number,
    public radius: number,
    private readonly speed: number,
    private readonly maxY: number,
  ) {}

  update(dtMs: number): void {
    this.y += this.speed * dtMs;
    if (this.y - this.radius > this.maxY) this.dead = true;
  }
}
`,
  t4: `// Spawner — time-based asteroid spawning with a difficulty ramp.
import { Asteroid } from './t3.js';

export class Spawner {
  private elapsed = 0;
  private timer = 0;

  constructor(private readonly width: number, private readonly height: number) {}

  update(dtMs: number, out: Asteroid[]): void {
    this.elapsed += dtMs;
    this.timer += dtMs;
    const interval = Math.max(250, 900 - this.elapsed / 80); // ramps, clamped
    if (this.timer >= interval) {
      this.timer = 0;
      const radius = 10 + Math.random() * 16;
      const x = radius + Math.random() * (this.width - radius * 2);
      const speed = 0.12 + Math.random() * 0.18 + this.elapsed / 200000;
      out.push(new Asteroid(x, -radius, radius, speed, this.height));
    }
  }
}
`,
  t5: `// Collision — circle (asteroid) vs rectangle (ship) overlap test.
import type { Ship } from './t2.js';
import type { Asteroid } from './t3.js';

export class CollisionSystem {
  hits(ship: Ship, asteroid: Asteroid): boolean {
    const halfW = ship.width / 2;
    const halfH = ship.height / 2;
    const nearestX = Math.max(ship.x - halfW, Math.min(asteroid.x, ship.x + halfW));
    const nearestY = Math.max(ship.y - halfH, Math.min(asteroid.y, ship.y + halfH));
    const dx = asteroid.x - nearestX;
    const dy = asteroid.y - nearestY;
    return dx * dx + dy * dy <= asteroid.radius * asteroid.radius;
  }
}
`,
  t6: `// Game store — score, lives and phase with a tiny observer list.
export type Phase = 'menu' | 'playing' | 'gameover';

export interface GameState {
  phase: Phase;
  score: number;
  lives: number;
  highScore: number;
}

type Listener = (state: GameState) => void;

export class GameStore {
  private state: GameState;
  private listeners: Listener[] = [];

  constructor(highScore = 0) {
    this.state = { phase: 'menu', score: 0, lives: 3, highScore };
  }

  get(): Readonly<GameState> {
    return this.state;
  }

  set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
}
`,
};

const hudCode = `// HUD — minimal DOM overlay bound to the GameStore.
import type { GameStore } from '../modules/t6.js';

export class Hud {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement, store: GameStore) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    parent.appendChild(this.root);
    store.subscribe((s) => this.render(s.score, s.lives, s.highScore));
    const s = store.get();
    this.render(s.score, s.lives, s.highScore);
  }

  private render(score: number, lives: number, high: number): void {
    this.root.innerHTML =
      '<span>Score: ' + score + '</span>' +
      '<span>Lives: ' + '♥'.repeat(Math.max(0, lives)) + '</span>' +
      '<span>Best: ' + high + '</span>';
  }
}
`;

const PLAYABLE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Asteroid Dodger</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #05060d; color: #cfe9ff; font-family: ui-monospace, monospace;
         display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; }
  h1 { font-size: 18px; letter-spacing: 2px; opacity: .8; margin: 8px 0 0; }
  canvas { background: #05060d; border: 1px solid #1b2a44; border-radius: 8px; touch-action: none; }
  .hint { opacity: .6; font-size: 12px; }
</style>
</head>
<body>
<h1>ASTEROID DODGER</h1>
<canvas id="game" width="480" height="640"></canvas>
<div class="hint">← → or A / D to move &nbsp;·&nbsp; Space to start / restart</div>
<script>
(() => {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const HS_KEY = 'asteroid-dodger-highscore';

  let phase = 'menu';            // 'menu' | 'playing' | 'gameover'
  let score = 0, lives = 3;
  let high = Number(localStorage.getItem(HS_KEY) || 0);
  let ship, asteroids, spawnTimer, elapsed, invuln, dir = 0;

  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.9,
  }));

  function reset() {
    score = 0; lives = 3; elapsed = 0; spawnTimer = 0; invuln = 0;
    ship = { x: W / 2, y: H - 60, w: 34, h: 30, speed: 0.45 };
    asteroids = [];
  }

  function spawn() {
    const r = 10 + Math.random() * 16;
    asteroids.push({
      x: r + Math.random() * (W - r * 2), y: -r, r,
      vy: 0.12 + Math.random() * 0.18 + elapsed / 200000,
    });
  }

  function hit(a) {
    const hw = ship.w / 2, hh = ship.h / 2;
    const nx = Math.max(ship.x - hw, Math.min(a.x, ship.x + hw));
    const ny = Math.max(ship.y - hh, Math.min(a.y, ship.y + hh));
    const dx = a.x - nx, dy = a.y - ny;
    return dx * dx + dy * dy <= a.r * a.r;
  }

  function update(dt) {
    for (const s of stars) { s.y += s.z * 0.05 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
    if (phase !== 'playing') return;

    elapsed += dt;
    score += dt * 0.01;
    if (invuln > 0) invuln -= dt;

    ship.x += dir * ship.speed * dt;
    ship.x = Math.max(ship.w / 2, Math.min(W - ship.w / 2, ship.x));

    spawnTimer += dt;
    const interval = Math.max(250, 900 - elapsed / 80);
    if (spawnTimer >= interval) { spawnTimer = 0; spawn(); }

    for (const a of asteroids) a.y += a.vy * dt;
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      if (a.y - a.r > H) { asteroids.splice(i, 1); continue; }
      if (invuln <= 0 && hit(a)) {
        asteroids.splice(i, 1);
        lives -= 1; invuln = 1000;
        if (lives <= 0) {
          phase = 'gameover';
          const final = Math.floor(score);
          if (final > high) { high = final; localStorage.setItem(HS_KEY, String(high)); }
        }
      }
    }
  }

  function drawShip() {
    const blink = invuln > 0 && Math.floor(invuln / 100) % 2 === 0;
    ctx.fillStyle = blink ? '#33506e' : '#46e6ff';
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y - ship.h / 2);
    ctx.lineTo(ship.x + ship.w / 2, ship.y + ship.h / 2);
    ctx.lineTo(ship.x - ship.w / 2, ship.y + ship.h / 2);
    ctx.closePath();
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#9fb4d8';
    for (const s of stars) { ctx.globalAlpha = s.z; ctx.fillRect(s.x, s.y, s.z * 1.6, s.z * 1.6); }
    ctx.globalAlpha = 1;

    if (phase === 'playing' || phase === 'gameover') {
      ctx.fillStyle = '#8b8f99';
      for (const a of asteroids) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill(); }
      drawShip();
      ctx.fillStyle = '#cfe9ff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Score ' + Math.floor(score), 12, 24);
      ctx.fillText('Best ' + high, 12, 44);
      ctx.textAlign = 'right';
      ctx.fillText('♥'.repeat(Math.max(0, lives)), W - 12, 24);
    }

    if (phase !== 'playing') {
      ctx.fillStyle = 'rgba(5,6,13,.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#46e6ff';
      ctx.textAlign = 'center';
      ctx.font = '28px monospace';
      ctx.fillText(phase === 'menu' ? 'ASTEROID DODGER' : 'GAME OVER', W / 2, H / 2 - 20);
      ctx.fillStyle = '#cfe9ff';
      ctx.font = '15px monospace';
      if (phase === 'gameover') ctx.fillText('Score ' + Math.floor(score) + '  ·  Best ' + high, W / 2, H / 2 + 12);
      ctx.fillText('Press Space to ' + (phase === 'menu' ? 'start' : 'play again'), W / 2, H / 2 + 44);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 50); last = now;
    update(dt); render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function start() { reset(); phase = 'playing'; }
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') dir = -1;
    else if (e.key === 'ArrowRight' || e.key === 'd') dir = 1;
    else if (e.code === 'Space') { if (phase !== 'playing') start(); }
  });
  addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(e.key)) dir = 0;
  });
  // Pointer support for touch / mouse.
  cv.addEventListener('pointerdown', (e) => {
    if (phase !== 'playing') { start(); return; }
    dir = e.offsetX < W / 2 ? -1 : 1;
  });
  cv.addEventListener('pointerup', () => (dir = 0));
})();
</script>
</body>
</html>
`;

const buildManifest: BuildManifest = {
  files: [
    { path: 'index.html', contents: PLAYABLE_HTML },
    {
      path: 'package.json',
      contents: json({
        name: 'asteroid-dodger',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { 'pixi.js': '^8.0.0' },
        devDependencies: { typescript: '^5.7.0', vite: '^5.4.0' },
      }) + '\n',
    },
    {
      path: 'tsconfig.json',
      contents: json({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          skipLibCheck: true,
          lib: ['ES2022', 'DOM'],
        },
        include: ['src'],
      }) + '\n',
    },
    {
      path: 'README.md',
      contents:
        '# Asteroid Dodger\n\n' +
        'A tiny arcade game generated by the AI Game Factory.\n\n' +
        '## Play now\n\n' +
        'Open `index.html` directly in any browser — it is a zero-dependency canvas build.\n\n' +
        '## Modular build\n\n' +
        'The `src/` modules are the structured TypeScript implementation following the\n' +
        'generated architecture. To run that version:\n\n' +
        '```bash\nnpm install\nnpx vite\n```\n',
    },
  ],
  entry: 'index.html',
  dependencies: [
    { name: 'pixi.js', version: '^8.0.0' },
    { name: 'vite', version: '^5.4.0' },
    { name: 'typescript', version: '^5.7.0' },
  ],
  instructions:
    'Open index.html directly to play the zero-dependency canvas build. For the modular Pixi build: npm install && npx vite.',
};
