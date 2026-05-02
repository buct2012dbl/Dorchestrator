const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSessionReplayPrompt } = require('../../src/main/swarmSessionMemory');

test('buildSessionReplayPrompt renders recent swarm exchanges as replayable session history', () => {
  const prompt = buildSessionReplayPrompt('ceo', {
    ceo: [
      {
        direction: 'sent',
        kind: 'message',
        counterpartName: 'Programmer',
        message: 'hello',
      },
      {
        direction: 'received',
        kind: 'response',
        counterpartName: 'Programmer',
        message: 'Ready. Send the task details.',
      },
    ],
  });

  assert.match(prompt, /Restore this prior swarm conversation history/);
  assert.match(prompt, /You sent Programmer a message: hello/);
  assert.match(prompt, /Programmer sent you a response: Ready\. Send the task details\./);
});
