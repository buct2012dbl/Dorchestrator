import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, StreamChunk, StreamParams, ModelCapabilities } from './provider.js';

type SessionMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
};

function parseAnthropicToolInput(argumentsText: string): Record<string, unknown> {
  if (!argumentsText.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(argumentsText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw: argumentsText };
  }
}

function formatAnthropicMessages(messages: StreamParams['messages']): any[] {
  return (messages as SessionMessage[]).map(message => {
    if (message.role === 'tool') {
      if (!message.toolCallId) {
        return {
          role: 'user',
          content: message.content
        };
      }

      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content
          }
        ]
      };
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      const contentBlocks: any[] = [];

      if (message.content) {
        contentBlocks.push({
          type: 'text',
          text: message.content
        });
      }

      for (const toolCall of message.toolCalls) {
        contentBlocks.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: parseAnthropicToolInput(toolCall.arguments)
        });
      }

      return {
        role: 'assistant',
        content: contentBlocks
      };
    }

    return {
      role: message.role === 'system' ? 'user' : message.role,
      content: message.content
    };
  });
}

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
    const stream = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens || 8000,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: formatAnthropicMessages(params.messages) as any,
      tools: params.tools as any,
      stream: true
    });

    const toolCallsByBlock = new Map<number, { id: string; name: string }>();
    let emittedDone = false;

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        const input = event.content_block.input && Object.keys(event.content_block.input).length > 0
          ? JSON.stringify(event.content_block.input)
          : '';

        toolCallsByBlock.set(event.index, {
          id: event.content_block.id,
          name: event.content_block.name
        });

        yield {
          type: 'tool_call',
          toolCall: {
            id: event.content_block.id,
            name: event.content_block.name,
            arguments: input
          }
        };
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: event.delta.text
          };
        } else if (event.delta.type === 'input_json_delta') {
          const toolCall = toolCallsByBlock.get(event.index);
          yield {
            type: 'tool_call',
            toolCall: {
              id: toolCall?.id || '',
              name: toolCall?.name || '',
              arguments: event.delta.partial_json
            }
          };
        }
      } else if (event.type === 'message_stop') {
        emittedDone = true;
        yield { type: 'done' };
      }
    }

    if (!emittedDone) {
      yield { type: 'done' };
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
