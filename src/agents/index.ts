/**
 * Agent registry — binds each agent id to its prompt, output mode, generation
 * limits and (for JSON agents) the schema used for structured output.
 */

import { AGENT_PROMPTS, GLOBAL_RULE, type AgentId } from './prompts.js';
import {
  analyticsSchema,
  architectureSchema,
  assetSpecSchema,
  audioSchema,
  balanceSchema,
  buildSchema,
  deploymentSchema,
  imagePromptsSchema,
  requirementsSchema,
  reviewSchema,
  taskPlanSchema,
  testReportSchema,
} from './schemas.js';

export type { AgentId } from './prompts.js';
export type Effort = 'low' | 'medium' | 'high' | 'max';

export interface AgentDef {
  id: AgentId;
  /** Human-readable name for logs. */
  name: string;
  /** Whether the agent returns structured JSON or raw source code. */
  output: 'json' | 'code';
  /** Combined system prompt (global rule + agent prompt). */
  system: string;
  /** Token ceiling. Values above 16000 are streamed automatically. */
  maxTokens: number;
  /** Thinking/effort budget for the request. */
  effort: Effort;
  /** JSON schema for structured output (json agents only). */
  schema?: Record<string, unknown>;
}

function def(
  id: AgentId,
  name: string,
  output: 'json' | 'code',
  maxTokens: number,
  effort: Effort,
  schema?: Record<string, unknown>,
): AgentDef {
  return {
    id,
    name,
    output,
    maxTokens,
    effort,
    schema,
    system: `${GLOBAL_RULE}\n\n${AGENT_PROMPTS[id]}`,
  };
}

export const AGENTS: Record<AgentId, AgentDef> = {
  pm: def('pm', 'Product Manager', 'json', 16000, 'medium', requirementsSchema),
  architect: def('architect', 'System Architect', 'json', 16000, 'high', architectureSchema),
  planner: def('planner', 'Task Planner', 'json', 16000, 'high', taskPlanSchema),
  gameplay: def('gameplay', 'Gameplay Code', 'code', 24000, 'high'),
  ui: def('ui', 'UI', 'code', 24000, 'high'),
  assetspec: def('assetspec', 'Asset Spec', 'json', 16000, 'medium', assetSpecSchema),
  imageprompt: def('imageprompt', 'Image Prompt', 'json', 16000, 'medium', imagePromptsSchema),
  audio: def('audio', 'Audio Design', 'json', 16000, 'medium', audioSchema),
  review: def('review', 'Code Review', 'json', 16000, 'high', reviewSchema),
  fixer: def('fixer', 'Auto-Fix', 'code', 24000, 'high'),
  tester: def('tester', 'Tester', 'json', 16000, 'medium', testReportSchema),
  balance: def('balance', 'Fun / Balance', 'json', 16000, 'medium', balanceSchema),
  builder: def('builder', 'Build Orchestrator', 'json', 32000, 'high', buildSchema),
  deployment: def('deployment', 'Deployment', 'json', 16000, 'medium', deploymentSchema),
  analytics: def('analytics', 'Analytics', 'json', 16000, 'medium', analyticsSchema),
};
