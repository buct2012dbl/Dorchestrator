import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Orchestrator } from '../../src/core/orchestrator.js';
import { agentRegistry } from '../../src/core/agent-registry.js';
import { sessionManager } from '../../src/core/session.js';
import { messageBus } from '../../src/core/message-bus.js';
import type { BaseAgent } from '../../src/agent/base-agent.js';

vi.mock('../../src/core/agent-registry.js', () => ({
  agentRegistry: {
    create: vi.fn(),
    get: vi.fn(),
    setStatus: vi.fn(),
    getStats: vi.fn(() => ({ total: 0, idle: 0, busy: 0 })),
    clear: vi.fn()
  }
}));

vi.mock('../../src/core/session.js', () => ({
  sessionManager: {
    create: vi.fn(() => ({ id: 'test-session', agentId: 'test-agent', messages: [] })),
    provideAsync: vi.fn((session, fn) => fn()),
    getStats: vi.fn(() => ({ total: 0, active: 0 })),
    clear: vi.fn()
  }
}));

vi.mock('../../src/core/message-bus.js', () => ({
  messageBus: {
    subscribe: vi.fn(),
    publish: vi.fn(),
    getEventLog: vi.fn(() => []),
    clear: vi.fn()
  }
}));

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockAgent: BaseAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgent = {
      config: {
        id: 'test-agent',
        type: 'coding',
        name: 'Test Agent',
        description: 'Test',
        systemPrompt: 'Test prompt',
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 1000,
        contextWindow: 10000,
        tools: [],
        permissions: { fileWrite: true, shellExec: true, networkAccess: false }
      },
      process: vi.fn().mockResolvedValue('test response'),
      executeToolCall: vi.fn(),
      getTools: vi.fn(() => [])
    } as any;

    orchestrator = new Orchestrator({
      workingDirectory: '/test',
      maxConcurrentAgents: 5,
      defaultModel: 'test-model',
      defaultTemperature: 0.7
    });
  });

  afterEach(() => {
    orchestrator.shutdown();
  });

  describe('initialize', () => {
    it('should initialize and set up event listeners', async () => {
      await orchestrator.initialize();

      expect(messageBus.subscribe).toHaveBeenCalledWith('session:start', expect.any(Function));
      expect(messageBus.subscribe).toHaveBeenCalledWith('session:end', expect.any(Function));
      expect(messageBus.subscribe).toHaveBeenCalledWith('agent:error', expect.any(Function));
    });

    it('should not initialize twice', async () => {
      await orchestrator.initialize();
      await orchestrator.initialize();

      // Should only subscribe once
      expect(messageBus.subscribe).toHaveBeenCalledTimes(3);
    });
  });

  describe('createAgent', () => {
    it('should create agent through registry', () => {
      vi.mocked(agentRegistry.create).mockReturnValue(mockAgent);

      const agent = orchestrator.createAgent(mockAgent.config);

      expect(agentRegistry.create).toHaveBeenCalledWith(mockAgent.config);
      expect(agent).toBe(mockAgent);
    });
  });

  describe('getAgent', () => {
    it('should retrieve agent from registry', () => {
      vi.mocked(agentRegistry.get).mockReturnValue(mockAgent);

      const agent = orchestrator.getAgent('test-agent');

      expect(agentRegistry.get).toHaveBeenCalledWith('test-agent');
      expect(agent).toBe(mockAgent);
    });

    it('should return undefined for non-existent agent', () => {
      vi.mocked(agentRegistry.get).mockReturnValue(undefined);

      const agent = orchestrator.getAgent('non-existent');

      expect(agent).toBeUndefined();
    });
  });

  describe('executeTask', () => {
    beforeEach(() => {
      vi.mocked(agentRegistry.get).mockReturnValue(mockAgent);
    });

    it('should execute task with agent', async () => {
      const result = await orchestrator.executeTask('test-agent', 'test task');

      expect(sessionManager.create).toHaveBeenCalledWith('test-agent');
      expect(agentRegistry.setStatus).toHaveBeenCalledWith('test-agent', 'busy');
      expect(mockAgent.process).toHaveBeenCalledWith('test task');
      expect(agentRegistry.setStatus).toHaveBeenCalledWith('test-agent', 'idle');
      expect(result).toBe('test response');
    });

    it('should publish session events', async () => {
      await orchestrator.executeTask('test-agent', 'test task');

      expect(messageBus.publish).toHaveBeenCalledWith('session:start', {
        sessionId: 'test-session',
        agentId: 'test-agent'
      });
      expect(messageBus.publish).toHaveBeenCalledWith('session:end', {
        sessionId: 'test-session',
        agentId: 'test-agent'
      });
    });

    it('should throw error if agent not found', async () => {
      vi.mocked(agentRegistry.get).mockReturnValue(undefined);

      await expect(orchestrator.executeTask('non-existent', 'task'))
        .rejects.toThrow('Agent non-existent not found');
    });

    it('should handle agent errors', async () => {
      const error = new Error('Agent failed');
      vi.mocked(mockAgent.process).mockRejectedValue(error);

      await expect(orchestrator.executeTask('test-agent', 'task'))
        .rejects.toThrow('Agent failed');

      expect(messageBus.publish).toHaveBeenCalledWith('agent:error', {
        agentId: 'test-agent',
        error
      });
    });

    it('should set agent to idle even on error', async () => {
      vi.mocked(mockAgent.process).mockRejectedValue(new Error('Failed'));

      await expect(orchestrator.executeTask('test-agent', 'task'))
        .rejects.toThrow();

      expect(agentRegistry.setStatus).toHaveBeenCalledWith('test-agent', 'idle');
    });
  });

  describe('executeParallel', () => {
    beforeEach(() => {
      vi.mocked(agentRegistry.get).mockReturnValue(mockAgent);
    });

    it('should execute multiple tasks in parallel', async () => {
      const tasks = [
        { agentId: 'agent1', task: 'task1' },
        { agentId: 'agent2', task: 'task2' },
        { agentId: 'agent3', task: 'task3' }
      ];

      const results = await orchestrator.executeParallel(tasks);

      expect(results).toHaveLength(3);
      expect(results).toEqual(['test response', 'test response', 'test response']);
      expect(mockAgent.process).toHaveBeenCalledTimes(3);
    });

    it('should handle empty task list', async () => {
      const results = await orchestrator.executeParallel([]);

      expect(results).toEqual([]);
    });

    it('should propagate errors from any task', async () => {
      vi.mocked(mockAgent.process)
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');

      const tasks = [
        { agentId: 'agent1', task: 'task1' },
        { agentId: 'agent2', task: 'task2' },
        { agentId: 'agent3', task: 'task3' }
      ];

      await expect(orchestrator.executeParallel(tasks))
        .rejects.toThrow('Failed');
    });
  });

  describe('getStats', () => {
    it('should return orchestrator statistics', () => {
      vi.mocked(agentRegistry.getStats).mockReturnValue({
        total: 5,
        idle: 3,
        busy: 2
      });
      vi.mocked(sessionManager.getStats).mockReturnValue({
        total: 10,
        active: 2
      });
      vi.mocked(messageBus.getEventLog).mockReturnValue([
        { type: 'test', data: {}, timestamp: Date.now() }
      ]);

      const stats = orchestrator.getStats();

      expect(stats).toEqual({
        agents: { total: 5, idle: 3, busy: 2 },
        sessions: { total: 10, active: 2 },
        events: { total: 1 }
      });
    });
  });

  describe('shutdown', () => {
    it('should clear all resources', () => {
      orchestrator.shutdown();

      expect(sessionManager.clear).toHaveBeenCalled();
      expect(agentRegistry.clear).toHaveBeenCalled();
      expect(messageBus.clear).toHaveBeenCalled();
    });

    it('should allow reinitialization after shutdown', async () => {
      await orchestrator.initialize();
      orchestrator.shutdown();
      await orchestrator.initialize();

      // Should subscribe again after shutdown
      expect(messageBus.subscribe).toHaveBeenCalledTimes(6); // 3 initial + 3 after reinit
    });
  });
});
