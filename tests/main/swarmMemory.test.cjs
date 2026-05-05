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
        direction: 'sent',
        kind: 'message',
        counterpartAgentId: 'programmer',
        counterpartName: 'Programmer',
        message: 'Please implement the parser.',
      },
      {
        timestamp: '2026-05-01T12:05:00.000Z',
        direction: 'received',
        kind: 'response',
        counterpartAgentId: 'programmer',
        counterpartName: 'Programmer',
        message: 'Parser is implemented.',
      },
    ],
  });

  assert.match(prompt, /Restore this prior swarm conversation history into the current session context/);
  assert.match(prompt, /\[2026-05-01T12:00:00.000Z\] You sent Programmer a message: Please implement the parser\./);
  assert.match(prompt, /\[2026-05-01T12:05:00.000Z\] Programmer sent you a response: Parser is implemented\./);
  assert.match(prompt, /Do not mention this restoration step unless the user explicitly asks about it/);
});
