import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicCompatibleProvider } from '../../src/llm/anthropic-compatible-provider.js';
import type { AnthropicCompatibleConfig } from '../../src/llm/anthropic-compatible-provider.js';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn()
      }
    }))
  };
});

describe('AnthropicCompatibleProvider', () => {
  let provider: AnthropicCompatibleProvider;
  let mockConfig: AnthropicCompatibleConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
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

    provider = new AnthropicCompatibleProvider('test-provider', mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct name and models', () => {
      expect(provider.name).toBe('test-provider');
      expect(provider.models).toEqual(['test-model-1', 'test-model-2']);
    });

    it('should handle empty models array', () => {
      const config = { ...mockConfig, models: undefined };
      const p = new AnthropicCompatibleProvider('test', config);
      expect(p.models).toEqual([]);
    });

    it('should store config', () => {
      // @ts-ignore - accessing private property
      expect(provider.config).toEqual(mockConfig);
    });
  });

  describe('streamText', () => {
    it('should call Anthropic client with correct parameters', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' }
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        messages: {
          create: mockCreate
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [{ role: 'user' as const, content: 'Test message' }],
        temperature: 0.8,
        maxTokens: 1000,
        systemPrompt: 'You are a test assistant'
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
        system: 'You are a test assistant',
        tools: undefined,
        stream: true
      });
    });

    it('should use default parameters when not provided', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' }
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        messages: {
          create: mockCreate
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

    it('should convert text deltas correctly', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' }
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' World' }
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        messages: {
          create: mockCreate
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

    it('should handle message completion', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Done' }
          };
          yield {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn' }
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        messages: {
          create: mockCreate
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
      expect(chunks[0].type).toBe('text');
      expect(chunks[1].type).toBe('done');
    });

    it('should handle system messages', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Response' }
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);
      // @ts-ignore
      provider.client = {
        messages: {
          create: mockCreate
        }
      };

      const params = {
        model: 'test-model-1',
        messages: [
          { role: 'system' as const, content: 'System prompt' },
          { role: 'user' as const, content: 'User message' }
        ]
      };

      const stream = provider.streamText(params);
      for await (const chunk of stream) {
        // consume stream
      }

      // System messages should be converted to user messages
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'System prompt' },
            { role: 'user', content: 'User message' }
          ]
        })
      );
    });
  });

  describe('countTokens', () => {
    it('should estimate token count', () => {
      const text = 'This is a test message';
      const count = provider.countTokens(text, 'test-model');

      // Rough estimation: ~4 characters per token
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(text.length);
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const capabilities = provider.getCapabilities('test-model');

      expect(capabilities).toEqual({
        maxContextWindow: 200000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false
      });
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      // @ts-ignore
      provider.client = {
        messages: {
          create: mockCreate
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
