import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentRegistry } from '../../src/core/agent-registry.js';
import type { AgentConfig } from '../../src/core/agent-registry.js';

const mockCodingAgent = vi.fn();
const mockExplorerAgent = vi.fn();
const mockPlannerAgent = vi.fn();
const mockReviewerAgent = vi.fn();

vi.mock('../../src/agent/coding-agent.js', () => ({
  CodingAgent: mockCodingAgent,
}));

vi.mock('../../src/agent/explorer-agent.js', () => ({
  ExplorerAgent: mockExplorerAgent,
}));

vi.mock('../../src/agent/planner-agent.js', () => ({
  PlannerAgent: mockPlannerAgent,
}));

vi.mock('../../src/agent/reviewer-agent.js', () => ({
  ReviewerAgent: mockReviewerAgent,
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
    mockExplorerAgent.mockReset();
    mockPlannerAgent.mockReset();
    mockReviewerAgent.mockReset();
  });

  it('registers dedicated factories for each built-in role', async () => {
    const { registerAgentFactories } = await import('../../src/cli/index.js');

    mockCodingAgent.mockReturnValue({ kind: 'coding' });
    mockExplorerAgent.mockReturnValue({ kind: 'explorer' });
    mockPlannerAgent.mockReturnValue({ kind: 'planner' });
    mockReviewerAgent.mockReturnValue({ kind: 'reviewer' });

    registerAgentFactories();

    expect(agentRegistry.create({ ...baseConfig, id: 'coding-1', type: 'coding' })).toEqual({ kind: 'coding' });
    expect(agentRegistry.create({ ...baseConfig, id: 'explorer-1', type: 'explorer' })).toEqual({ kind: 'explorer' });
    expect(agentRegistry.create({ ...baseConfig, id: 'planner-1', type: 'planner' })).toEqual({ kind: 'planner' });
    expect(agentRegistry.create({ ...baseConfig, id: 'reviewer-1', type: 'reviewer' })).toEqual({ kind: 'reviewer' });

    expect(mockCodingAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'coding' }));
    expect(mockExplorerAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'explorer' }));
    expect(mockPlannerAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'planner' }));
    expect(mockReviewerAgent).toHaveBeenCalledWith(expect.objectContaining({ type: 'reviewer' }));
  });
});
