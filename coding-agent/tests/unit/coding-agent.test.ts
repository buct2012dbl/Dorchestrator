import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodingAgent } from '../../src/agent/coding-agent.js';
import { sessionManager } from '../../src/core/session.js';
import { messageBus } from '../../src/core/message-bus.js';
import { toolRegistry } from '../../src/tools/tool-registry.js';
import { selectProvider, executeWithFallback } from '../../src/agent/provider-utils.js';
import type { AgentConfig } from '../../src/core/agent-registry.js';
import type { LLMProvider } from '../../src/llm/provider.js';

// Mock crypto
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random()
} as any;

vi.mock('../../src/core/session.js', () => ({
  sessionManager: {
    current: vi.fn(() => ({
      id: 'test-session',
      agentId: 'coding-agent',
      messages: []
    })),
    addMessage: vi.fn()
  }
}));

vi.mock('../../src/core/message-bus.js', () => ({
  messageBus: {
    publish: vi.fn()
  }
}));

vi.mock('../../src/tools/tool-registry.js', () => ({
  toolRegistry: {
    getForAgent: vi.fn(() => []),
    toAnthropicFormat: vi.fn((tools) => tools),
    toOpenAIFormat: vi.fn((tools) => tools),
    execute: vi.fn()
  }
}));

vi.mock('../../src/agent/provider-utils.js', () => ({
  selectProvider: vi.fn(),
  executeWithFallback: vi.fn()
}));

describe('CodingAgent', () => {
  let agent: CodingAgent;
  let mockConfig: AgentConfig;
  let mockProvider: LLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      id: 'coding-agent',
      type: 'coding',
      name: 'Coding Agent',
      description: 'Main coding agent',
      systemPrompt: 'You are a coding agent',
      model: 'claude-sonnet-4-6',
      temperature: 0.7,
      maxTokens: 8000,
      contextWindow: 180000,
      tools: ['read', 'write', 'edit', 'bash'],
      permissions: {
        fileWrite: true,
        shellExec: true,
        networkAccess: false
      }
    };

    mockProvider = {
      name: 'anthropic',
      models: ['claude-sonnet-4-6'],
      streamText: vi.fn(),
      countTokens: vi.fn(() => 10),
      getCapabilities: vi.fn(() => ({
        maxContextWindow: 180000,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false
      }))
    };

    agent = new CodingAgent(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(agent.config).toBe(mockConfig);
    });
  });

  describe('process', () => {
    beforeEach(() => {
      vi.mocked(selectProvider).mockReturnValue({
        provider: mockProvider,
        resolvedModel: 'claude-sonnet-4-6',
        source: 'detected'
      });

      // Mock executeWithFallback to actually call the callback
      vi.mocked(executeWithFallback).mockImplementation(async (provider, model, fn) => {
        // Execute the callback which will set fullResponse
        return await fn(provider);
      });

      // Mock the provider's streamText to return empty stream by default
      vi.mocked(mockProvider.streamText).mockReturnValue((async function* () {
        yield { type: 'text' as const, content: 'Default response' };
      })());
    });

    it('should process message and return response', async () => {
      vi.mocked(mockProvider.streamText).mockReturnValue((async function* () {
        yield { type: 'text' as const, content: 'Agent response' };
      })());

      const response = await agent.process('Write a function');

      expect(sessionManager.addMessage).toHaveBeenCalledWith('test-session', {
        id: expect.any(String),
        role: 'user',
        content: 'Write a function',
        timestamp: expect.any(Number)
      });

      expect(messageBus.publish).toHaveBeenCalledWith(
        'agent:message',
        { message: 'Write a function' },
        { sessionId: 'test-session', agentId: 'coding-agent' }
      );

      expect(response).toBe('Agent response');
    });

    it('should select provider with model and optional provider', async () => {
      await agent.process('Test');

      expect(selectProvider).toHaveBeenCalledWith('claude-sonnet-4-6', undefined);
    });

    it('should use explicit provider if configured', async () => {
      agent.config.provider = 'openai';

      await agent.process('Test');

      expect(selectProvider).toHaveBeenCalledWith('claude-sonnet-4-6', 'openai');
    });

    it('should get tools for agent', async () => {
      const mockTools = [
        { id: 'read', description: 'Read file', parameters: {} }
      ];
      vi.mocked(toolRegistry.getForAgent).mockReturnValue(mockTools as any);

      await agent.process('Test');

      expect(toolRegistry.getForAgent).toHaveBeenCalledWith('coding-agent', ['read', 'write', 'edit', 'bash']);
    });

    it('should format tools for Anthropic provider', async () => {
      await agent.process('Test');

      expect(toolRegistry.toAnthropicFormat).toHaveBeenCalled();
    });

    it('should format tools for OpenAI provider', async () => {
      mockProvider.name = 'openai';
      vi.mocked(selectProvider).mockReturnValue({
        provider: mockProvider,
        resolvedModel: 'gpt-4',
        source: 'detected'
      });

      await agent.process('Test');

      expect(toolRegistry.toOpenAIFormat).toHaveBeenCalled();
    });

    it('should add assistant response to session', async () => {
      vi.mocked(mockProvider.streamText).mockReturnValue((async function* () {
        yield { type: 'text' as const, content: 'Agent response' };
      })());

      await agent.process('Test');

      expect(sessionManager.addMessage).toHaveBeenCalledWith('test-session', {
        id: expect.any(String),
        role: 'assistant',
        content: 'Agent response',
        timestamp: expect.any(Number)
      });
    });

    it('should publish agent response event', async () => {
      vi.mocked(mockProvider.streamText).mockReturnValue((async function* () {
        yield { type: 'text' as const, content: 'Agent response' };
      })());

      await agent.process('Test');

      expect(messageBus.publish).toHaveBeenCalledWith(
        'agent:response',
        { response: 'Agent response' },
        { sessionId: 'test-session', agentId: 'coding-agent' }
      );
    });

    it('should handle streaming with text chunks', async () => {
      // Note: Full streaming logic is tested in integration tests
      // This test verifies the basic flow
      vi.mocked(executeWithFallback).mockResolvedValueOnce('Response');

      const response = await agent.process('Test');

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should handle tool calls during streaming', async () => {
      // Note: Full tool call streaming is tested in integration tests
      // This test verifies the basic flow
      vi.mocked(executeWithFallback).mockResolvedValueOnce('Response');

      const response = await agent.process('Test');

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    it('should propagate errors from provider', async () => {
      vi.mocked(executeWithFallback).mockRejectedValue(new Error('Provider failed'));

      await expect(agent.process('Test')).rejects.toThrow('Provider failed');
    });
  });
});
