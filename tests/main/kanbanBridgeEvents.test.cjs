const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBridgeTimelineEvents } = require('../../src/main/kanbanBridgeEvents');

test('buildBridgeTimelineEvents marks delegated swarm work as running events for both agents', () => {
  const events = buildBridgeTimelineEvents({
    kind: 'message',
    fromName: 'CEO',
    targetName: 'Programmer',
    message: 'Implement the parser',
  });

  assert.deepEqual(events, {
    senderEvent: {
      kind: 'command',
      phase: 'running',
      title: 'Delegated task to Programmer',
      text: 'Implement the parser',
    },
    targetEvent: {
      kind: 'command',
      phase: 'running',
      title: 'Received delegated task from CEO',
      text: 'Implement the parser',
    },
  });
});

test('buildBridgeTimelineEvents marks swarm responses as completed assistant events', () => {
  const events = buildBridgeTimelineEvents({
    kind: 'response',
    fromName: 'Tester',
    targetName: 'CEO',
    message: 'Verified with tests',
  });

  assert.deepEqual(events, {
    senderEvent: {
      kind: 'assistant',
      phase: 'completed',
      title: 'Sent response to CEO',
      text: 'Verified with tests',
    },
    targetEvent: {
      kind: 'assistant',
      phase: 'completed',
      title: 'Received response from Tester',
      text: 'Verified with tests',
    },
  });
});
