/**
 * Pipeline orchestrator.
 *
 * Runs the 15 agents in dependency order, threading each agent's output into
 * the next, then writes every artifact and a runnable game project to disk.
 */

import { join } from 'node:path';

import { AGENTS, type AgentId } from './agents/index.js';
import { buildArcade } from './arcade.js';
import type { LlmClient } from './llm/index.js';
import type {
  Architecture,
  AssetSpec,
  AudioDesign,
  AnalyticsConfig,
  BalanceReport,
  BuildManifest,
  DeploymentConfig,
  GameTask,
  GeneratedFile,
  ImagePrompts,
  Requirements,
  ReviewIssue,
  ReviewReport,
  RunContext,
  TaskPlan,
  TestReport,
} from './types.js';
import { extractCode, extractJson } from './util/json.js';
import { slugify, writeJson, writeText } from './util/fsx.js';
import { log } from './util/logger.js';

export interface FactoryOptions {
  idea: string;
  client: LlmClient;
  outDir: string;
  name?: string;
  /** Cap the number of gameplay code tasks generated (cost/time control). */
  maxCodeTasks?: number;
}

export interface FactoryResult {
  runDir: string;
  mode: 'live' | 'mock';
  context: RunContext;
}

const TOTAL_STAGES = 15;

export class GameFactory {
  private readonly ctx: RunContext;
  private step = 0;

  constructor(private readonly opts: FactoryOptions) {
    this.ctx = { idea: opts.idea, codeFiles: [] };
  }

  async run(): Promise<FactoryResult> {
    const { idea, client } = this.opts;
    const runDir = join(this.opts.outDir, this.opts.name || `${slugify(idea)}-${stamp()}`);

    log.banner(`AI Game Factory  ·  ${client.mode.toUpperCase()} mode  ·  model: ${client.model}`);
    log.detail(`idea: ${idea}`);
    log.detail(`output: ${runDir}`);

    // 1. Product Manager (fatal — everything downstream needs requirements).
    this.ctx.requirements = await this.json<Requirements>(
      'pm',
      `Game idea:\n${idea}`,
    );
    log.detail(`genre: ${this.ctx.requirements.genre} · complexity: ${this.ctx.requirements.complexity}`);

    // 2. System Architect (fatal — code + build depend on it).
    this.ctx.architecture = await this.json<Architecture>(
      'architect',
      block('Requirements', this.ctx.requirements),
    );
    log.detail(`engine: ${this.ctx.architecture.engine}`);

    // 3. Task Planner.
    this.ctx.tasks = await this.optionalJson<TaskPlan>(
      'planner',
      [block('Requirements', this.ctx.requirements), block('Architecture', this.ctx.architecture)].join('\n\n'),
    );
    if (this.ctx.tasks) log.detail(`${this.ctx.tasks.tasks.length} tasks planned`);

    // 4. Asset Spec.
    this.ctx.assets = await this.optionalJson<AssetSpec>(
      'assetspec',
      block('Requirements', this.ctx.requirements),
    );

    // 5. Image Prompts (from assets).
    if (this.ctx.assets) {
      this.ctx.imagePrompts = await this.optionalJson<ImagePrompts>(
        'imageprompt',
        block('Assets', this.ctx.assets),
      );
    } else {
      this.skip('imageprompt', 'no asset spec available');
    }

    // 6. Audio.
    this.ctx.audio = await this.optionalJson<AudioDesign>(
      'audio',
      [block('Requirements', this.ctx.requirements), block('Assets', this.ctx.assets ?? {})].join('\n\n'),
    );

    // 7. Gameplay code (one call per code task).
    await this.generateGameplay();

    // 8. UI.
    await this.generateUi();

    // 9. Code Review.
    this.ctx.review = await this.reviewCode();

    // 10. Auto-Fix (files with medium/high issues).
    await this.applyFixes();

    // 11. Builder.
    this.ctx.build = await this.buildProject();

    // 12. Tester.
    this.ctx.testReport = await this.optionalJson<TestReport>(
      'tester',
      [
        block('Requirements', this.ctx.requirements),
        block('Architecture', this.ctx.architecture),
        block('Build instructions', this.ctx.build?.instructions ?? 'n/a'),
      ].join('\n\n'),
    );
    if (this.ctx.testReport) {
      this.ctx.testReport.playability_score = clampScore(this.ctx.testReport.playability_score);
      log.detail(`playability: ${this.ctx.testReport.playability_score}/100`);
    }

    // 13. Fun / Balance.
    this.ctx.balance = await this.optionalJson<BalanceReport>(
      'balance',
      block('Requirements', this.ctx.requirements),
    );
    if (this.ctx.balance) {
      this.ctx.balance.fun_score = clampScore(this.ctx.balance.fun_score);
      log.detail(`fun: ${this.ctx.balance.fun_score}/100`);
    }

    // 14. Deployment.
    this.ctx.deployment = await this.optionalJson<DeploymentConfig>(
      'deployment',
      [block('Architecture', this.ctx.architecture), block('Build instructions', this.ctx.build?.instructions ?? 'n/a')].join('\n\n'),
    );

    // 15. Analytics.
    this.ctx.analytics = await this.optionalJson<AnalyticsConfig>(
      'analytics',
      block('Requirements', this.ctx.requirements),
    );

    await this.writeArtifacts(runDir);

    // Refresh the arcade launcher so it lists every game generated so far.
    try {
      const arcade = await buildArcade(this.opts.outDir);
      log.success(`arcade updated: ${arcade.path} (${arcade.count} game${arcade.count === 1 ? '' : 's'})`);
    } catch (err) {
      log.warn(`arcade build skipped: ${errMsg(err)}`);
    }

    log.banner('Done.');
    return { runDir, mode: client.mode, context: this.ctx };
  }

