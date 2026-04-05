import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicProvider } from '../../src/llm/anthropic.js';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn()
      }
    }))
  };
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider('test-api-key');
  });

  it('sends Anthropic-formatted tool messages to the SDK', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'message_stop'
        };
      }
    };

    const mockCreate = vi.fn().mockResolvedValue(mockStream);
    // @ts-expect-error test override
    provider.client = {
      messages: {
        create: mockCreate
      }
    };

    const params = {
      model: 'claude-sonnet-4-6',
      messages: [
        { role: 'user' as const, content: 'Inspect the file' },
        {
          role: 'assistant' as const,
          content: '',
          toolCalls: [
            {
              id: 'tool-1',
              name: 'read',
              arguments: '{"file_path":"src/index.ts"}'
            }
          ]
        },
        {
          role: 'tool' as const,
          content: '{"success":true,"data":"file body"}',
          toolCallId: 'tool-1'
        }
      ]
    };

    for await (const _chunk of provider.streamText(params as any)) {
      // consume
    }

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      temperature: 0.7,
      system: undefined,
      messages: [
        {
          role: 'user',
          content: 'Inspect the file'
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'read',
              input: {
                file_path: 'src/index.ts'
              }
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: '{"success":true,"data":"file body"}'
            }
          ]
        }
      ],
      tools: undefined,
      stream: true
    });
  });

  it('emits tool_call chunks from streamed tool_use events', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'content_block_start',
          index: 0,
          content_block: {
            type: 'tool_use',
            id: 'tool-1',
            name: 'bash',
            input: {}
          }
        };
        yield {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: '{"command":"ls'
          }
        };
        yield {
          type: 'content_block_delta',
          index: 0,
          delta: {
            type: 'input_json_delta',
            partial_json: ' -la"}'
          }
        };
        yield {
          type: 'message_stop'
        };
      }
    };

    const mockCreate = vi.fn().mockResolvedValue(mockStream);
    // @ts-expect-error test override
    provider.client = {
      messages: {
        create: mockCreate
      }
    };

    const chunks = [];
    for await (const chunk of provider.streamText({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'List files' }]
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        toolCall: {
          id: 'tool-1',
          name: 'bash',
          arguments: ''
        }
      },
      {
        type: 'tool_call',
        toolCall: {
          id: 'tool-1',
          name: 'bash',
          arguments: '{"command":"ls'
        }
      },
      {
        type: 'tool_call',
        toolCall: {
          id: 'tool-1',
          name: 'bash',
          arguments: ' -la"}'
        }
      },
      {
        type: 'done'
      }
    ]);
  });
});
