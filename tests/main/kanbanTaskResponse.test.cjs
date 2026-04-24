const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isGenericUnusableFinalResponseError,
  shouldFailKanbanTaskExecution,
  shouldFailKanbanSwarmExecution,
} = require('../../src/main/kanbanTaskResponse');

test('fails Kanban execution when an error arrives with no usable response', () => {
  assert.equal(
    shouldFailKanbanTaskExecution({
      response: '(no response)',
      error: 'Task failed before producing a usable final response.',
    }),
    true,
  );
});

test('does not fail Kanban execution when a usable response exists despite warning metadata', () => {
  assert.equal(
    shouldFailKanbanTaskExecution({
      response: 'Finished the task.',
      error: 'non-fatal warning',
    }),
    false,
  );
});

test('detects the generic unusable final response error string', () => {
  assert.equal(
    isGenericUnusableFinalResponseError('Task failed before producing a usable final response.'),
    true,
  );
});

test('does not fail swarm execution when the settled final response exists even if the entry agent had an error', () => {
  assert.equal(
    shouldFailKanbanSwarmExecution({
      finalResponse: 'Hello from Tester.',
      error: 'Task failed before producing a usable final response.',
      transcriptFailure: null,
    }),
    false,
  );
});

test('fails swarm execution when no settled final response exists and the entry agent errored', () => {
  assert.equal(
    shouldFailKanbanSwarmExecution({
      finalResponse: '',
      error: 'Claude crashed unexpectedly.',
      transcriptFailure: null,
    }),
    true,
  );
});

test('does not fail swarm execution on the generic unusable-final-response error alone', () => {
  assert.equal(
    shouldFailKanbanSwarmExecution({
      finalResponse: '',
      error: 'Task failed before producing a usable final response.',
      transcriptFailure: null,
    }),
    false,
  );
});
