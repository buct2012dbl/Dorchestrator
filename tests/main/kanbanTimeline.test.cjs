const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCliTimelineEvents } = require('../../src/main/kanbanTimeline');

test('extractCliTimelineEvents removes hidden CLI markers and returns decoded events', () => {
  const payload = Buffer.from(JSON.stringify({
    kind: 'command',
    phase: 'running',
    title: 'Tool: read',
    text: '{"file_path":"README.md"}',
  }), 'utf8').toString('base64');

  const { cleanText, events } = extractCliTimelineEvents(
    `before \x1b]777;AO_KANBAN_EVENT:${payload}\x07 after`,
  );

  assert.equal(cleanText, 'before  after');
  assert.deepEqual(events, [{
    kind: 'command',
    phase: 'running',
    title: 'Tool: read',
    text: '{"file_path":"README.md"}',
  }]);
});

test('extractCliTimelineEvents ignores invalid payloads without breaking terminal text', () => {
  const { cleanText, events } = extractCliTimelineEvents(
    'hello \x1b]777;AO_KANBAN_EVENT:not-base64!\x07 world',
  );

  assert.equal(cleanText, 'hello  world');
  assert.deepEqual(events, []);
});
