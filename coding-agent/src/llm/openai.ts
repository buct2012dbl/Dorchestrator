import OpenAI from 'openai';
import type { LLMProvider, StreamChunk, StreamParams, ModelCapabilities } from './provider.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  models = [
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k'
  ];

  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *streamText(params: StreamParams): AsyncIterable<StreamChunk> {
    const messages: any[] = [];

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }

    messages.push(...params.messages);

    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature || 0.7,
      max_tokens: params.maxTokens || 8000,
      tools: params.tools as any,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield {
          type: 'text',
          content: delta.content
        };
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.function) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: toolCall.id || '',
                name: toolCall.function.name || '',
                arguments: toolCall.function.arguments || ''
              }
            };
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        yield { type: 'done' };
      }
    }
  }

  countTokens(text: string, _model: string): number {
    // Use tiktoken for accurate counting
    return Math.ceil(text.length / 4);
  }

  getCapabilities(model: string): ModelCapabilities {
    const is32k = model.includes('32k');
    const is16k = model.includes('16k');
    const isTurbo = model.includes('turbo');

    let maxContextWindow = 8192;
    if (is32k) maxContextWindow = 32768;
    else if (is16k) maxContextWindow = 16384;
    else if (isTurbo) maxContextWindow = 128000;

    return {
      maxContextWindow,
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: model.includes('gpt-4')
    };
  }
}
