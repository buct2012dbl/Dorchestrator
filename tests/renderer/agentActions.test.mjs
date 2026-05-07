import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAgent } from '../../src/renderer/hooks/agentActions.mjs';

test('appendAgent returns the generated id and appends the new node', () => {
  const result = appendAgent(
    [{ id: 'agent-existing' }],
    { role: 'Programmer', color: '#2d7d46' },
    {
      generateId(existingIds) {
        assert.deepEqual([...existingIds], ['agent-existing']);
        return 'agent-new';
      },
      position: { x: 10, y: 20 },
      idleStatus: 'idle',
    },
  );

  assert.equal(result.id, 'agent-new');
  assert.equal(result.agents.length, 2);
  assert.deepEqual(result.agents[1], {
    id: 'agent-new',
    type: 'agentNode',
    position: { x: 10, y: 20 },
    data: {
      role: 'Programmer',
      color: '#2d7d46',
      id: 'agent-new',
      status: 'idle',
      name: 'Programmer',
      unreadCount: 0,
      latestNotification: null,
      gitBranch: null,
    },
  });
});

test('appendAgent uses the latest returned agent list for subsequent ids', () => {
  const ids = ['agent-first', 'agent-second'];
  const generateId = (existingIds) => {
    const nextId = ids.shift();
    assert.equal(existingIds.has(nextId), false);
    return nextId;
  };

  const first = appendAgent([], { role: 'CEO' }, {
    generateId,
    idleStatus: 'idle',
  });
  const second = appendAgent(first.agents, { role: 'Tester' }, {
    generateId,
    idleStatus: 'idle',
  });

  assert.equal(first.id, 'agent-first');
  assert.equal(second.id, 'agent-second');
  assert.deepEqual(second.agents.map((agent) => agent.id), ['agent-first', 'agent-second']);
});
