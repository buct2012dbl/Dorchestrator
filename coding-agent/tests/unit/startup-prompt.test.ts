import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionManager } from '../../src/core/session.js';

vi.mock('../../src/core/session.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/core/session.js')>('../../src/core/session.js');
  return {
    ...actual,
    sessionManager: {
      findLatestByAgent: vi.fn(),
      create: vi.fn(),
      addMessage: vi.fn(),
    },
  };
});

describe('startup prompt seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds a hidden system message into the latest session when startup prompt is provided', async () => {
    const session = { id: 'session-1', messages: [] } as any;
    vi.mocked(sessionManager.findLatestByAgent).mockReturnValue(session);
    const { __testHooks } = await import('../../src/cli/index.js');

    __testHooks.seedStartupPrompt('agent-1', 'Restore earlier swarm memory');

    expect(sessionManager.findLatestByAgent).toHaveBeenCalledWith('agent-1');
    expect(sessionManager.addMessage).toHaveBeenCalledWith('session-1', expect.objectContaining({
      role: 'system',
      content: 'Restore earlier swarm memory',
      metadata: expect.objectContaining({
        hiddenBootstrap: true,
        source: 'startup-prompt',
      }),
    }));
  });

  it('does not duplicate an already-seeded startup prompt', async () => {
    const session = {
      id: 'session-1',
      messages: [{
        role: 'system',
        content: 'Restore earlier swarm memory',
        metadata: { hiddenBootstrap: true, source: 'startup-prompt' },
      }],
    } as any;
    vi.mocked(sessionManager.findLatestByAgent).mockReturnValue(session);
    const { __testHooks } = await import('../../src/cli/index.js');

    __testHooks.seedStartupPrompt('agent-1', 'Restore earlier swarm memory');

    expect(sessionManager.addMessage).not.toHaveBeenCalled();
  });
});
