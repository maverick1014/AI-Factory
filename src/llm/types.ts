import type { AgentId, Effort } from '../agents/index.js';
import type { RunContext } from '../types.js';

export interface CompletionRequest {
  agentId: AgentId;
  /** System prompt (global rule + agent prompt). */
  system: string;
  /** Rendered user message containing the concrete input for this agent. */
  user: string;
  maxTokens: number;
  effort: Effort;
  /** JSON schema for structured output, when the agent emits JSON. */
  schema?: Record<string, unknown>;
  /**
   * Structured input for this agent. Ignored by the live client; the mock
   * client uses it to synthesise coherent offline responses.
   */
  context: RunContext;
  /** Per-task payload for code agents (e.g. the gameplay task). */
  payload?: unknown;
}

export interface LlmClient {
  readonly mode: 'live' | 'mock';
  readonly model: string;
  complete(req: CompletionRequest): Promise<string>;
}
