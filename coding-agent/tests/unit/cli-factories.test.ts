import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentRegistry } from '../../src/core/agent-registry.js';
import type { AgentConfig } from '../../src/core/agent-registry.js';

const mockCodingAgent = vi.fn();

vi.mock('../../src/agent/coding-agent.js', () => ({
  CodingAgent: mockCodingAgent,
}));

describe('registerAgentFactories', () => {
  const baseConfig: AgentConfig = {
    id: 'agent-1',
    type: 'coding',
    name: 'Agent 1',
    description: 'test agent',
    systemPrompt: 'test prompt',
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 1000,
    contextWindow: 10000,
    tools: [],
    permissions: {
      fileWrite: false,
      shellExec: false,
      networkAccess: false,
    },
  };

  beforeEach(() => {
    agentRegistry.clear();
    mockCodingAgent.mockReset();
  });

  it('registers CodingAgent as the shared implementation for every built-in role', async () => {
    const { registerAgentFactories } = await import('../../src/cli/index.js');

    mockCodingAgent.mockReturnValue({ kind: 'coding' });

    registerAgentFactories();

    expect(agentRegistry.create({ ...baseConfig, id: 'coding-1', type: 'coding' })).toEqual({ kind: 'coding' });
    expect(agentRegistry.create({ ...baseConfig, id: 'explorer-1', type: 'explorer' })).toEqual({ kind: 'coding' });
    expect(agentRegistry.create({ ...baseConfig, id: 'planner-1', type: 'planner' })).toEqual({ kind: 'coding' });
    expect(agentRegistry.create({ ...baseConfig, id: 'reviewer-1', type: 'reviewer' })).toEqual({ kind: 'coding' });

    expect(mockCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'coding' }));
    expect(mockCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'explorer' }));
    expect(mockCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'planner' }));
    expect(mockCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'reviewer' }));
    expect(mockCodingAgent).toHaveBeenCalledTimes(4);
  });
});
