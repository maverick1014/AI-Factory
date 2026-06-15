import Anthropic from '@anthropic-ai/sdk';

import type { CompletionRequest, LlmClient } from './types.js';

/**
 * Live client backed by the Anthropic Messages API.
 *
 * Uses adaptive thinking and the effort parameter per agent, and structured
 * output (`output_config.format`) for JSON agents. Every request is streamed
 * and reassembled with `finalMessage()` — this sidesteps non-streaming request
 * timeouts entirely and works with both thinking and structured outputs. Params
 * are built loosely-typed so the wrapper keeps working across SDK minor versions.
 */
export class AnthropicClient implements LlmClient {
  readonly mode = 'live' as const;
  private readonly client: Anthropic;

  constructor(readonly model = 'claude-opus-4-8') {
    this.client = new Anthropic();
  }

  async complete(req: CompletionRequest): Promise<string> {
    const outputConfig: Record<string, unknown> = { effort: req.effort };
    if (req.schema) {
      outputConfig.format = { type: 'json_schema', schema: req.schema };
    }

    const params = {
      model: this.model,
      max_tokens: req.maxTokens,
      thinking: { type: 'adaptive' },
      output_config: outputConfig,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const stream = this.client.messages.stream(params);
    const message = await stream.finalMessage();
    return textOf(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(message: any): string {
  const blocks: any[] = message?.content ?? [];
  return blocks
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n')
    .trim();
}
