/**
 * Shared domain types for the AI Game Factory.
 *
 * Each interface mirrors the machine-readable output contract of one agent in
 * the pipeline (see src/agents/prompts.ts for the verbatim agent prompts).
 */

export type Complexity = 'low' | 'medium' | 'high';
export type Engine = 'phaser' | 'pixi' | 'three';
export type TaskType = 'code' | 'asset' | 'config';
export type Severity = 'low' | 'medium' | 'high';

/** 1. Product Manager Agent */
export interface Requirements {
  genre: string;
  core_loop: string;
  player_goal: string;
  mechanics: string[];
  features: string[];
  platform: string;
  multiplayer: boolean;
  complexity: Complexity;
}

/** 2. System Architect Agent */
export interface Architecture {
  engine: Engine;
  language: string;
  structure: {
    modules: string[];
    core_classes: string[];
    data_flow: string[];
  };
  state_management: string;
  rendering_strategy: string;
  networking: string;
}

/** 3. Task Planner Agent */
export interface GameTask {
  id: string;
  name: string;
  type: TaskType;
  dependency: string[];
  description: string;
}
export interface TaskPlan {
  tasks: GameTask[];
}

/** 6. Asset Spec Agent */
export interface NamedAsset {
  name: string;
  description: string;
}
export interface AnimationAsset extends NamedAsset {
  frames?: number;
}
export interface AudioAsset extends NamedAsset {
  type?: string;
}
export interface AssetSpec {
  sprites: NamedAsset[];
  animations: AnimationAsset[];
  audio: AudioAsset[];
  effects: NamedAsset[];
}

/** 7. Image Prompt Agent */
export interface ImagePrompt {
  asset: string;
  prompt: string;
}
export interface ImagePrompts {
  prompts: ImagePrompt[];
}

/** 8. Audio Agent */
export interface MusicTrack {
  name: string;
  description: string;
  mood?: string;
  tempo?: string;
}
export interface SfxCue {
  name: string;
  description: string;
  trigger?: string;
}
export interface AudioDesign {
  music: MusicTrack[];
  sfx: SfxCue[];
}

/** 9. Code Review Agent */
export interface ReviewIssue {
  file: string;
  problem: string;
  severity: Severity;
  fix: string;
}
export interface ReviewReport {
  issues: ReviewIssue[];
}

/** 11. Tester Agent */
export interface TestReport {
  bugs_found: string[];
  playability_score: number;
  critical_failures: string[];
}

/** 12. Fun / Balance Agent */
export interface BalanceReport {
  fun_score: number;
  issues: string[];
  suggested_adjustments: string[];
}

/** 13. Builder Agent */
export interface BuildFile {
  path: string;
  contents: string;
}
export interface Dependency {
  name: string;
  version: string;
}
export interface BuildManifest {
  files: BuildFile[];
  entry: string;
  dependencies: Dependency[];
  instructions: string;
}

/** 14. Deployment Agent */
export interface DeploymentConfig {
  build_command: string;
  hosting: string;
  cdn_assets: string[];
  env_vars: string[];
}

/** 15. Analytics Agent */
export interface AnalyticsConfig {
  events: string[];
  funnels: string[];
  retention_metrics: string[];
}

/** A source file produced by a code-generating agent (gameplay / UI / fixer). */
export interface GeneratedFile {
  path: string;
  contents: string;
  source: 'gameplay' | 'ui' | 'builder' | 'fixer';
  taskId?: string;
}

/** The full set of artifacts accumulated across a factory run. */
export interface RunContext {
  idea: string;
  requirements?: Requirements;
  architecture?: Architecture;
  tasks?: TaskPlan;
  assets?: AssetSpec;
  imagePrompts?: ImagePrompts;
  audio?: AudioDesign;
  codeFiles: GeneratedFile[];
  review?: ReviewReport;
  testReport?: TestReport;
  balance?: BalanceReport;
  build?: BuildManifest;
  deployment?: DeploymentConfig;
  analytics?: AnalyticsConfig;
}