  // ---- stages that need bespoke wiring -------------------------------------

  private async generateGameplay(): Promise<void> {
    const codeTasks = (this.ctx.tasks?.tasks ?? []).filter((t) => t.type === 'code');
    const limit = this.opts.maxCodeTasks ?? 8;
    const selected = codeTasks.slice(0, limit);

    if (selected.length === 0) {
      // No plan? Fall back to a single "core game" task so the pipeline still
      // produces gameplay code.
      selected.push({
        id: 'core',
        name: 'Core game',
        type: 'code',
        dependency: [],
        description: 'Single-file implementation of the core game loop and mechanics.',
      });
    }

    this.beginStep('gameplay', `generating ${selected.length} code module(s)`);
    for (const task of selected) {
      const path = `src/modules/${sanitizeId(task.id)}.ts`;
      const siblings = selected.map((t) => `src/modules/${sanitizeId(t.id)}.ts`);
      const user = [
        block('Architecture', this.ctx.architecture ?? {}),
        block('Task', task),
        `Target file: ${path}`,
        `Sibling modules you may import (ESM, use .js extensions): ${siblings.join(', ')}`,
      ].join('\n\n');
      try {
        const code = await this.code('gameplay', user, task);
        this.ctx.codeFiles.push({ path, contents: code, source: 'gameplay', taskId: task.id });
        log.detail(`+ ${path}`);
      } catch (err) {
        log.warn(`gameplay task ${task.id} failed: ${errMsg(err)}`);
      }
    }
  }

  private async generateUi(): Promise<void> {
    const user = [
      block('Requirements', this.ctx.requirements ?? {}),
      block('Architecture', this.ctx.architecture ?? {}),
      `Existing modules: ${this.ctx.codeFiles.map((f) => f.path).join(', ') || 'none'}`,
      'Target file: src/ui/Hud.ts',
    ].join('\n\n');
    try {
      this.beginStep('ui', 'generating HUD / menu');
      const code = await this.code('ui', user);
      this.ctx.codeFiles.push({ path: 'src/ui/Hud.ts', contents: code, source: 'ui' });
      log.detail('+ src/ui/Hud.ts');
    } catch (err) {
      log.warn(`ui generation failed: ${errMsg(err)}`);
    }
  }

  private async reviewCode(): Promise<ReviewReport | undefined> {
    if (this.ctx.codeFiles.length === 0) {
      this.skip('review', 'no code to review');
      return undefined;
    }
    const bundle = this.ctx.codeFiles
      .map((f) => `// FILE: ${f.path}\n${f.contents}`)
      .join('\n\n');
    const report = await this.optionalJson<ReviewReport>('review', block('Code', bundle, true));
    if (report) {
      const counts = countSeverity(report.issues);
      log.detail(`issues — high: ${counts.high}, medium: ${counts.medium}, low: ${counts.low}`);
    }
    return report;
  }

