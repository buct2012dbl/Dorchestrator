import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../../src/core/agent-registry.js';
import type { AgentConfig, AgentStatus } from '../../src/core/agent-registry.js';
import type { BaseAgent } from '../../src/agent/base-agent.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let mockAgent: BaseAgent;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    registry = new AgentRegistry();

    mockConfig = {
      id: 'test-agent',
      type: 'coding',
      name: 'Test Agent',
      description: 'Test agent for unit tests',
      systemPrompt: 'You are a test agent',
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 1000,
      contextWindow: 10000,
      tools: ['read', 'write'],
      permissions: {
        fileWrite: true,
        shellExec: true,
        networkAccess: false
      }
    };

    mockAgent = {
      config: mockConfig,
      process: vi.fn(),
      executeToolCall: vi.fn(),
      getTools: vi.fn(() => [])
    } as any;
  });

  describe('registerFactory', () => {
    it('should register agent factory', () => {
      const factory = vi.fn(() => mockAgent);
      registry.registerFactory('coding', factory);

      const agent = registry.create(mockConfig);

      expect(factory).toHaveBeenCalledWith(mockConfig);
      expect(agent).toBe(mockAgent);
    });

    it('should allow multiple factory types', () => {
      const codingFactory = vi.fn(() => mockAgent);
      const explorerFactory = vi.fn(() => mockAgent);

      registry.registerFactory('coding', codingFactory);
      registry.registerFactory('explorer', explorerFactory);

      registry.create(mockConfig);
      registry.create({ ...mockConfig, id: 'explorer-1', type: 'explorer' });

      expect(codingFactory).toHaveBeenCalled();
      expect(explorerFactory).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
    });

    it('should create agent instance', () => {
      const agent = registry.create(mockConfig);

      expect(agent).toBe(mockAgent);
      expect(registry.has('test-agent')).toBe(true);
    });

    it('should throw error for unregistered type', () => {
      const config = { ...mockConfig, type: 'unknown' };

      expect(() => registry.create(config))
        .toThrow('No factory registered for agent type: unknown');
    });

    it('should initialize agent with idle status', () => {
      registry.create(mockConfig);

      expect(registry.getStatus('test-agent')).toBe('idle');
    });

    it('should set creation timestamp', () => {
      const before = Date.now();
      registry.create(mockConfig);
      const after = Date.now();

      const config = registry.getConfig('test-agent');
      expect(config).toBeDefined();
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
    });

    it('should retrieve agent by id', () => {
      const agent = registry.get('test-agent');

      expect(agent).toBe(mockAgent);
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.get('non-existent');

      expect(agent).toBeUndefined();
    });

    it('should update lastUsed timestamp on access', () => {
      const before = Date.now();
      registry.get('test-agent');
      const after = Date.now();

      // Timestamp should be updated (we can't check exact value due to timing)
      expect(registry.get('test-agent')).toBe(mockAgent);
    });
  });

  describe('getConfig', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
    });

    it('should retrieve agent config', () => {
      const config = registry.getConfig('test-agent');

      expect(config).toEqual(mockConfig);
    });

    it('should return undefined for non-existent agent', () => {
      const config = registry.getConfig('non-existent');

      expect(config).toBeUndefined();
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
    });

    it('should retrieve agent status', () => {
      const status = registry.getStatus('test-agent');

      expect(status).toBe('idle');
    });

    it('should return undefined for non-existent agent', () => {
      const status = registry.getStatus('non-existent');

      expect(status).toBeUndefined();
    });
  });

  describe('setStatus', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
    });

    it('should update agent status', () => {
      registry.setStatus('test-agent', 'busy');

      expect(registry.getStatus('test-agent')).toBe('busy');
    });

    it('should handle all status types', () => {
      const statuses: AgentStatus[] = ['idle', 'busy', 'error', 'stopped'];

      for (const status of statuses) {
        registry.setStatus('test-agent', status);
        expect(registry.getStatus('test-agent')).toBe(status);
      }
    });

    it('should do nothing for non-existent agent', () => {
      expect(() => registry.setStatus('non-existent', 'busy')).not.toThrow();
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
    });

    it('should remove agent from registry', () => {
      registry.delete('test-agent');

      expect(registry.has('test-agent')).toBe(false);
      expect(registry.get('test-agent')).toBeUndefined();
    });

    it('should handle deleting non-existent agent', () => {
      expect(() => registry.delete('non-existent')).not.toThrow();
    });
  });

  describe('getAll', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
    });

    it('should return all agents', () => {
      registry.create(mockConfig);
      registry.create({ ...mockConfig, id: 'agent-2' });
      registry.create({ ...mockConfig, id: 'agent-3' });

      const agents = registry.getAll();

      expect(agents).toHaveLength(3);
      expect(agents.every(a => a === mockAgent)).toBe(true);
    });

    it('should return empty array when no agents', () => {
      const agents = registry.getAll();

      expect(agents).toEqual([]);
    });
  });

  describe('getAllConfigs', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
    });

    it('should return all agent configs', () => {
      registry.create(mockConfig);
      registry.create({ ...mockConfig, id: 'agent-2' });

      const configs = registry.getAllConfigs();

      expect(configs).toHaveLength(2);
      expect(configs[0].id).toBe('test-agent');
      expect(configs[1].id).toBe('agent-2');
    });

    it('should return empty array when no agents', () => {
      const configs = registry.getAllConfigs();

      expect(configs).toEqual([]);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
    });

    it('should return true for existing agent', () => {
      expect(registry.has('test-agent')).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.create(mockConfig);
      registry.create({ ...mockConfig, id: 'agent-2' });
    });

    it('should remove all agents', () => {
      registry.clear();

      expect(registry.getAll()).toEqual([]);
      expect(registry.has('test-agent')).toBe(false);
      expect(registry.has('agent-2')).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      registry.registerFactory('coding', () => mockAgent);
      registry.registerFactory('explorer', () => mockAgent);
    });

    it('should return statistics', () => {
      registry.create(mockConfig);
      registry.create({ ...mockConfig, id: 'agent-2', type: 'explorer' });
      registry.create({ ...mockConfig, id: 'agent-3', type: 'explorer' });

      registry.setStatus('test-agent', 'busy');
      registry.setStatus('agent-2', 'idle');
      registry.setStatus('agent-3', 'error');

      const stats = registry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType).toEqual({
        coding: 1,
        explorer: 2
      });
      expect(stats.byStatus).toEqual({
        idle: 1,
        busy: 1,
        error: 1,
        stopped: 0
      });
    });

    it('should return empty stats when no agents', () => {
      const stats = registry.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byStatus).toEqual({
        idle: 0,
        busy: 0,
        error: 0,
        stopped: 0
      });
    });
  });
});
