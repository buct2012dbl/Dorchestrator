import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../../src/agent/base-agent.js';
import { sessionManager } from '../../src/core/session.js';
import { messageBus } from '../../src/core/message-bus.js';
import { toolRegistry } from '../../src/tools/tool-registry.js';
import type { AgentConfig } from '../../src/core/agent-registry.js';

vi.mock('../../src/core/session.js', () => ({
  sessionManager: {
    current: vi.fn(() => ({ id: 'test-session', agentId: 'test-agent', messages: [] }))
  }
}));

vi.mock('../../src/core/message-bus.js', () => ({
  messageBus: {
    publish: vi.fn()
  }
}));

vi.mock('../../src/tools/tool-registry.js', () => ({
  toolRegistry: {
    execute: vi.fn(),
    getForAgent: vi.fn(() => [])
  }
}));

vi.mock('../../src/context/shared-store.js', () => ({
  sharedContext: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn()
  }
}));

// Concrete implementation for testing
class TestAgent extends BaseAgent {
  async process(message: string): Promise<string> {
    return `Processed: ${message}`;
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      id: 'test-agent',
      type: 'coding',
      name: 'Test Agent',
      description: 'Test agent',
      systemPrompt: 'You are a test agent',
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 1000,
      contextWindow: 10000,
      tools: ['read', 'write', 'bash'],
      permissions: {
        fileWrite: true,
        shellExec: true,
        networkAccess: false
      }
    };

    agent = new TestAgent(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(agent.config).toBe(mockConfig);
    });
  });

  describe('process', () => {
    it('should be implemented by subclass', async () => {
      const result = await agent.process('test message');

      expect(result).toBe('Processed: test message');
    });
  });

  describe('executeToolCall', () => {
    it('should execute tool and publish events', async () => {
      const toolResult = { success: true, data: 'result' };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      const result = await agent['executeToolCall']('read', { path: '/test' });

      expect(messageBus.publish).toHaveBeenCalledWith(
        'tool:execute',
        { toolId: 'read', args: { path: '/test' } },
        { sessionId: 'test-session', agentId: 'test-agent' }
      );

      expect(toolRegistry.execute).toHaveBeenCalledWith(
        'read',
        { path: '/test' },
        {
          sessionId: 'test-session',
          agentId: 'test-agent',
          workingDirectory: process.cwd()
        }
      );

      expect(messageBus.publish).toHaveBeenCalledWith(
        'tool:result',
        { toolId: 'read', result: toolResult },
        { sessionId: 'test-session', agentId: 'test-agent' }
      );

      expect(result).toEqual(toolResult);
    });

    it('should handle tool execution errors', async () => {
      const errorResult = { success: false, error: 'Tool failed' };
      vi.mocked(toolRegistry.execute).mockResolvedValue(errorResult);

      const result = await agent['executeToolCall']('read', { path: '/test' });

      expect(result).toEqual(errorResult);
    });

    it('should use current session context', async () => {
      const customSession = { id: 'custom-session', agentId: 'custom-agent', messages: [] };
      vi.mocked(sessionManager.current).mockReturnValue(customSession);

      await agent['executeToolCall']('read', { path: '/test' });

      expect(toolRegistry.execute).toHaveBeenCalledWith(
        'read',
        { path: '/test' },
        expect.objectContaining({
          sessionId: 'custom-session',
          agentId: 'test-agent'
        })
      );
    });
  });

  describe('getTools', () => {
    it('should retrieve tools for agent', () => {
      const mockTools = [
        { id: 'read', description: 'Read file', parameters: {}, execute: vi.fn() },
        { id: 'write', description: 'Write file', parameters: {}, execute: vi.fn() }
      ];
      vi.mocked(toolRegistry.getForAgent).mockReturnValue(mockTools);

      const tools = agent['getTools']();

      expect(toolRegistry.getForAgent).toHaveBeenCalledWith('test-agent', ['read', 'write', 'bash']);
      expect(tools).toEqual(mockTools);
    });

    it('should return empty array if no tools configured', () => {
      agent.config.tools = [];
      vi.mocked(toolRegistry.getForAgent).mockReturnValue([]);

      const tools = agent['getTools']();

      expect(tools).toEqual([]);
    });
  });

  describe('sendToAgent', () => {
    it('should send message to target agent', async () => {
      const toolResult = {
        success: true,
        data: { response: 'Agent response' }
      };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      const response = await agent.sendToAgent('target-agent', 'Hello');

      expect(toolRegistry.execute).toHaveBeenCalledWith(
        'send_message',
        { agent_id: 'target-agent', message: 'Hello' },
        expect.any(Object)
      );
      expect(response).toBe('Agent response');
    });

    it('should throw error on failure', async () => {
      const toolResult = {
        success: false,
        error: 'Agent not found'
      };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      await expect(agent.sendToAgent('target-agent', 'Hello'))
        .rejects.toThrow('Agent not found');
    });

    it('should throw generic error if no error message', async () => {
      const toolResult = {
        success: false
      };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      await expect(agent.sendToAgent('target-agent', 'Hello'))
        .rejects.toThrow('Failed to send message');
    });
  });

  describe('spawnSubagent', () => {
    it('should spawn subagent with task', async () => {
      const toolResult = {
        success: true,
        data: { response: 'Subagent result' }
      };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      const response = await agent.spawnSubagent('explorer', 'Analyze code');

      expect(toolRegistry.execute).toHaveBeenCalledWith(
        'spawn_agent',
        { agent_type: 'explorer', task: 'Analyze code' },
        expect.any(Object)
      );
      expect(response).toBe('Subagent result');
    });

    it('should throw error on failure', async () => {
      const toolResult = {
        success: false,
        error: 'Invalid agent type'
      };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      await expect(agent.spawnSubagent('invalid', 'Task'))
        .rejects.toThrow('Invalid agent type');
    });

    it('should throw generic error if no error message', async () => {
      const toolResult = {
        success: false
      };
      vi.mocked(toolRegistry.execute).mockResolvedValue(toolResult);

      await expect(agent.spawnSubagent('explorer', 'Task'))
        .rejects.toThrow('Failed to spawn subagent');
    });
  });

  describe('getSharedContext', () => {
    it('should return shared context store', () => {
      const context = agent.getSharedContext();

      expect(context).toBeDefined();
      expect(context.set).toBeDefined();
      expect(context.get).toBeDefined();
      expect(context.delete).toBeDefined();
    });
  });
});
