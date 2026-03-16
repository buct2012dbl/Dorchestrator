import { describe, it, expect, beforeEach, vi } from 'vitest';
import { selectProvider, executeWithFallback } from '../../src/agent/provider-utils.js';
import { providerRegistry } from '../../src/llm/provider.js';
import { configLoader } from '../../src/config/loader.js';
import type { LLMProvider } from '../../src/llm/provider.js';

vi.mock('../../src/llm/provider.js', () => ({
  providerRegistry: {
    get: vi.fn(),
    detectProvider: vi.fn()
  }
}));

vi.mock('../../src/config/loader.js', () => ({
  configLoader: {
    resolveModelAlias: vi.fn((model) => model),
    getFallbackChain: vi.fn(() => [])
  }
}));

vi.mock('../../src/monitoring/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../src/monitoring/metrics.js', () => ({
  metrics: {
    increment: vi.fn(),
    timing: vi.fn()
  }
}));

describe('selectProvider', () => {
  const mockProvider: LLMProvider = {
    name: 'test-provider',
    models: ['test-model'],
    streamText: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use explicit provider when specified', () => {
    vi.mocked(providerRegistry.get).mockReturnValue(mockProvider);

    const result = selectProvider('test-model', 'test-provider');

    expect(result.provider).toBe(mockProvider);
    expect(result.resolvedModel).toBe('test-model');
    expect(result.source).toBe('explicit');
    expect(providerRegistry.get).toHaveBeenCalledWith('test-provider');
  });

  it('should detect provider from model name when no explicit provider', () => {
    vi.mocked(providerRegistry.detectProvider).mockReturnValue(mockProvider);

    const result = selectProvider('test-model');

    expect(result.provider).toBe(mockProvider);
    expect(result.source).toBe('detected');
    expect(providerRegistry.detectProvider).toHaveBeenCalledWith('test-model');
  });

  it('should use fallback chain when provider not found', () => {
    vi.mocked(providerRegistry.detectProvider).mockReturnValue(undefined);
    vi.mocked(configLoader.getFallbackChain).mockReturnValue(['fallback1', 'fallback2']);
    vi.mocked(providerRegistry.get)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(mockProvider);

    const result = selectProvider('test-model');

    expect(result.provider).toBe(mockProvider);
    expect(result.source).toBe('fallback');
    expect(providerRegistry.get).toHaveBeenCalledWith('fallback1');
    expect(providerRegistry.get).toHaveBeenCalledWith('fallback2');
  });

  it('should throw error when no provider available', () => {
    vi.mocked(providerRegistry.detectProvider).mockReturnValue(undefined);
    vi.mocked(configLoader.getFallbackChain).mockReturnValue([]);

    expect(() => selectProvider('test-model')).toThrow('No provider available for model: test-model');
  });

  it('should resolve model alias', () => {
    vi.mocked(configLoader.resolveModelAlias).mockReturnValue('resolved-model');
    vi.mocked(providerRegistry.detectProvider).mockReturnValue(mockProvider);

    const result = selectProvider('alias-model');

    expect(configLoader.resolveModelAlias).toHaveBeenCalledWith('alias-model');
    expect(result.resolvedModel).toBe('resolved-model');
  });
});

describe('executeWithFallback', () => {
  const mockProvider: LLMProvider = {
    name: 'primary-provider',
    models: ['test-model'],
    streamText: vi.fn()
  };

  const fallbackProvider: LLMProvider = {
    name: 'fallback-provider',
    models: ['test-model'],
    streamText: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute successfully with primary provider', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await executeWithFallback(mockProvider, 'test-model', fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledWith(mockProvider);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should fallback to next provider on error', async () => {
    vi.mocked(configLoader.getFallbackChain).mockReturnValue(['primary-provider', 'fallback-provider']);
    vi.mocked(providerRegistry.get).mockReturnValue(fallbackProvider);

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValueOnce('success');

    const result = await executeWithFallback(mockProvider, 'test-model', fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, mockProvider);
    expect(fn).toHaveBeenNthCalledWith(2, fallbackProvider);
  });

  it('should throw error when all providers fail', async () => {
    vi.mocked(configLoader.getFallbackChain).mockReturnValue(['primary-provider', 'fallback-provider']);
    vi.mocked(providerRegistry.get).mockReturnValue(fallbackProvider);

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockRejectedValueOnce(new Error('Fallback failed'));

    await expect(executeWithFallback(mockProvider, 'test-model', fn))
      .rejects.toThrow('All providers failed');
  });

  it('should throw original error when no fallback available', async () => {
    vi.mocked(configLoader.getFallbackChain).mockReturnValue(['primary-provider']);

    const fn = vi.fn().mockRejectedValue(new Error('Primary failed'));

    await expect(executeWithFallback(mockProvider, 'test-model', fn))
      .rejects.toThrow('Primary failed');
  });

  it('should skip unavailable fallback providers', async () => {
    vi.mocked(configLoader.getFallbackChain).mockReturnValue(['primary-provider', 'unavailable', 'fallback-provider']);
    vi.mocked(providerRegistry.get)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(fallbackProvider);

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValueOnce('success');

    const result = await executeWithFallback(mockProvider, 'test-model', fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
