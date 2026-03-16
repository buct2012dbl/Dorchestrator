import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRegistry } from '../../src/llm/provider.js';
import type { LLMProvider, StreamParams, StreamChunk } from '../../src/llm/provider.js';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let mockProvider: LLMProvider;

  beforeEach(() => {
    registry = new ProviderRegistry();

    mockProvider = {
      name: 'test-provider',
      models: ['test-model-1', 'test-model-2'],
      streamText: vi.fn(async function* () {
        yield { type: 'text', content: 'test' } as StreamChunk;
      }),
      countTokens: vi.fn(() => 10),
      getCapabilities: vi.fn(() => ({
        maxContextWindow: 100000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false
      }))
    };
  });

  describe('register', () => {
    it('should register provider', () => {
      registry.register(mockProvider);

      expect(registry.get('test-provider')).toBe(mockProvider);
    });

    it('should allow multiple providers', () => {
      const provider2 = { ...mockProvider, name: 'provider-2' };

      registry.register(mockProvider);
      registry.register(provider2);

      expect(registry.get('test-provider')).toBe(mockProvider);
      expect(registry.get('provider-2')).toBe(provider2);
    });

    it('should overwrite existing provider with same name', () => {
      const provider2 = { ...mockProvider, models: ['new-model'] };

      registry.register(mockProvider);
      registry.register(provider2);

      const retrieved = registry.get('test-provider');
      expect(retrieved?.models).toEqual(['new-model']);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(mockProvider);
    });

    it('should retrieve registered provider', () => {
      const provider = registry.get('test-provider');

      expect(provider).toBe(mockProvider);
    });

    it('should return undefined for non-existent provider', () => {
      const provider = registry.get('non-existent');

      expect(provider).toBeUndefined();
    });
  });

  describe('detectProvider', () => {
    beforeEach(() => {
      const anthropicProvider = { ...mockProvider, name: 'anthropic', models: ['claude-3-opus'] };
      const openaiProvider = { ...mockProvider, name: 'openai', models: ['gpt-4'] };
      const googleProvider = { ...mockProvider, name: 'google', models: ['gemini-pro'] };
      const ollamaProvider = { ...mockProvider, name: 'ollama', models: ['ollama/llama2'] };

      registry.register(anthropicProvider);
      registry.register(openaiProvider);
      registry.register(googleProvider);
      registry.register(ollamaProvider);
    });

    it('should detect Anthropic from model name', () => {
      const provider = registry.detectProvider('claude-3-opus');

      expect(provider?.name).toBe('anthropic');
    });

    it('should detect OpenAI from model name', () => {
      const provider = registry.detectProvider('gpt-4-turbo');

      expect(provider?.name).toBe('openai');
    });

    it('should detect Google from model name', () => {
      const provider = registry.detectProvider('gemini-pro');

      expect(provider?.name).toBe('google');
    });

    it('should detect Ollama from model name', () => {
      const provider = registry.detectProvider('ollama/llama2');

      expect(provider?.name).toBe('ollama');
    });

    it('should detect provider by model list', () => {
      const customProvider = { ...mockProvider, name: 'custom', models: ['custom-model-x'] };
      registry.register(customProvider);

      const provider = registry.detectProvider('custom-model-x');

      expect(provider?.name).toBe('custom');
    });

    it('should return undefined for unknown model', () => {
      const provider = registry.detectProvider('unknown-model');

      expect(provider).toBeUndefined();
    });
  });

  describe('createFromConfig', () => {
    it('should be a static method', () => {
      expect(typeof ProviderRegistry.createFromConfig).toBe('function');
    });

    // Note: createFromConfig uses require() which doesn't work well in test environment
    // In real usage, it creates providers dynamically based on config type
    // The functionality is tested through loadFromConfig integration tests
  });

  describe('loadFromConfig', () => {
    it('should handle missing llm config', () => {
      const config = {};

      expect(() => registry.loadFromConfig(config)).not.toThrow();
    });

    it('should handle missing providers config', () => {
      const config = {
        llm: {}
      };

      expect(() => registry.loadFromConfig(config)).not.toThrow();
    });

    // Note: Full integration tests for loadFromConfig require actual provider implementations
    // which use require() and don't work well in isolated unit tests
    // The method is tested in integration tests and real usage
  });

  describe('streamWithFallback', () => {
    it('should stream from first available provider', async () => {
      registry.register(mockProvider);

      const params: StreamParams = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }]
      };

      const chunks: StreamChunk[] = [];
      for await (const chunk of registry.streamWithFallback(['test-provider'], params)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('test');
    });

    it('should fallback to next provider on error', async () => {
      const failingProvider = {
        ...mockProvider,
        name: 'failing',
        streamText: vi.fn(async function* () {
          throw new Error('Provider failed');
        })
      };

      const workingProvider = {
        ...mockProvider,
        name: 'working'
      };

      registry.register(failingProvider);
      registry.register(workingProvider);

      const params: StreamParams = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }]
      };

      const chunks: StreamChunk[] = [];
      for await (const chunk of registry.streamWithFallback(['failing', 'working'], params)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(failingProvider.streamText).toHaveBeenCalled();
      expect(workingProvider.streamText).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      const failingProvider = {
        ...mockProvider,
        streamText: vi.fn(async function* () {
          throw new Error('Provider failed');
        })
      };

      registry.register(failingProvider);

      const params: StreamParams = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }]
      };

      await expect(async () => {
        for await (const chunk of registry.streamWithFallback(['test-provider'], params)) {
          // consume stream
        }
      }).rejects.toThrow('All providers failed');
    });

    it('should skip non-existent providers', async () => {
      registry.register(mockProvider);

      const params: StreamParams = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }]
      };

      const chunks: StreamChunk[] = [];
      for await (const chunk of registry.streamWithFallback(['non-existent', 'test-provider'], params)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('should return all registered providers', () => {
      const provider2 = { ...mockProvider, name: 'provider-2' };

      registry.register(mockProvider);
      registry.register(provider2);

      const providers = registry.getAll();

      expect(providers).toHaveLength(2);
      expect(providers).toContain(mockProvider);
      expect(providers).toContain(provider2);
    });

    it('should return empty array when no providers', () => {
      const providers = registry.getAll();

      expect(providers).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all providers', () => {
      registry.register(mockProvider);
      registry.register({ ...mockProvider, name: 'provider-2' });

      registry.clear();

      expect(registry.getAll()).toEqual([]);
      expect(registry.get('test-provider')).toBeUndefined();
    });
  });
});