  private async applyFixes(): Promise<void> {
    const issues = this.ctx.review?.issues ?? [];
    const fixable = issues.filter((i) => i.severity === 'high' || i.severity === 'medium');
    if (fixable.length === 0) {
      this.skip('fixer', 'no medium/high issues');
      return;
    }
    const byFile = new Map<string, ReviewIssue[]>();
    for (const issue of fixable) {
      const file = this.matchFile(issue.file);
      if (!file) continue;
      const list = byFile.get(file.path) ?? [];
      list.push(issue);
      byFile.set(file.path, list);
    }
    if (byFile.size === 0) {
      this.skip('fixer', 'issues did not map to generated files');
      return;
    }
    this.beginStep('fixer', `fixing ${byFile.size} file(s)`);
    for (const [path, fileIssues] of byFile) {
      const file = this.ctx.codeFiles.find((f) => f.path === path)!;
      const user = [
        block('Issues', fileIssues),
        `// FILE: ${path}`,
        '```typescript',
        file.contents,
        '```',
      ].join('\n');
      try {
        const fixed = await this.code('fixer', user, { contents: file.contents, path, issues: fileIssues });
        file.contents = fixed;
        file.source = 'fixer';
        log.detail(`~ ${path}`);
      } catch (err) {
        log.warn(`fix for ${path} failed: ${errMsg(err)}`);
      }
    }
  }

  private async buildProject(): Promise<BuildManifest | undefined> {
    const fileList = this.ctx.codeFiles.map((f) => `- ${f.path}`).join('\n') || '(none)';
    const user = [
      block('Architecture', this.ctx.architecture ?? {}),
      `Already-generated source files (do not re-emit these, wire them up):\n${fileList}`,
      'Emit the scaffolding needed to run in a browser: an index.html entry, a package.json, a tsconfig.json, and any glue/bootstrap entry file that imports the modules above. Set "entry" to the file a developer opens or runs first.',
    ].join('\n\n');
    return this.optionalJson<BuildManifest>('builder', user);
  }

  // ---- artifact output -----------------------------------------------------

  private async writeArtifacts(runDir: string): Promise<void> {
    const a = (p: string) => `artifacts/${p}`;
    const writes: Array<Promise<void>> = [];
    const put = (rel: string, value: unknown) => {
      if (value !== undefined) writes.push(writeJson(runDir, rel, value));
    };

    put(a('requirements.json'), this.ctx.requirements);
    put(a('architecture.json'), this.ctx.architecture);
    put(a('tasks.json'), this.ctx.tasks);
    put(a('assets.json'), this.ctx.assets);
    put(a('image-prompts.json'), this.ctx.imagePrompts);
    put(a('audio.json'), this.ctx.audio);
    put(a('review.json'), this.ctx.review);
    put(a('test-report.json'), this.ctx.testReport);
    put(a('balance.json'), this.ctx.balance);
    put(a('deployment.json'), this.ctx.deployment);
    put(a('analytics.json'), this.ctx.analytics);

    // Game source files (gameplay + UI + fixer).
    for (const file of this.ctx.codeFiles) {
      writes.push(writeText(runDir, join('game', file.path), ensureTrailingNewline(file.contents)));
    }
    // Builder scaffolding.
    for (const file of this.ctx.build?.files ?? []) {
      writes.push(writeText(runDir, join('game', file.path), ensureTrailingNewline(file.contents)));
    }

    writes.push(writeJson(runDir, 'run.json', this.ctx));
    writes.push(writeText(runDir, 'report.md', this.renderReport()));

    await Promise.all(writes);
    log.success(`wrote ${writes.length} files to ${runDir}`);
  }

