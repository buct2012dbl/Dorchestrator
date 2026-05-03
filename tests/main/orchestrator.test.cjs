const test = require('node:test');
const assert = require('node:assert/strict');

const { AgentOrchestrator } = require('../../src/main/orchestrator');

function createStream(finalMessage, chunks = []) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of chunks) {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text },
        };
      }
    },
    async finalMessage() {
      return finalMessage;
    },
  };
}

test('continueAgent processes recursive send_message tool use before finishing', async () => {
  const events = [];
  const orchestrator = new AgentOrchestrator({
    isDestroyed: () => false,
    webContents: {
      send: (event, data) => events.push({ event, data }),
    },
  });

  const responses = [
    {
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'send_message',
          input: { target_agent_id: 'worker', message: 'first hop' },
        },
      ],
    },
    {
      content: [
        {
          type: 'tool_use',
          id: 'tool-2',
          name: 'send_message',
          input: { target_agent_id: 'worker', message: 'second hop' },
        },
      ],
    },
    {
      content: [
        {
          type: 'text',
          text: 'final answer',
        },
      ],
    },
  ];

  orchestrator.client = {
    messages: {
      stream: () => {
        const response = responses.shift();
        assert.ok(response, 'unexpected extra stream request');
        return createStream(response);
      },
    },
  };

  orchestrator.syncAgents([
    { id: 'root', data: { role: 'CEO', name: 'Root', model: 'claude-sonnet-4-6' } },
    { id: 'worker', data: { role: 'Programmer', name: 'Worker', model: 'claude-sonnet-4-6' } },
  ]);
  orchestrator.syncEdges([{ source: 'root', target: 'worker' }]);

  const collected = [];
  orchestrator.sendToAgentAndCollect = async (targetAgentId, message, fromAgentId) => {
    collected.push({ targetAgentId, message, fromAgentId });
    return `reply for ${message}`;
  };

  await orchestrator.sendToAgent('root', 'start recursion');

  assert.deepEqual(collected, [
    { targetAgentId: 'worker', message: 'first hop', fromAgentId: 'root' },
    { targetAgentId: 'worker', message: 'second hop', fromAgentId: 'root' },
  ]);

  const doneEvents = events.filter(({ event, data }) => event === 'agent-done' && data.agentId === 'root');
  assert.equal(doneEvents.length, 1);

  const history = orchestrator.histories.get('root');
  const toolResults = history.filter((entry) => entry.role === 'user' && Array.isArray(entry.content));
  assert.equal(toolResults.length, 2);
  assert.match(toolResults[0].content[0].content, /first hop/);
  assert.match(toolResults[1].content[0].content, /second hop/);
});

test('syncAgents hydrates swarm histories and persists updates for swarm agents', () => {
  const persisted = [];
  const orchestrator = new AgentOrchestrator(null);
  orchestrator.setSwarmPersistence({
    saveAgentHistory(swarmId, agentId, history) {
      persisted.push({ swarmId, agentId, history });
    },
  });

  const savedHistory = [{ role: 'user', content: 'remember this' }];
  orchestrator.syncAgents(
    [{ id: 'ceo', data: { role: 'CEO', name: 'Chief' } }],
    { swarmId: 'swarm-1', histories: { ceo: savedHistory } }
  );

  assert.deepEqual(orchestrator.histories.get('ceo'), savedHistory);

  const nextHistory = [...savedHistory, { role: 'assistant', content: [{ type: 'text', text: 'still here' }] }];
  orchestrator.histories.set('ceo', nextHistory);
  orchestrator.persistAgentHistory('ceo');

  assert.deepEqual(persisted, [
    { swarmId: 'swarm-1', agentId: 'ceo', history: nextHistory },
  ]);
});

test('syncAgents can hydrate built-in agent histories from persisted session messages after reload', () => {
  const orchestrator = new AgentOrchestrator(null);
  const savedHistory = [
    { role: 'user', content: '[Message from Programmer (Programmer)]: hello from before reload' },
    { role: 'assistant', content: [{ type: 'text', text: 'I heard Programmer earlier.' }] },
  ];

  orchestrator.syncAgents(
    [{ id: 'ceo', data: { role: 'CEO', name: 'Chief' } }],
    { swarmId: 'swarm-1', histories: { ceo: savedHistory } }
  );

  assert.deepEqual(orchestrator.histories.get('ceo'), savedHistory);
});

test('clearHistory and clearAllHistory invoke swarm persistence cleanup', () => {
  const clearedAgents = [];
  const clearedSwarms = [];
  const orchestrator = new AgentOrchestrator(null);
  orchestrator.setSwarmPersistence({
    clearAgentHistory(swarmId, agentId) {
      clearedAgents.push({ swarmId, agentId });
    },
    clearSwarmHistory(swarmId) {
      clearedSwarms.push(swarmId);
    },
  });

  orchestrator.syncAgents(
    [
      { id: 'ceo', data: { role: 'CEO', name: 'Chief' } },
      { id: 'dev', data: { role: 'Programmer', name: 'Dev' } },
    ],
    { swarmId: 'swarm-1' }
  );
  orchestrator.histories.set('ceo', [{ role: 'user', content: 'one' }]);
  orchestrator.histories.set('dev', [{ role: 'user', content: 'two' }]);

  orchestrator.clearHistory('ceo');
  assert.deepEqual(clearedAgents, [{ swarmId: 'swarm-1', agentId: 'ceo' }]);
  assert.deepEqual(orchestrator.histories.get('ceo'), []);

  orchestrator.clearAllHistory();
  assert.deepEqual(clearedSwarms, ['swarm-1']);
  assert.deepEqual(orchestrator.histories.get('dev'), []);
});
