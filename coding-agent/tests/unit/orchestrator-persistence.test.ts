import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Orchestrator } from '../../src/core/orchestrator.js';
import { agentRegistry } from '../../src/core/agent-registry.js';
import { sessionManager } from '../../src/core/session.js';

vi.mock('../../src/core/agent-registry.js', () => ({
  agentRegistry: {
    create: vi.fn(),
    get: vi.fn(),
    setStatus: vi.fn(),
    clear: vi.fn(),
  }
}));

vi.mock('../../src/core/session.js', () => ({
  sessionManager: {
    configurePersistence: vi.fn(),
    get: vi.fn(() => undefined),
    findLatestByAgent: vi.fn(() => undefined),
    create: vi.fn(() => ({ id: 'new-session', agentId: 'test-agent', messages: [] })),
    provideAsync: vi.fn((session, fn) => fn()),
    delete: vi.fn(),
    clear: vi.fn(),
  }
}));

vi.mock('../../src/core/message-bus.js', () => ({
  messageBus: {
    subscribe: vi.fn(),
    publish: vi.fn(),
    clear: vi.fn(),
    getEventLog: vi.fn(() => []),
  }
}));

describe('Orchestrator persistence', () => {
  const mockAgent = {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentRegistry.get).mockReturnValue(mockAgent);
  });

  it('configures session persistence during initialization', async () => {
    const orchestrator = new Orchestrator({
      workingDirectory: '/test',
      maxConcurrentAgents: 5,
      defaultModel: 'test-model',
      defaultTemperature: 0.7,
      sessionPersistencePath: '/tmp/coding-agent-sessions.json',
    });

    await orchestrator.initialize();

    expect(sessionManager.configurePersistence).toHaveBeenCalledWith('/tmp/coding-agent-sessions.json');
  });

  it('reuses the latest persisted session before creating a new one', async () => {
    const orchestrator = new Orchestrator({
      workingDirectory: '/test',
      maxConcurrentAgents: 5,
      defaultModel: 'test-model',
      defaultTemperature: 0.7,
      sessionPersistencePath: '/tmp/coding-agent-sessions.json',
    });
    const reusedSession = { id: 'persisted-session', agentId: 'test-agent', messages: [] } as any;
    vi.mocked(sessionManager.findLatestByAgent).mockReturnValue(reusedSession);

    await orchestrator.initialize();
    await orchestrator.executeTask('test-agent', 'test task');

    expect(sessionManager.findLatestByAgent).toHaveBeenCalledWith('test-agent');
    expect(sessionManager.create).not.toHaveBeenCalled();
    expect(sessionManager.provideAsync).toHaveBeenCalledWith(reusedSession, expect.any(Function));
  });
});