  private renderReport(): string {
    const r = this.ctx.requirements;
    const arch = this.ctx.architecture;
    const review = this.ctx.review;
    const counts = review ? countSeverity(review.issues) : { high: 0, medium: 0, low: 0 };
    const entry = this.ctx.build?.entry;

    const lines: string[] = [];
    lines.push(`# Production Report`, '');
    lines.push(`**Idea:** ${this.ctx.idea}`, '');
    lines.push(`**Mode:** ${this.opts.client.mode} (${this.opts.client.model})`, '');

    if (r) {
      lines.push(`## Concept`, '');
      lines.push(`- **Genre:** ${r.genre}`);
      lines.push(`- **Core loop:** ${r.core_loop}`);
      lines.push(`- **Player goal:** ${r.player_goal}`);
      lines.push(`- **Complexity:** ${r.complexity} · **Multiplayer:** ${r.multiplayer}`);
      lines.push(`- **Mechanics:** ${r.mechanics.join(', ')}`, '');
    }
    if (arch) {
      lines.push(`## Architecture`, '');
      lines.push(`- **Engine:** ${arch.engine} · **Language:** ${arch.language}`);
      lines.push(`- **State:** ${arch.state_management}`);
      lines.push(`- **Rendering:** ${arch.rendering_strategy}`, '');
    }

    lines.push(`## Production`, '');
    lines.push(`- **Tasks planned:** ${this.ctx.tasks?.tasks.length ?? 0}`);
    lines.push(`- **Source files generated:** ${this.ctx.codeFiles.length}`);
    lines.push(`- **Review issues:** ${counts.high} high · ${counts.medium} medium · ${counts.low} low`);
    if (this.ctx.testReport) lines.push(`- **Playability score:** ${this.ctx.testReport.playability_score}/100`);
    if (this.ctx.balance) lines.push(`- **Fun score:** ${this.ctx.balance.fun_score}/100`);
    if (this.ctx.deployment) lines.push(`- **Hosting:** ${this.ctx.deployment.hosting}`);
    lines.push('');

    lines.push(`## Run the game`, '');
    if (entry) {
      lines.push(`Entry point: \`game/${entry}\``);
    }
    lines.push('', '```bash', 'cd game', '# if an index.html was generated you can open it directly,', '# otherwise install and start the dev server:', 'npm install && npm run dev', '```', '');

    lines.push(`## Artifacts`, '');
    lines.push('- `artifacts/` — every agent output as JSON');
    lines.push('- `game/` — generated source + build scaffolding');
    lines.push('- `run.json` — full machine-readable run context');
    lines.push('');
    return lines.join('\n');
  }

  // ---- agent invocation primitives -----------------------------------------

  private async json<T>(id: AgentId, user: string): Promise<T> {
    this.beginStep(id);
    const value = await this.invokeJson<T>(id, user);
    log.success(`${AGENTS[id].name} ✓`);
    return value;
  }

  private async optionalJson<T>(id: AgentId, user: string): Promise<T | undefined> {
    this.beginStep(id);
    try {
      const value = await this.invokeJson<T>(id, user);
      log.success(`${AGENTS[id].name} ✓`);
      return value;
    } catch (err) {
      log.warn(`${AGENTS[id].name} skipped: ${errMsg(err)}`);
      return undefined;
    }
  }

  private async invokeJson<T>(id: AgentId, user: string): Promise<T> {
    const def = AGENTS[id];
    const raw = await this.opts.client.complete({
      agentId: id,
      system: def.system,
      user,
      maxTokens: def.maxTokens,
      effort: def.effort,
      schema: def.schema,
      context: this.ctx,
    });
    try {
      return extractJson<T>(raw);
    } catch {
      // One retry with an explicit "JSON only" nudge.
      const retry = await this.opts.client.complete({
        agentId: id,
        system: def.system,
        user: `${user}\n\nReturn ONLY valid JSON matching the required shape. No prose, no code fences.`,
        maxTokens: def.maxTokens,
        effort: def.effort,
        schema: def.schema,
        context: this.ctx,
      });
      return extractJson<T>(retry);
    }
  }

  private async code(id: AgentId, user: string, payload?: unknown): Promise<string> {
    const def = AGENTS[id];
    const raw = await this.opts.client.complete({
      agentId: id,
      system: def.system,
      user,
      maxTokens: def.maxTokens,
      effort: def.effort,
      context: this.ctx,
      payload,
    });
    return extractCode(raw);
  }

  // ---- helpers -------------------------------------------------------------

  private matchFile(reference: string): GeneratedFile | undefined {
    const exact = this.ctx.codeFiles.find((f) => f.path === reference);
    if (exact) return exact;
    const base = reference.split('/').pop();
    return this.ctx.codeFiles.find((f) => f.path.split('/').pop() === base);
  }

  private beginStep(id: AgentId, note?: string): void {
    this.step += 1;
    log.step(Math.min(this.step, TOTAL_STAGES), TOTAL_STAGES, `${AGENTS[id].name}${note ? ` — ${note}` : ''}`);
  }

  private skip(id: AgentId, reason: string): void {
    this.step += 1;
    log.step(Math.min(this.step, TOTAL_STAGES), TOTAL_STAGES, `${AGENTS[id].name} — skipped (${reason})`);
  }
}

// ---- module-level helpers --------------------------------------------------

function block(label: string, value: unknown, raw = false): string {
  const body = raw ? String(value) : JSON.stringify(value, null, 2);
  return `${label}:\n${body}`;
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'module';
}

function countSeverity(issues: ReviewIssue[]): { high: number; medium: number; low: number } {
  return {
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
  };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : text + '\n';
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}
