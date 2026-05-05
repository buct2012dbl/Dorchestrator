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

test('syncAgents initializes swarm agent histories as empty in-memory sessions', () => {
  const orchestrator = new AgentOrchestrator(null);

  orchestrator.syncAgents(
    [{ id: 'ceo', data: { role: 'CEO', name: 'Chief' } }],
    { swarmId: 'swarm-1' }
  );

  assert.deepEqual(orchestrator.histories.get('ceo'), []);
});

test('clearHistory and clearAllHistory only reset in-memory swarm histories', () => {
  const orchestrator = new AgentOrchestrator(null);

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
  assert.deepEqual(orchestrator.histories.get('ceo'), []);

  orchestrator.clearAllHistory();
  assert.deepEqual(orchestrator.histories.get('dev'), []);
});
