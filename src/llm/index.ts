import { AnthropicClient } from './anthropic.js';
import { MockClient } from './mock.js';
import type { LlmClient } from './types.js';

export type { CompletionRequest, LlmClient } from './types.js';

export interface ClientOptions {
  /** Force offline mock mode regardless of credentials. */
  mock?: boolean;
  /** Override the model id for the live client. */
  model?: string;
}

/**
 * Pick a client. Falls back to the offline mock when no API key is configured
 * so the factory always runs, and reports why.
 */
export function createClient(opts: ClientOptions = {}): LlmClient {
  const forceMock = opts.mock || process.env.FACTORY_MOCK === '1';
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (forceMock || !hasKey) {
    return new MockClient();
  }
  const model = opts.model || process.env.FACTORY_MODEL || 'claude-opus-4-8';
  return new AnthropicClient(model);
}
