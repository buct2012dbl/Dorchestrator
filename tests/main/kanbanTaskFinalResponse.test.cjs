const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getLatestAssistantTimelineText,
  getLatestSegmentText,
  isToolCallTranscript,
  normalizeMeaningfulText,
  resolveKanbanTaskFinalResponse,
} = require('../../src/main/kanbanTaskFinalResponse');

test('isToolCallTranscript detects MCP bridge tool logs', () => {
  assert.equal(
    isToolCallTranscript('agent-bridge - send_message (MCP)(target_agent_id: "Programmer", message: "Hello")'),
    true,
  );
});

test('normalizeMeaningfulText rejects the generic unusable-final-response error', () => {
  assert.equal(
    normalizeMeaningfulText('Task failed before producing a usable final response.'),
    '',
  );
});

test('getLatestAssistantTimelineText returns the newest assistant timeline text', () => {
  assert.equal(
    getLatestAssistantTimelineText({
      timelineEvents: [
        { kind: 'assistant', text: 'First reply' },
        { kind: 'assistant', text: 'Final reply' },
      ],
    }),
    'Final reply',
  );
});

test('getLatestSegmentText falls back to the newest meaningful segment text', () => {
  assert.equal(
    getLatestSegmentText({
      segments: [
        { text: 'agent-bridge - send_message (MCP)' },
        { text: 'Tester completed the hello exchange.' },
      ],
    }),
    'Tester completed the hello exchange.',
  );
});

test('resolveKanbanTaskFinalResponse keeps a normal assistant reply', () => {
  assert.equal(
    resolveKanbanTaskFinalResponse({
      run: { timelineEvents: [] },
      preferredResponse: 'Programmer confirmed the task is complete.',
    }),
    'Programmer confirmed the task is complete.',
  );
});

test('resolveKanbanTaskFinalResponse falls back to the latest assistant timeline event when preferred response is a tool log', () => {
  assert.equal(
    resolveKanbanTaskFinalResponse({
      preferredResponse: 'agent-bridge - send_message (MCP)(target_agent_id: "Programmer")',
      run: {
        timelineEvents: [
          {
            kind: 'command',
            text: 'Delegated task to Programmer',
          },
          {
            kind: 'assistant',
            text: 'Hello from Programmer.',
          },
        ],
      },
    }),
    'Hello from Programmer.',
  );
});

test('resolveKanbanTaskFinalResponse falls back to segments when the timeline is missing', () => {
  assert.equal(
    resolveKanbanTaskFinalResponse({
      preferredResponse: '',
      run: {
        timelineEvents: [],
        segments: [
          { text: 'Tester says hello back.' },
        ],
      },
    }),
    'Tester says hello back.',
  );
});
