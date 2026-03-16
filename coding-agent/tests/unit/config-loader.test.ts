import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigLoader } from '../../src/config/loader.js';
import type { Config } from '../../src/config/schema.js';
import { readFile } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}));

vi.mock('dotenv', () => ({
  default: {
    config: vi.fn()
  }
}));

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;
  let mockConfig: Config;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      llm: {
        providers: {
          anthropic: {
            type: 'anthropic',
            apiKey: '${ANTHROPIC_API_KEY}',
            baseUrl: 'https://api.anthropic.com'
          },
          openai: {
            type: 'openai',
            apiKey: '${OPENAI_API_KEY}',
            baseUrl: 'https://api.openai.com/v1'
          },
          deeprouter: {
            type: 'openai-compatible',
            apiKey: '${DEEPROUTER_API_KEY}',
            baseUrl: 'https://api.deeprouter.ai/v1',
            models: ['deepseek-chat', 'qwen-plus']
          }
        },
        fallbackChain: ['anthropic', 'openai', 'deeprouter'],
        modelAliases: {
          fast: 'claude-sonnet-4-6',
          smart: 'claude-opus-4-6',
          cheap: 'deepseek-chat'
        }
      },
      agents: []
    };

    configLoader = new ConfigLoader();
    // @ts-ignore - accessing private property for testing
    configLoader.config = mockConfig;
  });

  describe('resolveModelAlias', () => {
    it('should resolve model alias to actual model name', () => {
      const result = configLoader.resolveModelAlias('fast');
      expect(result).toBe('claude-sonnet-4-6');
    });

    it('should return original model name if no alias exists', () => {
      const result = configLoader.resolveModelAlias('gpt-4');
      expect(result).toBe('gpt-4');
    });

    it('should handle undefined modelAliases', () => {
      // @ts-ignore
      configLoader.config.llm.modelAliases = undefined;
      const result = configLoader.resolveModelAlias('fast');
      expect(result).toBe('fast');
    });

    it('should resolve multiple aliases', () => {
      expect(configLoader.resolveModelAlias('fast')).toBe('claude-sonnet-4-6');
      expect(configLoader.resolveModelAlias('smart')).toBe('claude-opus-4-6');
      expect(configLoader.resolveModelAlias('cheap')).toBe('deepseek-chat');
    });
  });

  describe('getFallbackChain', () => {
    it('should return configured fallback chain', () => {
      const result = configLoader.getFallbackChain();
      expect(result).toEqual(['anthropic', 'openai', 'deeprouter']);
    });

    it('should return empty array if no fallback chain configured', () => {
      // @ts-ignore
      configLoader.config.llm.fallbackChain = undefined;
      const result = configLoader.getFallbackChain();
      expect(result).toEqual([]);
    });

    it('should return empty array if llm config is undefined', () => {
      // @ts-ignore
      configLoader.config.llm = undefined;
      const result = configLoader.getFallbackChain();
      expect(result).toEqual([]);
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider configuration', () => {
      const result = configLoader.getProviderConfig('anthropic');
      expect(result).toEqual({
        type: 'anthropic',
        apiKey: '${ANTHROPIC_API_KEY}',
        baseUrl: 'https://api.anthropic.com'
      });
    });

    it('should return undefined for non-existent provider', () => {
      const result = configLoader.getProviderConfig('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should return API key from environment variable', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key-123';
      const result = configLoader.getApiKey('anthropic');
      expect(result).toBe('test-key-123');
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should return undefined if environment variable not set', () => {
      const result = configLoader.getApiKey('anthropic');
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown providers', () => {
      process.env.DEEPROUTER_API_KEY = 'deeprouter-key';
      const result = configLoader.getApiKey('deeprouter');
      expect(result).toBeUndefined();
      delete process.env.DEEPROUTER_API_KEY;
    });
  });

  describe('load', () => {
    it('should use default config if file not found', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const loader = new ConfigLoader();
      const config = await loader.load('./non-existent.json');

      expect(config).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
    });

    it('should handle JSON parse errors gracefully', async () => {
      vi.mocked(readFile).mockResolvedValue('invalid json {');

      const loader = new ConfigLoader();
      const config = await loader.load('./invalid.json');

      // Should fall back to default config
      expect(config).toBeDefined();
      expect(config.agents).toBeDefined();
    });
  });
});
