import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, StreamChunk, StreamParams, ModelCapabilities } from './provider.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  models = [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];

  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *streamText(params: StreamParams): AsyncIterable<StreamChunk> {
    const messages = params.messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content
    }));

    const stream = await this.client.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens || 8000,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: messages as any,
      tools: params.tools as any
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: event.delta.text
          };
        }
      } else if (event.type === 'message_stop') {
        yield { type: 'done' };
      }
    }
  }

  countTokens(text: string, _model: string): number {
    // Anthropic doesn't provide a tokenizer, use approximation
    return Math.ceil(text.length / 4);
  }

  getCapabilities(model: string): ModelCapabilities {
    const isOpus = model.includes('opus');
    const isSonnet = model.includes('sonnet');

    return {
      maxContextWindow: isOpus || isSonnet ? 200000 : 100000,
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: true
    };
  }
}
