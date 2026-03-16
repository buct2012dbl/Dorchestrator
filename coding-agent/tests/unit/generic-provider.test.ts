import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenericProvider } from '../../src/llm/generic-provider.js';
import type { GenericProviderConfig } from '../../src/config/schema.js';

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

describe('GenericProvider', () => {
  let provider: GenericProvider;
  let mockConfig: GenericProviderConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      type: 'openai-compatible',
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com/v1',
      models: ['test-model-1', 'test-model-2'],
      headers: {
        'X-Custom-Header': 'test-value'
      },
      defaultParams: {
        temperature: 0.7,
        maxTokens: 2000
      }
    };

    provider = new GenericProvider('test-provider', mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct name and models', () => {
      expect(provider.name).toBe('test-provider');
      expect(provider.models).toEqual(['test-model-1', 'test-model-2']);
    });

    it('should handle empty models array', () => {
      const config = { ...mockConfig, models: undefined };
      const p = new GenericProvider('test', config);
      expect(p.models).toEqual([]);
    });

    it('should store config', () => {
      // @ts-ignore - accessing private property
      expect(provider.config).toEqual(mockConfig);
    });
  });

  describe('streamText', () => {
    it('should call OpenAI client with correct parameters', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test message' }],
        temperature: 0.8,
        maxTokens: 1000
      };

      const stream = provider.streamText(params);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'test-model-1',
        messages: [{ role: 'user', content: 'Test message' }],
        temperature: 0.8,
        max_tokens: 1000,
        stream: true,
        tools: undefined
      });
    });

    it('should use default parameters when not provided', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      const stream = provider.streamText(params);
      for await (const chunk of stream) {
        // consume stream
      }

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 2000
        })
      );
    });

    it('should convert text chunks correctly', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: { content: ' World' },
              finish_reason: null
            }]
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      const stream = provider.streamText(params);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        type: 'text',
        content: 'Hello'
      });
      expect(chunks[1]).toEqual({
        type: 'text',
        content: ' World'
      });
    });

    it('should handle tool calls', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: {
                tool_calls: [{
                  id: 'call_123',
                  function: {
                    name: 'test_tool',
                    arguments: '{"arg": "value"}'
                  }
                }]
              },
              finish_reason: null
            }]
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{
          name: 'test_tool',
          description: 'A test tool',
          parameters: {}
        }]
      };

      const stream = provider.streamText(params);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({
        type: 'tool_call',
        toolCall: {
          id: 'call_123',
          name: 'test_tool',
          arguments: '{"arg": "value"}'
        }
      });
    });

    it('should handle empty chunks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [{
              delta: {},
              finish_reason: null
            }]
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      const stream = provider.streamText(params);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      // @ts-ignore
      provider.client = {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      await expect(async () => {
        const stream = provider.streamText(params);
        for await (const chunk of stream) {
          // consume stream
        }
      }).rejects.toThrow('API Error');
    });
  });

  describe('configuration', () => {
    it('should support custom headers', () => {
      expect(mockConfig.headers).toEqual({
        'X-Custom-Header': 'test-value'
      });
    });

    it('should support custom base URL', () => {
      expect(mockConfig.baseUrl).toBe('https://api.test.com/v1');
    });

    it('should support model list configuration', () => {
      expect(provider.models).toEqual(['test-model-1', 'test-model-2']);
    });
  });
});
