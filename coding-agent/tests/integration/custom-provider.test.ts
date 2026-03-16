import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderRegistry } from '../../src/llm/provider.js';
import { ConfigLoader } from '../../src/config/loader.js';
import OpenAI from 'openai';

// Mock OpenAI at the module level
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

describe('Custom Provider Integration', () => {
  let providerRegistry: ProviderRegistry;
  let configLoader: ConfigLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    providerRegistry = new ProviderRegistry();
    configLoader = new ConfigLoader();
  });

  afterEach(() => {
    providerRegistry.clear();
  });

  describe('DeepRouter Configuration', () => {
    it('should load deeprouter provider from config', async () => {
      const config = await configLoader.load();

      // Verify config has deeprouter provider
      expect(config.llm?.providers).toBeDefined();
      expect(config.llm?.providers?.deeprouter).toBeDefined();
      expect(config.llm?.providers?.deeprouter.type).toBe('openai-compatible');
      expect(config.llm?.providers?.deeprouter.baseUrl).toBe('https://deeprouter.top/');
      expect(config.llm?.providers?.deeprouter.models).toContain('gpt-5');
    });

    it('should register deeprouter provider', async () => {
      const config = await configLoader.load();

      // Load providers from config
      providerRegistry.loadFromConfig(config);

      // Verify provider is registered
      const provider = providerRegistry.get('deeprouter');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('deeprouter');
      expect(provider?.models).toContain('gpt-5');
    });

    it('should create OpenAI client with custom config', async () => {
      const config = await configLoader.load();
      providerRegistry.loadFromConfig(config);

      const provider = providerRegistry.get('deeprouter');
      expect(provider).toBeDefined();

      // Verify OpenAI constructor was called with correct config
      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: expect.any(String),
          baseURL: 'https://deeprouter.top/',
          defaultHeaders: expect.objectContaining({
            'X-Title': 'Coding Agent'
          })
        })
      );
    });

    it('should use custom headers from config', async () => {
      const config = await configLoader.load();
      const deeprouterConfig = config.llm?.providers?.deeprouter;

      expect(deeprouterConfig?.headers).toBeDefined();
      expect(deeprouterConfig?.headers?.['X-Title']).toBe('Coding Agent');
    });

    it('should use default parameters from config', async () => {
      const config = await configLoader.load();
      const deeprouterConfig = config.llm?.providers?.deeprouter;

      expect(deeprouterConfig?.defaultParams).toBeDefined();
      expect(deeprouterConfig?.defaultParams?.temperature).toBe(0.7);
      expect(deeprouterConfig?.defaultParams?.maxTokens).toBe(4096);
    });

    it('should set deeprouter as default provider', async () => {
      const config = await configLoader.load();

      expect(config.defaults.provider).toBe('deeprouter');
    });

    it('should support model detection for custom provider', async () => {
      const config = await configLoader.load();
      providerRegistry.loadFromConfig(config);

      // Should detect provider by model name
      const provider = providerRegistry.detectProvider('gpt-5');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('deeprouter');
    });
  });

  describe('Provider Streaming', () => {
    it('should prepare stream with correct parameters', async () => {
      const config = await configLoader.load();
      providerRegistry.loadFromConfig(config);

      const provider = providerRegistry.get('deeprouter');
      expect(provider).toBeDefined();

      // Mock the OpenAI client's chat.completions.create method
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'gpt-5',
            choices: [{
              index: 0,
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'gpt-5',
            choices: [{
              index: 0,
              delta: { content: ' World' },
              finish_reason: null
            }]
          };
          yield {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'gpt-5',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
        }
      };

      const mockCreate = vi.fn().mockResolvedValue(mockStream);

      // @ts-ignore - accessing private property for testing
      if (provider?.client) {
        // @ts-ignore
        provider.client.chat = {
          completions: {
            create: mockCreate
          }
        };
      }

      // Test streaming
      const params = {
        model: 'gpt-5',
        messages: [{ role: 'user' as const, content: 'Test message' }],
        temperature: 0.8,
        maxTokens: 1000
      };

      const chunks = [];
      for await (const chunk of provider!.streamText(params)) {
        chunks.push(chunk);
      }

      // Verify stream was called with correct parameters
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          messages: [{ role: 'user', content: 'Test message' }],
          temperature: 0.8,
          max_tokens: 1000,
          stream: true
        })
      );

      // Verify chunks were received
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.type === 'text')).toBe(true);
    });
  });

  describe('Fallback Chain', () => {
    it('should load fallback chain from config', async () => {
      const config = await configLoader.load();

      expect(config.llm?.fallbackChain).toBeDefined();
      expect(config.llm?.fallbackChain).toContain('openai-compatible');
    });
  });

  describe('Multiple Custom Providers', () => {
    it('should support multiple custom providers', async () => {
      const config = await configLoader.load();

      // Add another custom provider to test
      const testConfig = {
        ...config,
        llm: {
          ...config.llm,
          providers: {
            ...config.llm?.providers,
            'custom-provider-2': {
              type: 'openai-compatible' as const,
              apiKey: 'test-key-2',
              baseUrl: 'https://api.custom2.com/v1',
              models: ['custom-model-1', 'custom-model-2']
            }
          }
        }
      };

      providerRegistry.loadFromConfig(testConfig);

      // Verify both providers are registered
      const provider1 = providerRegistry.get('deeprouter');
      const provider2 = providerRegistry.get('custom-provider-2');

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider1?.name).toBe('deeprouter');
      expect(provider2?.name).toBe('custom-provider-2');
    });
  });

  describe('Provider Capabilities', () => {
    it('should return correct capabilities for custom provider', async () => {
      const config = await configLoader.load();
      providerRegistry.loadFromConfig(config);

      const provider = providerRegistry.get('deeprouter');
      expect(provider).toBeDefined();

      const capabilities = provider!.getCapabilities('gpt-5');

      expect(capabilities).toEqual({
        maxContextWindow: 128000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false
      });
    });
  });

  describe('Token Counting', () => {
    it('should estimate tokens for custom provider', async () => {
      const config = await configLoader.load();
      providerRegistry.loadFromConfig(config);

      const provider = providerRegistry.get('deeprouter');
      expect(provider).toBeDefined();

      const text = 'This is a test message for token counting';
      const tokenCount = provider!.countTokens(text, 'gpt-5');

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(text.length);
    });
  });
});
