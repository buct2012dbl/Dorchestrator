const test = require('node:test');
const assert = require('node:assert/strict');

const {
  appendBridgeExchange,
  buildMemoryPrompt,
} = require('../../src/main/swarmMemory');

test('appendBridgeExchange records sent and received swarm memory entries', () => {
  const histories = {};

  appendBridgeExchange(histories, {
    fromAgentId: 'ceo',
    fromName: 'CEO',
    targetAgentId: 'programmer',
    targetName: 'Programmer',
    message: 'Please implement the parser.',
    kind: 'message',
    timestamp: '2026-05-01T12:00:00.000Z',
  });

  assert.equal(histories.ceo.length, 1);
  assert.equal(histories.programmer.length, 1);
  assert.match(histories.ceo[0].summary, /Sent message to Programmer \(programmer\)/);
  assert.match(histories.programmer[0].summary, /Received message from CEO \(ceo\)/);
});

test('buildMemoryPrompt renders prior swarm exchanges as prompt context', () => {
  const prompt = buildMemoryPrompt('ceo', {
    ceo: [
      {
        timestamp: '2026-05-01T12:00:00.000Z',
        summary: 'Sent message to Programmer (programmer): Please implement the parser.',
      },
      {
        timestamp: '2026-05-01T12:05:00.000Z',
        summary: 'Received response from Programmer (programmer): Parser is implemented.',
      },
    ],
  });

  assert.match(prompt, /Persistent swarm memory for this agent in this workspace/);
  assert.match(prompt, /answer from this memory before claiming the session has no record/);
  assert.match(prompt, /Sent message to Programmer \(programmer\): Please implement the parser\./);
  assert.match(prompt, /Received response from Programmer \(programmer\): Parser is implemented\./);
});
